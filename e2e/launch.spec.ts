import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const pages = ["/", "/editor", "/guide", "/about", "/privacy"];

test("the theme toggle cycles Auto → Light → Dark, applies at once and survives a reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/about");
  const toggle = page.getByTestId("theme-toggle");
  await expect(toggle).toHaveAccessibleName(/Color theme: Auto/);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const dark = await bg();

  await toggle.click();
  await expect(toggle).toHaveAccessibleName(/Color theme: Light/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await bg()).not.toBe(dark);

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByTestId("theme-toggle")).toHaveAccessibleName(/Color theme: Light/);

  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

for (const [os, forced] of [
  ["dark", "light"],
  ["light", "dark"],
] as const) {
  test(`a forced ${forced} theme on a ${os} OS has no WCAG 2.2 AA violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: os });
    await page.addInitScript((t) => localStorage.setItem("bm-theme", t), forced);
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", forced);
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations, path).toEqual([]);
    }
  });
}

test("About and Privacy are linked from every page and say what the app does with data", async ({ page }) => {
  await page.goto("/guide");
  await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
  await expect(page.getByText("Cloudflare Web Analytics")).toBeVisible();
  await expect(page.getByText(/IndexedDB/)).toBeVisible();
  await page.getByRole("contentinfo").getByRole("link", { name: "About" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "About Blueprint Modeler" })).toBeVisible();
  await expect(page.getByText(/Not affiliated with or endorsed by ServiceNow/).first()).toBeVisible();
});

test("local and preview builds ship no analytics beacon", async ({ page, baseURL }) => {
  test.skip(baseURL === "https://model.mikereams.com", "production is expected to have it");
  await page.goto("/");
  await expect(page.locator('script[src*="cloudflareinsights"]')).toHaveCount(0);
});

test("sitemap and robots list the public pages", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const path of ["/editor", "/guide", "/about", "/privacy"]) expect(sitemap).toContain(`https://model.mikereams.com${path}`);
  expect(await (await request.get("/robots.txt")).text()).toContain("Sitemap: https://model.mikereams.com/sitemap.xml");
});

for (const width of [320, 640, 768, 1024, 1280, 1536]) {
  test(`no horizontal scroll on the text pages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/about", "/privacy"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}
