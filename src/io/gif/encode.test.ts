import { describe, expect, it } from "vitest";
import { encodeGif } from "./encode";

/**
 * A small GIF89a reader written from the specification, for checking the encoder: global color table,
 * NETSCAPE loop, comments, graphic control (delay, disposal) and image data (LZW), composed onto a
 * canvas of palette indices the way a viewer would show each frame (disposal 1: leave in place).
 */
function decodeGif(bytes: Uint8Array) {
  let p = 0;
  const u8 = () => bytes[p++]!;
  const u16 = () => u8() | (u8() << 8);
  const text = (n: number) => String.fromCharCode(...bytes.slice(p, (p += n)));
  const blocks = () => {
    const out: number[] = [];
    for (let n = u8(); n; n = u8()) for (let i = 0; i < n; i++) out.push(u8());
    return out;
  };
  const header = text(6);
  const width = u16();
  const height = u16();
  const packed = u8();
  p += 2; // background index, aspect
  const tableSize = packed & 0x80 ? 2 << (packed & 7) : 0;
  const palette: number[] = [];
  for (let i = 0; i < tableSize; i++) palette.push((u8() << 16) | (u8() << 8) | u8());
  const canvas = new Uint8Array(width * height);
  const frames: { delayCs: number; disposal: number; rect: [number, number, number, number]; canvas: Uint8Array }[] = [];
  let loop: number | undefined;
  const comments: string[] = [];
  let gce = { delayCs: 0, disposal: 0 };
  for (;;) {
    const intro = u8();
    if (intro === 0x3b) break;
    if (intro === 0x21) {
      const label = u8();
      if (label === 0xf9) {
        u8(); // block size 4
        const flags = u8();
        gce = { delayCs: u16(), disposal: (flags >> 2) & 7 };
        u8(); // transparent index
        u8(); // terminator
      } else if (label === 0xff) {
        const app = text(u8());
        const data = blocks();
        if (app === "NETSCAPE2.0") loop = data[1]! | (data[2]! << 8);
      } else if (label === 0xfe) comments.push(String.fromCharCode(...blocks()));
      else blocks();
    } else if (intro === 0x2c) {
      const [left, top, w, h] = [u16(), u16(), u16(), u16()];
      const flags = u8();
      if (flags & 0x80) throw new Error("local color table not expected");
      const min = u8();
      const data = blocks();
      const pixels = lzwDecode(data, min, w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) canvas[(top + y) * width + left + x] = pixels[y * w + x]!;
      frames.push({ ...gce, rect: [left, top, w, h], canvas: canvas.slice() });
    } else throw new Error(`unexpected block 0x${intro.toString(16)} at ${p - 1}`);
  }
  return { header, width, height, palette, frames, loop, comments };
}

function lzwDecode(data: number[], min: number, count: number): number[] {
  const clear = 1 << min;
  const eoi = clear + 1;
  let size = min + 1;
  let dict: number[][] = [];
  const reset = () => {
    dict = Array.from({ length: clear + 2 }, (_, i) => [i]);
    size = min + 1;
  };
  reset();
  const out: number[] = [];
  let bit = 0;
  let prev: number[] | null = null;
  for (;;) {
    let code = 0;
    for (let i = 0; i < size; i++, bit++) code |= ((data[bit >> 3]! >> (bit & 7)) & 1) << i;
    if (code === clear) {
      reset();
      prev = null;
      continue;
    }
    if (code === eoi) break;
    let entry: number[];
    if (code < dict.length) entry = dict[code]!;
    else if (code === dict.length && prev) entry = [...prev, prev[0]!];
    else throw new Error(`bad code ${code}`);
    out.push(...entry);
    if (prev) dict.push([...prev, entry[0]!]);
    prev = entry;
    if (dict.length === 1 << size && size < 12) size++;
  }
  expect(out.length).toBe(count);
  return out;
}

const frame = (w: number, h: number, f: (x: number, y: number) => number) => {
  const a = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = f(x, y);
  return a;
};

