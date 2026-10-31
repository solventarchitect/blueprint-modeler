import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

// M68: plan status (Live, Planned, Retiring) and the current and target state views.
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const bar = (page: Page) => page.getByTestId("plan-bar");

async function start(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await saved(page);
}

async function stateShown(page: Page, which: "Both" | "Current" | "Target") {
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("group", { name: "State shown" }).getByRole("button", { name: which, exact: true }).click();
  await page.keyboard.press("Escape");
}

test.describe("plan status and current or target state (M68, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("mark an element Planned and a relationship Retiring; Current and Target leave them out; one undo step each; kept after a reload", async ({ page }) => {
    await start(page);

    // An element: Planned, dashed and said in words.
    await node(page, "Orders database").click();
    await inspector(page).getByRole("combobox", { name: "Plan status", exact: true }).selectOption("planned");
    await expect(node(page, "Orders database").locator("[data-plan]")).toHaveAttribute("data-plan", "planned");
    await expect(node(page, "Orders database").getByTestId("plan-tag")).toHaveText("· Planned");
    await expect(node(page, "Orders database")).toHaveAttribute("aria-label", /\(planned\)/);

    // A relationship of another element: Retiring.
    await node(page, "web-prod-01").click();
    const rel = inspector(page).getByLabel(/^Plan status of relationship/).first();
    await rel.selectOption("retiring");
    await expect(page.locator(".react-flow__edge.plan-retiring")).toHaveCount(1);

    // Current state: what is planned, and what touches it, is left out.
    await stateShown(page, "Current");
    await expect(bar(page)).toContainText("Current state");
    await expect(bar(page)).toContainText(/Leaves out 1 element and \d+ relationships?/);
    await expect(node(page, "Orders database")).toBeHidden();
    await expect(page.locator(".react-flow__edge.plan-retiring")).toHaveCount(1);
    expect(await new AxeBuilder({ page }).withTags(tags).include('[data-testid="plan-bar"]').analyze().then((r) => r.violations)).toEqual([]);

    // Target state: the retiring relationship goes; the planned element is back.
    await stateShown(page, "Target");
    await expect(bar(page)).toContainText("Target state");
    await expect(node(page, "Orders database")).toBeVisible();
    await expect(page.locator(".react-flow__edge.plan-retiring")).toBeHidden();

    await bar(page).getByRole("button", { name: "Show current and target" }).click();
    await expect(bar(page)).toHaveCount(0);
    await expect(page.locator(".react-flow__edge.plan-retiring")).toBeVisible();

    // One undo step each: the relationship, then the element.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".react-flow__edge.plan-retiring")).toHaveCount(0);
    await expect(node(page, "Orders database").locator("[data-plan]")).toHaveAttribute("data-plan", "planned");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(node(page, "Orders database").locator("[data-plan]")).toHaveCount(0);
    await page.getByRole("button", { name: "Redo" }).click();
    await page.getByRole("button", { name: "Redo" }).click();

    // Kept: saved in the browser.
    await saved(page);
    await page.reload();
    await saved(page);
    await expect(node(page, "Orders database").locator("[data-plan]")).toHaveAttribute("data-plan", "planned");
    await expect(page.locator(".react-flow__edge.plan-retiring")).toHaveCount(1);
  });

  test("Go to an element the current state leaves out shows both again; the table edits plan status", async ({ page }) => {
    await start(page);
    await node(page, "Checkout web app").click();
    await inspector(page).getByRole("combobox", { name: "Plan status", exact: true }).selectOption("retiring");
    await expect(node(page, "Checkout web app").locator("p.line-through")).toHaveText("Checkout web app");
    await stateShown(page, "Target");
    await expect(node(page, "Checkout web app")).toBeHidden();
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveCount(0);

    // The table still lists it, with its plan status, and edits it.
    await page.getByTestId("model-menu-button").click();
    await page.getByRole("button", { name: "Table…" }).click();
    const table = page.getByTestId("table-dialog");
    const plan = table.getByLabel("Plan status of Checkout web app");
    await expect(plan).toHaveValue("retiring");
    await table.getByLabel("Plan status of Orders database").selectOption("planned");
    await table.getByRole("button", { name: "Go to Checkout web app" }).click();
    await expect(bar(page)).toHaveCount(0);
    await expect(node(page, "Checkout web app")).toBeVisible();
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue("Checkout web app");
    await expect(node(page, "Orders database").locator("[data-plan]")).toHaveAttribute("data-plan", "planned");
  });
});
