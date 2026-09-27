import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.describe("examples and hints (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the empty state opens an example as a new model", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.getByRole("button", { name: /Online store checkout/ }).click();
    await expect(page.getByRole("status")).toContainText("Opened the example");
    await expect(page.locator(".react-flow__node")).not.toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Hints (0)" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("combobox", { name: "Open model" })).toHaveValue(/.+/);
    await expect(page.locator(".react-flow__node")).not.toHaveCount(0);
  });

  test("selecting a hint highlights its elements and cites a source", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Shared database platform" });
    const tab = page.getByRole("tab", { name: "Hints (3)" });
    await tab.click();
    const panel = page.getByRole("tabpanel");
    const first = panel.getByRole("button").first();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".react-flow__node .ring-status")).not.toHaveCount(0);
    await expect(panel.getByRole("link", { name: /Source:/ }).first()).toHaveAttribute("href", /servicenow\.com/);

    // Selecting a node scopes the panel to that node's hints.
    await page.locator(".react-flow__node").filter({ hasText: "Reporting — production" }).click();
    await page.getByRole("tab", { name: /Hints/ }).click();
    await expect(page.getByRole("tab", { name: "Hints (1)" })).toBeVisible();
  });

  test("the Kubernetes example uses the CMDB's Kubernetes classes, sourced from the product docs", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Storefront on Kubernetes" });
    const workload = page.locator(".react-flow__node").filter({ hasText: "catalog-service" });
    await expect(workload).toContainText("Kubernetes Workload");
    await workload.click();
    const inspector = page.getByRole("complementary", { name: "Inspector" });
    await expect(inspector.getByRole("link", { name: /Kubernetes extension classes/ })).toHaveAttribute("href", /servicenow\.com\/docs/);
    await expect(inspector).toContainText("Hosted on::Hosts");
    await expect(inspector.getByTestId("cmdb-extension")).toBeVisible();
    await expect(page.getByRole("tab", { name: "Hints (0)" })).toBeVisible();
  });

  test("tabs work from the keyboard", async ({ page }) => {
    await page.goto("/editor");
    await page.getByRole("tab", { name: "Details" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Hints/ })).toBeFocused();
    await expect(page.getByRole("tab", { name: /Hints/ })).toHaveAttribute("aria-selected", "true");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`editor with an example and active hint has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/editor");
      await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
      await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Shared database platform" });
      await page.getByRole("tab", { name: /Hints/ }).click();
      await page.getByRole("tabpanel").getByRole("button").first().click();
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe("class guide", () => {
  test("lists classes, relationships and hints, each with a source", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByRole("heading", { level: 1, name: "Class guide" })).toBeVisible();
    await expect(page.getByText("Business Application", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("table").locator("tbody tr")).not.toHaveCount(0);
    const links = page.locator("main section:not([data-testid=archimate-section]) a[target=_blank]");
    expect(await links.count()).toBeGreaterThan(20);
    for (const href of await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) {
      expect(new URL(href).hostname).toMatch(/(^|\.)servicenow\.com$/);
    }
  });

  test("the ArchiMate mapping links only to The Open Group's public specification", async ({ page }) => {
    await page.goto("/guide");
    const section = page.getByTestId("archimate-section");
    await expect(section.getByRole("heading", { name: /ArchiMate® 3.2 mapping/ })).toBeVisible();
    await expect(section.getByRole("region", { name: "ArchiMate element mapping" }).locator("tbody tr")).toHaveCount(19);
    for (const href of await section.locator("a[target=_blank]").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))) {
      expect(new URL(href).hostname).toBe("pubs.opengroup.org");
    }
    await expect(section).toContainText("registered trademark of The Open Group");
  });

  test("the header links to the editor and the guide", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await nav.getByRole("link", { name: "Guide" }).click();
    await expect(page).toHaveURL(/\/guide\/?$/);
    await nav.getByRole("link", { name: "Editor" }).click();
    await expect(page).toHaveURL(/\/editor\/?$/);
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`guide has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/guide");
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

for (const width of [320, 640, 768, 1024, 1280, 1536]) {
  test(`guide and home have no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/guide", "/"]) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
}
