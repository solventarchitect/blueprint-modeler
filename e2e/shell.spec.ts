import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { contrastOf } from "./contrast";
import { watchForeignRequests } from "./network";

for (const scheme of ["dark", "light"] as const) {
  test(`home has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations).toEqual([]);
    for (const sel of ["h1", "main p", "footer p"]) {
      expect(await contrastOf(page.locator(sel).first()), `${sel} (${scheme})`).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test("the page makes no requests beyond its own origin", async ({ page, baseURL }) => {
  const foreign = watchForeignRequests(page, baseURL);
  await page.goto("/", { waitUntil: "networkidle" });
  expect(foreign).toEqual([]);
});

test("landmarks, skip link and the not-affiliated notice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText("Not affiliated with or endorsed by ServiceNow");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

for (const width of [640, 768, 1024, 1280, 1536]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
