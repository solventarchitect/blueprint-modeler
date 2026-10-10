import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { settled } from "./layout";

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, "Online Store Checkout");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
  await settled(page);
}

/** WCAG contrast of the first plain relationship's stroke against the canvas it is drawn on. */
const edgeLook = (page: Page) =>
  page.evaluate(() => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    const rgb = (c: string) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "#000";
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!];
    };
    const lum = ([r, g, b]: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
    };
    const path = [...document.querySelectorAll<SVGPathElement>(".react-flow__edge:not(.selected):not(.connected):not(.hinted):not(.hover) .react-flow__edge-path")][0]!;
    const s = getComputedStyle(path);
    const canvas = rgb(getComputedStyle(document.documentElement).getPropertyValue("--canvas") || "#000");
    const stroke = rgb(s.stroke);
    const [hi, lo] = [lum(stroke), lum(canvas)].sort((a, b) => b - a);
    return { width: parseFloat(s.strokeWidth), ratio: (hi! + 0.05) / (lo! + 0.05), stroke: s.stroke, token: rgb(getComputedStyle(document.documentElement).getPropertyValue("--border-strong")) };
  });

test.describe("relationship lines and the canvas grid (M47)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  for (const scheme of ["light", "dark"] as const) {
    test(`relationship lines use the line role color and are easy to see (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openCheckout(page);
      const look = await edgeLook(page);
      // Not the canvas library's default gray: the Blueprint line role, at the same color as the arrowheads.
      expect(look.stroke).toBe(`rgb(${look.token.join(", ")})`);
      // WCAG 1.4.11: a graphical object that carries meaning needs 3:1 against what it is drawn on.
      expect(look.ratio).toBeGreaterThanOrEqual(3);
      expect(look.width).toBeGreaterThanOrEqual(scheme === "light" ? 2 : 1.5);
    });
  }

  test("the background grid is dots, small ones every 32px and larger ones every 160px", async ({ page }) => {
    await openCheckout(page);
    const grid = await page.evaluate(() =>
      [...document.querySelectorAll(".react-flow__background")].map((bg) => ({ circles: bg.querySelectorAll("pattern circle").length, paths: bg.querySelectorAll("pattern path").length, r: Number(bg.querySelector("pattern circle")?.getAttribute("r") ?? 0) })),
    );
    expect(grid).toHaveLength(2);
    for (const g of grid) expect([g.circles, g.paths]).toEqual([1, 0]);
    expect(grid[1]!.r).toBeGreaterThan(grid[0]!.r);
  });
});
