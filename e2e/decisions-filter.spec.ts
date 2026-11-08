import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M88: Filter and color › Decisions: Has decisions, No decisions.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const dialog = (page: Page) => page.getByTestId("view-dialog");
const viewsButton = (page: Page) => page.getByRole("button", { name: /^Views/ });
const faded = (page: Page) => page.locator(".react-flow__node.bm-faded");
const decisionsGroup = (page: Page) => dialog(page).getByRole("group", { name: "Decisions", exact: true });
async function openFilter(page: Page) {
  await viewsButton(page).click();
  await page.getByTestId("views-menu").getByRole("button", { name: "Filter and color…" }).click();
}

test.describe("filter by decisions (M88, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("offered once a decision concerns an element; keeps those elements, or the rest; kept in a saved view", async ({ page }) => {
    await page.goto("/editor?example=checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await saved(page);

    // No decisions yet: nothing to filter on.
    await openFilter(page);
    await expect(decisionsGroup(page)).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Close" }).click();

    await node(page, "Orders database").click();
    await page.getByRole("complementary", { name: "Inspector" }).getByRole("button", { name: "New decision about this element…" }).click();
    const decisions = page.getByTestId("decisions-dialog");
    await decisions.getByLabel("New decision title").fill("Cache the product catalog");
    await decisions.getByLabel("New decision title").press("Enter");
    await decisions.getByLabel("Add an element").selectOption({ label: "Checkout web app (Application)" });
    await decisions.getByRole("button", { name: "Save decision" }).click();
    await decisions.getByRole("button", { name: "Close" }).click();
    await page.keyboard.press("Escape");

    await openFilter(page);
    await decisionsGroup(page).getByLabel("Has decisions", { exact: true }).check();
    await expect(dialog(page).getByTestId("view-count")).toHaveText("Showing 2 of 14 elements");
    expect(await new AxeBuilder({ page }).withTags(axeTags).include("[data-testid=view-dialog]").analyze().then((r) => r.violations)).toEqual([]);
    await dialog(page).getByLabel("View name").fill("Decided");
    await dialog(page).getByRole("button", { name: "Save as new view" }).click();
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(faded(page)).toHaveCount(12);
    await expect(node(page, "Orders database")).not.toHaveClass(/bm-faded/);
    await saved(page);

    // Kept over a reload, with the view.
    await page.reload();
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await viewsButton(page).click();
    await page.getByTestId("views-menu").getByRole("button", { name: /Decided/ }).click();
    await expect(faded(page)).toHaveCount(12);

    // The other way: the elements no decision concerns.
    await openFilter(page);
    await decisionsGroup(page).getByLabel("Has decisions", { exact: true }).uncheck();
    await decisionsGroup(page).getByLabel("No decisions", { exact: true }).check();
    await expect(dialog(page).getByTestId("view-count")).toHaveText("Showing 12 of 14 elements");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(faded(page)).toHaveCount(2);
    await expect(node(page, "Orders database")).toHaveClass(/bm-faded/);
  });
});
