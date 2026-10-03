/**
 * Colors for a GIF frame: the theme's own colors plus blends between each surface and each ink (the
 * shades antialiased edges and text render as), mapped nearest-color, with no dithering.
 */
const hex = (c: string) => parseInt(c.replace("#", ""), 16);
const mix = (a: number, b: number, t: number) => {
  const ch = (shift: number) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

export function gifPalette({ surfaces, inks }: { surfaces: readonly string[]; inks: readonly string[] }): number[] {
  const base = [...new Set([...surfaces, ...inks].map((c) => hex(c.toLowerCase())))];
  const s = [...new Set(surfaces.map(hex))];
  const k = [...new Set(inks.map(hex))].filter((c) => !s.includes(c));
  // Three blend steps where they fit, otherwise one (the midpoint), so the palette stays within 256.
  for (const steps of [[0.25, 0.5, 0.75], [0.5]]) {
    const out = new Set(base);
    for (const a of s) for (const b of k) for (const t of steps) out.add(mix(a, b, t));
    if (out.size <= 256) return [...out];
  }
  return base.slice(0, 256);
}

/** Palette index for every RGBA pixel (alpha ignored: frames are drawn on an opaque background). */
export function quantize(rgba: Uint8ClampedArray, palette: readonly number[]): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  const pr = palette.map((c) => (c >> 16) & 255);
  const pg = palette.map((c) => (c >> 8) & 255);
  const pb = palette.map((c) => c & 255);
  const cache = new Map<number, number>();
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    const key = (r << 16) | (g << 8) | b;
    let best = cache.get(key);
    if (best === undefined) {
      let dist = Infinity;
      best = 0;
      for (let p = 0; p < palette.length; p++) {
        // Weighted RGB distance: the eye is most sensitive to green, least to blue.
        const dr = r - pr[p]!;
        const dg = g - pg[p]!;
        const db = b - pb[p]!;
        const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if (d < dist) {
          dist = d;
          best = p;
        }
      }
      cache.set(key, best);
    }
    out[j] = best;
  }
  return out;
}
