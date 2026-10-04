import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { exampleNames, examplesButton, examplesMenu, openExample } from "./examples";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.describe("examples menu", () => {
  test("lists the examples under their categories, each with a summary", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    const button = examplesButton(page);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const menu = examplesMenu(page);
    await expect(menu.getByRole("heading")).toHaveText(["Application architecture", "Reference architecture", "Frameworks and metamodel"]);
    const section = (name: string) => menu.getByRole("region", { name });
    await expect(section("Application architecture").getByRole("button")).toHaveText([/^Online store checkout/, /^HR self-service portal/, /^Shared database platform/, /^Enterprise AI assistant/]);
    await expect(section("Reference architecture").getByRole("button", { name: "Storefront on Kubernetes" })).toHaveAccessibleDescription(/Containerization/);
    await expect(section("Frameworks and metamodel").getByRole("button")).toHaveCount(2);
    await expect(menu.getByRole("button", { name: "Blank model" })).toBeVisible();
    expect(await exampleNames(page)).toHaveLength(7);
  });

  test("choosing an example opens it and closes the menu; Blank model opens an empty one", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await openExample(page, "Shared database platform");
    await expect(page.getByRole("combobox", { name: "Open model" }).locator("option:checked")).toHaveText("Shared database platform");
    await expect(page.getByRole("status")).toContainText("Opened the example “Shared database platform”");
    await expect(examplesButton(page)).toBeFocused();
    await openExample(page, "Blank model");
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
  });

  test("works from the keyboard: Escape and focus leaving close it, focus returns to the button", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    const button = examplesButton(page);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(examplesMenu(page)).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(examplesMenu(page).getByRole("button", { name: "Blank model" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(examplesMenu(page).getByRole("button", { name: "Online store checkout" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(examplesMenu(page)).toBeHidden();
    await expect(button).toBeFocused();

    // Tabbing past the last example closes the panel rather than leaving it over the page.
    await page.keyboard.press("Enter");
    const items = examplesMenu(page).getByRole("button");
    await items.last().focus();
    await page.keyboard.press("Tab");
    await expect(examplesMenu(page)).toBeHidden();

    // A click outside closes it too.
    await button.click();
    await expect(examplesMenu(page)).toBeVisible();
    // (On a phone the open panel covers most of the page, so press on the status line directly.)
    await page.getByTestId("save-status").dispatchEvent("pointerdown");
    await expect(examplesMenu(page)).toBeHidden();
  });

  test("Escape still closes it after a click on a heading inside it, and leaves an open blast radius alone", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await openExample(page, "Online store checkout");
    const blast = page.getByRole("region", { name: "Blast radius" });
    const isDesktop = (page.viewportSize()?.width ?? 0) >= 768;
    if (isDesktop) {
      await page.locator(".react-flow__node").filter({ has: page.getByText("db-prod-01", { exact: true }) }).click({ button: "right" });
      await page.getByRole("menuitem", { name: "Show blast radius" }).click();
      await expect(blast).toBeVisible();
    }
    await examplesButton(page).click();
    // A heading is not focusable: clicking it moves focus out of the menu, to the page.
    await examplesMenu(page).getByRole("heading", { name: "Reference architecture" }).click();
    await page.keyboard.press("Escape");
    await expect(examplesMenu(page)).toBeHidden();
    await expect(examplesButton(page)).toBeFocused();
    if (isDesktop) await expect(blast).toBeVisible();
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`has no WCAG 2.2 AA violations when open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/editor");
      await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
      await examplesButton(page).click();
      await expect(examplesMenu(page)).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("the empty state groups the examples the same way", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    const card = page.getByTestId("empty-state");
    await expect(card.getByRole("heading", { level: 3 })).toHaveText(["Application architecture", "Reference architecture", "Frameworks and metamodel"]);
    await card.getByRole("button", { name: /^Storefront on Kubernetes/ }).click();
    await expect(page.getByRole("combobox", { name: "Open model" }).locator("option:checked")).toHaveText("Storefront on Kubernetes");
  });
});

for (const width of [320, 768, 1024, 1536]) {
  test(`the open examples menu fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await examplesButton(page).click();
    const box = (await examplesMenu(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("the About page explains the blast radius", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 2, name: "Blast radius" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Show blast radius");
  await expect(page.locator("main")).toContainText("not ServiceNow's Impacted Services calculation");
});
