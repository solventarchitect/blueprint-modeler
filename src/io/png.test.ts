import { describe, expect, it } from "vitest";
import { PNG_MAX_SIDE, pngScale, withEmbeddedFonts } from "./png";

describe("PNG export helpers (M51)", () => {
  it("draws at 2× until the longest side would pass the cap, then scales to the cap", () => {
    expect(pngScale(800, 600)).toBe(2);
    expect(pngScale(PNG_MAX_SIDE / 2, 100)).toBe(2);
    expect(pngScale(PNG_MAX_SIDE, 100)).toBe(1);
    expect(pngScale(2 * PNG_MAX_SIDE, 100) * 2 * PNG_MAX_SIDE).toBe(PNG_MAX_SIDE);
  });

  it("puts the font rules inside the image's defs, and leaves the image alone without any", () => {
    const svg = '<svg><defs><marker id="a"/></defs></svg>';
    expect(withEmbeddedFonts(svg, "")).toBe(svg);
    expect(withEmbeddedFonts(svg, "@font-face{}")).toBe('<svg><defs><style>@font-face{}</style><marker id="a"/></defs></svg>');
  });
});