describe("GIF89a encoder", () => {
  it("writes a header, a padded global palette, a loop, a comment and every frame's delay", () => {
    const palette = [0x121e2b, 0xdeb163, 0xe99696];
    const a = frame(6, 4, () => 0);
    const b = frame(6, 4, (x, y) => (x === 2 && y === 1 ? 1 : 0));
    const c = frame(6, 4, (x, y) => (x === 2 && y === 1 ? 1 : x === 5 && y === 3 ? 2 : 0));
    const gif = encodeGif({ width: 6, height: 4, palette, frames: [{ indices: a, delayCs: 150 }, { indices: b, delayCs: 150 }, { indices: c, delayCs: 300 }], comment: "Hop 1: Orders database" });
    const d = decodeGif(gif);
    expect(d.header).toBe("GIF89a");
    expect([d.width, d.height]).toEqual([6, 4]);
    expect(d.palette).toEqual([0x121e2b, 0xdeb163, 0xe99696, 0]); // padded to a power of two
    expect(d.loop).toBe(0); // forever
    expect(d.comments).toEqual(["Hop 1: Orders database"]);
    expect(d.frames.map((f) => f.delayCs)).toEqual([150, 150, 300]);
    expect(d.frames.every((f) => f.disposal === 1)).toBe(true);
    expect(d.frames.map((f) => [...f.canvas])).toEqual([[...a], [...b], [...c]]);
    expect(gif[gif.length - 1]).toBe(0x3b);
  });

  it("stores only the part of each frame that changed", () => {
    const a = frame(40, 30, () => 0);
    const b = frame(40, 30, (x, y) => (x >= 10 && x < 14 && y >= 5 && y < 8 ? 1 : 0));
    const same = b.slice();
    const d = decodeGif(encodeGif({ width: 40, height: 30, palette: [0, 0xffffff], frames: [a, b, same].map((indices) => ({ indices, delayCs: 10 })) }));
    expect(d.frames[0]!.rect).toEqual([0, 0, 40, 30]);
    expect(d.frames[1]!.rect).toEqual([10, 5, 4, 3]);
    // An unchanged frame still holds its time, as one pixel.
    expect(d.frames[2]!.rect[2] * d.frames[2]!.rect[3]).toBe(1);
    expect([...d.frames[2]!.canvas]).toEqual([...b]);
  });

  it("round-trips images that grow the code size and fill the code table", () => {
    // 256 colors of noise: codes reach 12 bits and the table is cleared and restarted.
    const palette = Array.from({ length: 256 }, (_, i) => i * 0x010101);
    let seed = 7;
    const noise = frame(200, 150, () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 256);
    const smooth = frame(200, 150, (x, y) => (x + y) % 256);
    const d = decodeGif(encodeGif({ width: 200, height: 150, palette, frames: [{ indices: noise, delayCs: 5 }, { indices: smooth, delayCs: 5 }] }));
    expect([...d.frames[0]!.canvas]).toEqual([...noise]);
    expect([...d.frames[1]!.canvas]).toEqual([...smooth]);
    expect(d.palette).toHaveLength(256);
  });

  it("handles a two-color palette and a one-pixel image", () => {
    const d = decodeGif(encodeGif({ width: 1, height: 1, palette: [0xffffff], frames: [{ indices: new Uint8Array([0]), delayCs: 0 }] }));
    expect(d.palette).toEqual([0xffffff, 0]);
    expect([...d.frames[0]!.canvas]).toEqual([0]);
  });

  it("keeps comments to plain ASCII", () => {
    const d = decodeGif(encodeGif({ width: 1, height: 1, palette: [0], frames: [{ indices: new Uint8Array([0]), delayCs: 0 }], comment: "Checkout — production × 2" }));
    expect(d.comments).toEqual(["Checkout - production x 2"]);
  });

  it("refuses frames that do not match the size or the palette", () => {
    expect(() => encodeGif({ width: 2, height: 2, palette: [0], frames: [{ indices: new Uint8Array(3), delayCs: 0 }] })).toThrow(/size/);
    expect(() => encodeGif({ width: 1, height: 1, palette: [0], frames: [{ indices: new Uint8Array([4]), delayCs: 0 }] })).toThrow(/palette/);
    expect(() => encodeGif({ width: 1, height: 1, palette: new Array(257).fill(0), frames: [] })).toThrow(/256/);
  });
});
