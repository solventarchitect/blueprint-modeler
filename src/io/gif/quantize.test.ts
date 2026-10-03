import { describe, expect, it } from "vitest";
import { gifPalette, quantize } from "./quantize";

const rgb = (c: number) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const rgba = (...colors: number[]) => new Uint8ClampedArray(colors.flatMap((c) => [...rgb(c), 255]));

describe("GIF palette from theme colors", () => {
  it("holds every surface and ink color, plus blends between them for smooth edges", () => {
    const p = gifPalette({ surfaces: ["#121e2b", "#172738"], inks: ["#f6f7f9", "#deb163"] });
    for (const c of [0x121e2b, 0x172738, 0xf6f7f9, 0xdeb163]) expect(p).toContain(c);
    // Halfway between the background and the ink: what text edges render as.
    expect(p).toContain(0x848b92);
    expect(new Set(p).size).toBe(p.length);
    expect(p.length).toBeLessThanOrEqual(256);
  });

  it("stays within 256 colors with many surfaces (ArchiMate fills)", () => {
    const hex = (i: number) => `#${(i * 0x0b0d07 + 0x102030).toString(16).padStart(6, "0").slice(-6)}`;
    const p = gifPalette({ surfaces: Array.from({ length: 12 }, (_, i) => hex(i)), inks: Array.from({ length: 14 }, (_, i) => hex(i + 40)) });
    expect(p.length).toBeLessThanOrEqual(256);
    for (let i = 0; i < 12; i++) expect(p).toContain(parseInt(hex(i).slice(1), 16));
  });
});

describe("quantize", () => {
  it("maps each pixel to the nearest palette color, without dithering", () => {
    const palette = [0x000000, 0xffffff, 0xdeb163];
    const out = quantize(rgba(0x000000, 0xffffff, 0xdeb163, 0x101010, 0xf0f0f0, 0xdcb060), palette);
    expect([...out]).toEqual([0, 1, 2, 0, 1, 2]);
  });

  it("gives the same color the same index wherever it appears", () => {
    const out = quantize(rgba(0x808080, 0x123456, 0x808080), [0x000000, 0xffffff]);
    expect(out[0]).toBe(out[2]);
  });
});
