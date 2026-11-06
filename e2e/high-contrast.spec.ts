import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M84: more contrast when the system asks for it, and Windows High Contrast (forced colors) kept readable.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });

/** WCAG contrast ratio of two colors as the browser computes them. */
async function ratio(page: Page, a: string, b: string) {
  return page.evaluate(
    ([x, y]) => {
      const rgb = (c: string) => {
        const el = document.createElement("i");
        el.style.color = c;
        document.body.append(el);
        const v = getComputedStyle(el).color.match(/[\d.]+/g)!.slice(0, 3).map(Number);
        el.remove();
        return v;
      };
      const lum = (c: string) => {
        const [r, g, bl] = rgb(c).map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
      };
      const [l1, l2] = [lum(x), lum(y)].sort((p, q) => q - p);
      return (l1! + 0.05) / (l2! + 0.05);
    },
    [a, b] as [string, string],
  );
}
const token = (page: Page, name: string) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

async function open(page: Page) {
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
}

test.describe("more contrast (M84, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the canvas is checked on the desktop");

  for (const scheme of ["dark", "light"] as const) {
    test(`prefers-contrast: more strengthens muted text, borders and lines (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, contrast: "no-preference" });
      await open(page);
      const before = { muted: await ratio(page, await token(page, "--ink-muted"), await token(page, "--surface")), edge: await token(page, "--edge-width") };
      await page.emulateMedia({ colorScheme: scheme, contrast: "more" });
      // Muted text reaches AAA (7:1); borders and lines reach 3:1 against the surface and the canvas.
      expect(await ratio(page, await token(page, "--ink-muted"), await token(page, "--surface"))).toBeGreaterThanOrEqual(7);
      expect(await ratio(page, await token(page, "--ink-muted"), await token(page, "--surface"))).toBeGreaterThan(before.muted);
      expect(await ratio(page, await token(page, "--border"), await token(page, "--surface"))).toBeGreaterThanOrEqual(3);
      expect(await ratio(page, await token(page, "--border-strong"), await token(page, "--canvas"))).toBeGreaterThanOrEqual(4.5);
      expect(parseFloat(await token(page, "--edge-width"))).toBeGreaterThan(parseFloat(before.edge));
      expect(await new AxeBuilder({ page }).withTags(axeTags).analyze().then((r) => r.violations)).toEqual([]);
    });
  }

  test("the header's theme toggle still wins over the system scheme, with more contrast", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light", contrast: "more" });
    await open(page);
    const light = await token(page, "--ink-muted");
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    const dark = await token(page, "--ink-muted");
    expect(dark).not.toBe(light);
    expect(await ratio(page, dark, await token(page, "--surface"))).toBeGreaterThanOrEqual(7);
  });
});

test.describe("forced colors (M84, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the canvas is checked on the desktop");

  test("lines, markers, the minimap and focus stay visible in system colors", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await open(page);
    const text = await page.evaluate(() => getComputedStyle(document.querySelector(".react-flow")!).color);
    const back = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(text).not.toBe(back);

    // Relationship lines and their labels in the text color, never a token the system can't see.
    const edge = page.locator(".react-flow__edge .react-flow__edge-path").first();
    await expect(edge).toHaveCSS("stroke", text);
    // Arrowheads and notation markers too.
    const marker = page.locator("marker path, marker polygon").first();
    if (await marker.count()) await expect(marker).toHaveCSS("stroke", text);

    // A coloring's shape markers and legend stay visible: shape, not color, carries it here.
    await page.getByRole("button", { name: /^Views/ }).click();
    await page.getByTestId("views-menu").getByRole("button", { name: "Filter and color…" }).click();
    await page.getByTestId("view-dialog").getByRole("group", { name: "Color by" }).getByLabel("Owner", { exact: true }).check();
    await page.getByTestId("view-dialog").getByRole("button", { name: "Close" }).click();
    await expect(page.getByTestId("slot-marker").first()).toHaveCSS("fill", text);
    await expect(page.getByTestId("view-legend").locator("svg").first()).toHaveCSS("fill", text);

    // The minimap's elements are outlined in the text color.
    await expect(page.locator(".react-flow__minimap-node").first()).toHaveCSS("stroke", text);

    // Keyboard focus on an element shows an outline.
    await node(page, "Orders database").focus();
    const outline = await node(page, "Orders database").evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe("none");
  });
});
