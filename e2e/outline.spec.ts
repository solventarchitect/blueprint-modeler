import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { settled } from "./layout";
import { currentModel } from "./model-menu";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const outline = (page: Page) => page.getByTestId("outline");

async function open(page: Page) {
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
}

async function openOutline(page: Page) {
  await page.getByRole("tab", { name: "Read" }).click();
  await page.getByRole("group", { name: "Read as" }).getByRole("button", { name: "Outline" }).click();
  await expect(outline(page)).toBeVisible();
}

test.describe("outline view and presentation (M55, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the side panel and present are desktop-only");
  test("the Read tab's outline lists every element under its layer, with its relationship count", async ({ page }) => {
    await open(page);
    await openOutline(page);
    await expect(outline(page).getByRole("heading")).toHaveText([/^Business/, /^Design/, /^Service/, /^Functional/, /^Infrastructure/]);
    await expect(outline(page).getByRole("listitem")).toHaveCount(14);
    // Named by kind and name; the details are its description.
    const cap = outline(page).getByRole("button", { name: "Business Capability Order management", exact: true });
    await expect(cap).toHaveAccessibleDescription("1 relationship");
    // The choice is kept while the tab is away.
    await page.getByRole("tab", { name: "Details" }).click();
    await page.getByRole("tab", { name: "Read" }).click();
    await expect(outline(page)).toBeVisible();
    await page.getByRole("group", { name: "Read as" }).getByRole("button", { name: "Sentences" }).click();
    await expect(outline(page)).toHaveCount(0);
    await expect(page.getByTestId("read-panel")).toContainText("is provided by");
  });

  test("choosing an element in the outline selects it on the canvas, keeps the outline and marks it current", async ({ page }) => {
    await open(page);
    await openOutline(page);
    const item = outline(page).getByRole("button", { name: /db-prod-01/ });
    await item.click();
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
    await expect(page.locator(".react-flow__node.selected")).toContainText("db-prod-01");
    await expect(page.getByRole("status")).toContainText("Selected Host “db-prod-01”.");
    await expect(item).toHaveAttribute("aria-current", "true");
    await expect(outline(page)).toBeVisible();
    // Keyboard: the outline is a list of buttons in reading order.
    await item.focus();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute("type", "button");
  });

  test("an element the view filters out says so, and choosing it lifts the filter", async ({ page }) => {
    await open(page);
    // Show only the Business layer.
    await page.getByRole("button", { name: /^Views/ }).click();
    await page.getByTestId("views-menu").getByRole("button", { name: "Filter and color…" }).click();
    const dialog = page.getByTestId("view-dialog");
    await dialog.getByRole("group", { name: "Layer", exact: true }).getByLabel("Business", { exact: true }).click();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.locator(".react-flow__node.bm-faded")).toHaveCount(13);
    await openOutline(page);
    const host = outline(page).getByRole("button", { name: /db-prod-01/ });
    await expect(host).toContainText("filtered out");
    await host.click();
    await expect(page.locator(".react-flow__node.bm-faded")).toHaveCount(0);
    await expect(page.locator(".react-flow__node.selected")).toContainText("db-prod-01");
  });

  test("present mode tells a screen reader what each step shows", async ({ page }) => {
    await open(page);
    await settled(page);
    await page.getByRole("button", { name: "Present" }).click();
    const step = page.getByTestId("present-step");
    const contents = page.getByTestId("present-contents");
    // The live line says where and how many, whole; the names are there to read, not announced each step.
    await expect(step).toHaveAttribute("aria-atomic", "true");
    await expect(step).toHaveText("Overview · 1 of 6. 14 elements in 5 layers.");
    await expect(contents).toHaveText("Next shows each layer in turn.");
    await page.keyboard.press("ArrowRight");
    await expect(step).toHaveText("Business · 2 of 6. 1 element.");
    await expect(contents).toHaveText("The Business layer: Order management (Business Capability).");
    await page.keyboard.press("ArrowRight");
    await expect(contents).toContainText("Checkout (Business Application)");
    await page.keyboard.press("Escape");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the outline passes WCAG 2.2 AA (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await openOutline(page);
      await outline(page).getByRole("button", { name: /Checkout web app/ }).click();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});
