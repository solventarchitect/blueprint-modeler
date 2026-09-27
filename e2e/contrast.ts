import type { Locator } from "@playwright/test";

/**
 * WCAG contrast of an element's text against what is actually painted behind it.
 *
 * Why this exists: axe reports "background color could not be determined due to a
 * background gradient" for any text over the drafting grid (body background-image), and
 * files it as *incomplete*, not a violation. A 3.3:1 error message passed axe that way.
 * This walks up the ancestors compositing background-colors (the grid is decorative and
 * ~7% alpha, so it is ignored), normalises every colour through a canvas — computed
 * values may be oklab()/color-mix() — and returns the ratio.
 */
export type ContrastProp = "text" | "outline";

/**
 * `prop`: "text" measures the glyph colour (CSS `color`, or `fill` for SVG text);
 * "outline" measures the focus outline colour against the same background (WCAG 1.4.11).
 */
export async function contrastOf(locator: Locator, prop: ContrastProp = "text"): Promise<number> {
  return locator.evaluate((el, which) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    const rgba = (c: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const over = (top: number[], bottom: number[]) =>
      top.map((v, i) => (i < 3 ? v * top[3]! + bottom[i]! * (1 - top[3]!) : 1));
    const layers: number[][] = [];
    // An outline is painted outside the element's border box, over whatever is behind the
    // element — so for "outline" the element's own background does not count.
    for (let n: Element | null = which === "outline" ? el.parentElement : el; n; n = n.parentElement) {
      const bg = rgba(getComputedStyle(n).backgroundColor);
      if (bg[3] > 0) layers.push(bg);
      if (bg[3] === 1) break;
    }
    let bg = [255, 255, 255, 1];
    for (const layer of layers.reverse()) bg = over(layer, bg);
    const cs = getComputedStyle(el);
    const raw = which === "outline" ? cs.outlineColor : el instanceof SVGElement ? cs.fill : cs.color;
    const fg = over(rgba(raw), bg);
    const lum = (c: number[]) => {
      const [r, g, b] = c.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return (a! + 0.05) / (b! + 0.05);
  }, prop);
}
