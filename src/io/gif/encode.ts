/**
 * A small GIF89a encoder: one global palette (up to 256 colors), LZW-compressed frames, a NETSCAPE
 * loop and an optional comment. After the first frame, each frame stores only the rectangle that
 * changed (disposal "leave in place"), which keeps step-by-step animations small.
 * Written for Blueprint Modeler (no dependency); follows the GIF89a specification.
 */
export type GifFrame = { indices: Uint8Array; delayCs: number };
export type GifInput = { width: number; height: number; palette: readonly number[]; frames: readonly GifFrame[]; comment?: string; loop?: boolean };

class Bytes {
  private buf = new Uint8Array(1 << 16);
  length = 0;
  byte(b: number) {
    if (this.length === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2);
      next.set(this.buf);
      this.buf = next;
    }
    this.buf[this.length++] = b & 0xff;
  }
  u16(n: number) {
    this.byte(n);
    this.byte(n >> 8);
  }
  text(s: string) {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }
  /** Data split into sub-blocks of at most 255 bytes, then the block terminator. */
  blocks(data: ArrayLike<number>) {
    for (let i = 0; i < data.length; i += 255) {
      const n = Math.min(255, data.length - i);
      this.byte(n);
      for (let j = 0; j < n; j++) this.byte(data[i + j]!);
    }
    this.byte(0);
  }
  done() {
    return this.buf.slice(0, this.length);
  }
}

/** GIF's LZW variant: variable code size from min+1 up to 12 bits, codes packed least significant bit first. */
function lzw(pixels: Uint8Array, min: number): Uint8Array {
  const clear = 1 << min;
  const eoi = clear + 1;
  const out = new Bytes();
  let size = min + 1;
  let next = eoi + 1;
  let acc = 0;
  let bits = 0;
  // Dictionary: (prefix code << 8 | pixel) → code.
  let dict = new Map<number, number>();
  const write = (code: number) => {
    acc |= code << bits;
    bits += size;
    while (bits >= 8) {
      out.byte(acc & 0xff);
      acc >>>= 8;
      bits -= 8;
    }
    // The decoder adds a table entry after each code it reads, one step behind; it widens the code
    // when its table reaches the current size, so widen at the same point (as giflib does).
    if (next >= 1 << size && size < 12) size++;
  };
  write(clear);
  let prefix = pixels[0]!;
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i]!;
    const key = (prefix << 8) | k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    write(prefix);
    if (next >= 4095) {
      write(clear);
      dict = new Map();
      size = min + 1;
      next = eoi + 1;
    } else dict.set(key, next++);
    prefix = k;
  }
  write(prefix);
  write(eoi);
  if (bits > 0) out.byte(acc & 0xff);
  return out.done();
}

/** The smallest rectangle holding every pixel that differs between two frames, or null if none. */
function changed(prev: Uint8Array, cur: Uint8Array, w: number, h: number): [number, number, number, number] | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (prev[row + x] !== cur[row + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

const ascii = (s: string) =>
  s
    .replace(/[–—]/g, "-")
    .replace(/×/g, "x")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7e]/g, "?");

export function encodeGif({ width, height, palette, frames, comment, loop = true }: GifInput): Uint8Array {
  if (palette.length < 1 || palette.length > 256) throw new Error("A GIF palette holds 1 to 256 colors.");
  let sizeBits = 1;
  while (1 << sizeBits < palette.length) sizeBits++;
  const min = Math.max(2, sizeBits);
  for (const f of frames) {
    if (f.indices.length !== width * height) throw new Error("Every frame must match the image size.");
    for (const i of f.indices) if (i >= palette.length) throw new Error("A pixel points past the palette.");
  }

  const g = new Bytes();
  g.text("GIF89a");
  g.u16(width);
  g.u16(height);
  g.byte(0x80 | (7 << 4) | (sizeBits - 1)); // global table, 8-bit color resolution, table size
  g.byte(0); // background color index
  g.byte(0); // pixel aspect ratio
  for (let i = 0; i < 1 << sizeBits; i++) {
    const c = palette[i] ?? 0;
    g.byte(c >> 16);
    g.byte(c >> 8);
    g.byte(c);
  }
  if (loop) {
    g.byte(0x21);
    g.byte(0xff);
    g.byte(11);
    g.text("NETSCAPE2.0");
    g.blocks([1, 0, 0]); // loop count 0 = forever
  }
  if (comment) {
    g.byte(0x21);
    g.byte(0xfe);
    g.blocks(Array.from(ascii(comment), (ch) => ch.charCodeAt(0)));
  }

  let prev: Uint8Array | null = null;
  for (const f of frames) {
    const rect: [number, number, number, number] = prev ? (changed(prev, f.indices, width, height) ?? [0, 0, 1, 1]) : [0, 0, width, height];
    const [left, top, w, h] = rect;
    const sub = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) sub.set(f.indices.subarray((top + y) * width + left, (top + y) * width + left + w), y * w);
    // Graphic control: disposal 1 (leave in place), the delay, no transparency.
    g.byte(0x21);
    g.byte(0xf9);
    g.byte(4);
    g.byte(1 << 2);
    g.u16(Math.max(0, Math.round(f.delayCs)));
    g.byte(0);
    g.byte(0);
    // Image descriptor, no local palette.
    g.byte(0x2c);
    g.u16(left);
    g.u16(top);
    g.u16(w);
    g.u16(h);
    g.byte(0);
    g.byte(min);
    g.blocks(lzw(sub, min));
    prev = f.indices;
  }
  g.byte(0x3b);
  return g.done();
}
