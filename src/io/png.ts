/**
 * PNG export (M51): the SVG image drawn onto a canvas in the browser, with the page's own fonts
 * embedded first — an image loaded from a blob URL loads no fonts of its own, so without this the
 * raster would fall back to system fonts. Local only: the font files are the page's same-origin
 * static assets; nothing leaves the browser.
 */

/** The page's self-hosted families, keyed by the name the SVG export uses (see svg.ts SANS/MONO). */
const FAMILIES: Record<string, string> = { "--font-plex-sans": "IBM Plex Sans", "--font-plex-mono": "IBM Plex Mono" };

let fontStyle: Promise<string> | undefined;

const toBase64 = (bytes: ArrayBuffer) => {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s);
};

/**
 * `@font-face` rules for the page's fonts with their files inlined as data URLs, named as the SVG
 * names them. Read once from the page's own stylesheets (next/font writes them inline); families the
 * page has not loaded are skipped, so the raster still draws, in a fallback font.
 */
export function embeddedFontStyle(): Promise<string> {
  fontStyle ??= (async () => {
    const root = getComputedStyle(document.documentElement);
    // next/font gives each family a generated name, published through its CSS variable.
    const generated = new Map(Object.entries(FAMILIES).map(([v, name]) => [root.getPropertyValue(v).trim().replace(/^['"]|['"]$/g, ""), name]));
    const rules: string[] = [];
    for (const sheet of document.styleSheets) {
      let list: CSSRuleList;
      try {
        list = sheet.cssRules;
      } catch {
        continue; // A stylesheet from another origin: not ours.
      }
      for (const rule of list) {
        if (!(rule instanceof CSSFontFaceRule)) continue;
        const family = rule.style.getPropertyValue("font-family").trim().replace(/^['"]|['"]$/g, "");
        const name = generated.get(family);
        const url = /url\(["']?([^"')]+)["']?\)/.exec(rule.style.getPropertyValue("src"))?.[1];
        if (!name || !url) continue;
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = toBase64(await res.arrayBuffer());
          const weight = rule.style.getPropertyValue("font-weight") || "normal";
          rules.push(`@font-face{font-family:'${name}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${data}) format('woff2')}`);
        } catch {
          // A font that fails to load is left out: the raster falls back for that family.
        }
      }
    }
    return rules.join("");
  })();
  return fontStyle;
}

/** The SVG with the fonts embedded, for drawing; the downloadable SVG stays small and names the fonts instead. */
export const withEmbeddedFonts = (svg: string, style: string) => (style ? svg.replace("<defs>", `<defs><style>${style}</style>`) : svg);

const sizeOf = (svg: string) => {
  const m = /<svg[^>]* width="([\d.]+)" height="([\d.]+)"/.exec(svg);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
};

/** The largest side a PNG gets, in pixels: 2× the image, capped so a very large model still exports. */
export const PNG_MAX_SIDE = 8000;
export const pngScale = (w: number, h: number) => Math.min(2, PNG_MAX_SIDE / Math.max(w, h));

/** The SVG as a PNG blob at `scale` pixels per SVG unit. */
export async function svgToPng(svg: string, scale = 2): Promise<{ blob: Blob; width: number; height: number }> {
  const size = sizeOf(svg);
  if (!size) throw new Error("Not an image.");
  const width = Math.max(1, Math.round(size.width * scale));
  const height = Math.max(1, Math.round(size.height * scale));
  const drawn = withEmbeddedFonts(svg, await embeddedFontStyle());
  const url = URL.createObjectURL(new Blob([drawn], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw the image.");
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("This browser could not make the PNG.");
    return { blob, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
