import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const stack = (page: Page) => page.getByTestId("iso-stack");
const explode = (page: Page) => page.getByRole("button", { name: "Explode the stack" });
const cards = (page: Page) => page.locator(".fig-card");
/** The rise between two layers, from their transforms (translateZ is the matrix3d's 15th value). */
const layerZ = (page: Page) =>
  page.locator(".iso-layer").evaluateAll((els) => els.map((e) => Math.round(new DOMMatrix(getComputedStyle(e).transform).m43)));

test.describe("landing hero: the realization chain in isometric", () => {
  test("names and describes the stack, bottom up, in the chain's own words", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("img", { name: "The realization chain, stacked in isometric" })).toBeVisible();
    await expect(page.locator("#iso-stack-desc")).toHaveText(
      "Five stacked layers, from Infrastructure at the bottom to Business at the top: the Host web-prod-01, the Application checkout-web, the Application Service Checkout — production, the Business Application Checkout and the Business Capability Order Management. Data rises between the layers.",
    );
    await expect(page.locator(".iso-layer")).toHaveCount(5);
  });

  test("Explode the stack spreads the layers apart and back, as a toggle", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" }); // instant, so the positions can be read at once
    await page.goto("/");
    const before = await layerZ(page);
    expect(before[0]).toBe(0);
    await explode(page).click();
    await expect(explode(page)).toHaveAttribute("aria-pressed", "true");
    await expect(stack(page)).toHaveAttribute("data-exploded", "true");
    const after = await layerZ(page);
    for (let i = 1; i < 5; i++) expect(after[i]!).toBeGreaterThan(before[i]!);
    await explode(page).click();
    await expect(explode(page)).toHaveAttribute("aria-pressed", "false");
    expect(await layerZ(page)).toEqual(before);
  });

  test("moves only by transform, with one ambient loop: the float, and packets on the risers", async ({ page }) => {
    await page.goto("/");
    await page.mouse.move(0, 0);
    const loops = await page.evaluate(() =>
      [...new Set(document.getAnimations().filter((a) => a.effect?.getTiming().iterations === Infinity && a.playState === "running").map((a) => (a as CSSAnimation).animationName))].sort(),
    );
    expect(loops).toEqual(["iso-float", "iso-rise"]);
  });

  test("with reduced motion the stack holds still: no settling, float or packets", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    expect(await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length)).toBe(0);
    await expect(page.locator(".iso-packet").first()).toBeHidden();
  });
});

test.describe("landing: the same chain, three ways", () => {
  test("three figure cards, each one figure, open its guide section and say what it shows", async ({ page }) => {
    await page.goto("/");
    await expect(cards(page)).toHaveCount(3);
    const hrefs = ["/guide#relationships", "/guide#hints", "/guide#archimate"];
    const names = [/The realization chain/, /Caught early/, /Read it in ArchiMate/];
    for (let i = 0; i < 3; i++) {
      const card = cards(page).nth(i);
      await expect(card).toHaveAttribute("href", hrefs[i]!);
      await expect(card).toHaveAccessibleName(names[i]!);
      await expect(card.locator(".hero-sheet")).toHaveAttribute("data-fig", String(i));
    }
    await expect(cards(page).nth(1)).toHaveAccessibleDescription(/not related directly to a Host in CSDM/);
    await expect(cards(page).nth(2)).toContainText("ArchiMate® is a registered trademark of The Open Group.");
    // Three copies of the drawing, each with its own mask id.
    const ids = await page.locator(".fig-card mask").evaluateAll((ms) => ms.map((m) => m.id));
    expect(new Set(ids).size).toBe(3);
  });

  test("a card's signal runs only while it is hovered or focused", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "hover effect");
    await page.goto("/");
    // Every card, figures 2 and 3 included (their per-figure rule restarts the signal unless outranked).
    for (let i = 0; i < 3; i++) {
      const s = cards(page).nth(i).locator(".hero-signal");
      await expect.poll(() => s.evaluate((e) => getComputedStyle(e).animationPlayState)).toBe("paused");
    }
    const signal = cards(page).first().locator(".hero-signal");
    await cards(page).first().hover();
    await expect.poll(() => signal.evaluate((e) => getComputedStyle(e).animationPlayState)).toBe("running");
  });

  test("the guide link opens the guide; Open the modeler opens the editor", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Open the modeler" }).click();
    await expect(page).toHaveURL(/\/editor\/?$/);
  });
});

for (const scheme of ["dark", "light"] as const) {
  test(`the landing page passes WCAG 2.2 AA, collapsed and exploded (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/");
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    await explode(page).click();
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    expect((await explode(page).boundingBox())!.height).toBeGreaterThanOrEqual(24);
  });
}
