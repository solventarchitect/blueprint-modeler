import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { contrastOf } from "./contrast";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const figure = (page: Page) => page.getByTestId("hero-sheet");

test.describe("landing hero figures", () => {
  test("rotates through three figures on one sheet, naming and describing each", async ({ page }) => {
    await page.clock.install();
    await page.goto("/");
    await expect(page.getByRole("img", { name: "Figure 1: the realization chain" })).toBeVisible();
    await expect(figure(page)).toHaveAttribute("data-fig", "0");
    await expect(page.locator("#hero-desc")).toContainText("is provided by the Business Application Checkout");

    await page.clock.runFor(8000);
    await expect(page.getByRole("img", { name: "Figure 2: caught early" })).toBeVisible();
    await expect(page.locator("#hero-desc")).toContainText("not related directly to a Host in CSDM");

    await page.clock.runFor(8000);
    await expect(page.getByRole("img", { name: "Figure 3: read it in ArchiMate" })).toBeVisible();
    await page.clock.runFor(8000);
    await expect(figure(page)).toHaveAttribute("data-fig", "0");

    // One sheet: the same SVG stays in place while the figure changes.
    expect(await page.locator(".hero-sheet svg").count()).toBe(1);
  });

  test("pauses on hover and with the pause button; picking a figure stops rotation until Play", async ({ page, isMobile }) => {
    await page.clock.install();
    await page.goto("/");
    if (!isMobile) {
      await figure(page).hover();
      await page.clock.runFor(9000);
      await expect(figure(page)).toHaveAttribute("data-fig", "0");
      await page.mouse.move(0, 0);
    }

    const pause = page.getByRole("button", { name: "Pause the figures" });
    await pause.click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(20000);
    await expect(figure(page)).toHaveAttribute("data-fig", "0");
    await page.getByRole("button", { name: "Play the figures" }).click();
    await page.mouse.move(0, 0);
    await page.clock.runFor(8000);
    await expect(figure(page)).toHaveAttribute("data-fig", "1");

    const archimate = page.getByRole("button", { name: /03 ArchiMate/ });
    await archimate.click();
    await expect(archimate).toHaveAttribute("aria-pressed", "true");
    await expect(figure(page)).toHaveAttribute("data-fig", "2");
    await page.mouse.move(0, 0);
    await page.clock.runFor(20000);
    await expect(figure(page)).toHaveAttribute("data-fig", "2");
    await expect(page.getByRole("button", { name: "Play the figures" })).toBeVisible();
  });

  test("with reduced motion the figures start paused and change at once", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install();
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Play the figures" })).toBeVisible();
    await page.clock.runFor(20000);
    await expect(figure(page)).toHaveAttribute("data-fig", "0");
    await page.getByRole("button", { name: /02 Caught early/ }).click();
    const footer = page.locator(".hero-sheet text").filter({ hasText: "not related directly to a Host" });
    expect(Number(await footer.evaluate((el) => getComputedStyle(el).opacity))).toBe(1);
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`every figure and its controls pass WCAG 2.2 AA (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await page.goto("/");
      for (const name of [/01 Chain/, /02 Caught early/, /03 ArchiMate/]) {
        await page.getByRole("button", { name }).click();
        const results = await new AxeBuilder({ page }).withTags(tags).analyze();
        expect(results.violations, String(name)).toEqual([]);
      }
      for (const b of await page.getByRole("group", { name: "Hero figures" }).getByRole("button").all()) {
        expect(await contrastOf(b), scheme).toBeGreaterThanOrEqual(4.5);
        expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(24);
      }
    });
  }
});
