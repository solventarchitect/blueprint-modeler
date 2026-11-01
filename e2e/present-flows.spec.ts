import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel, modelButton } from "./model-menu";

// M73: Present steps through a saved flow as well as the layers.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const dialog = (page: Page) => page.getByTestId("flows-dialog");
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const bar = (page: Page) => page.getByRole("region", { name: "Presentation" });
const stepLine = (page: Page) => page.getByTestId("present-step");

async function withFlow(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await modelButton(page).click();
  await page.getByRole("button", { name: "Saved flows…" }).click();
  await dialog(page).getByLabel("New flow name").fill("Customer places an order");
  await dialog(page).getByRole("button", { name: "Make flow" }).click();
  await dialog(page).getByLabel("Starts at").selectOption({ label: "Online shopping — North America (Business Service Offering)" });
  for (const text of ["Online shopping — North America → Checkout — production (Depends on)", "Checkout — production → Checkout web app (Depends on)"]) {
    await dialog(page).getByLabel(/^Next step/).selectOption({ label: text });
    await dialog(page).getByRole("button", { name: "Add step" }).click();
  }
  await dialog(page).getByRole("button", { name: "Close" }).click();
  await saved(page);
}

test.describe("flows in Present (M73, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "flows are made on the desktop");

  test("Show a flow in Present, step with the keys a clicker sends, back to the layers; Exit ends it", async ({ page }) => {
    await withFlow(page);
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(bar(page)).toBeVisible();
    await expect(stepLine(page)).toContainText("Overview · 1 of");

    await bar(page).getByLabel("Show").selectOption({ label: "Flow: Customer places an order" });
    await expect(stepLine(page)).toContainText("Customer places an order · Start · 2 steps");
    await expect(node(page, "Online shopping — North America").getByTestId("blast-badge")).toBeVisible();
    await expect(bar(page).getByRole("button", { name: /Previous/ })).toBeDisabled();
    expect(await new AxeBuilder({ page }).withTags(axeTags).include('[aria-label="Presentation"]').analyze().then((r) => r.violations)).toEqual([]);

    // A clicker sends Page Down and Page Up; the arrows work too.
    await bar(page).getByRole("button", { name: "Exit" }).focus();
    await page.keyboard.press("PageDown");
    await expect(stepLine(page)).toContainText("Step 1 of 2");
    await expect(stepLine(page)).toContainText("Step 1: Online shopping — North America to Checkout — production.");
    await page.keyboard.press("ArrowRight");
    await expect(stepLine(page)).toContainText("Step 2 of 2");
    await expect(node(page, "Checkout web app").getByTestId("blast-badge")).toHaveText("2");
    await expect(bar(page).getByRole("button", { name: /Next/ })).toBeDisabled();
    await page.keyboard.press("PageUp");
    await expect(stepLine(page)).toContainText("Step 1 of 2");
    await page.keyboard.press("Home");
    await expect(stepLine(page)).toContainText("Start");

    // Back to the layers.
    await bar(page).getByLabel("Show").selectOption({ label: "Layers" });
    await expect(stepLine(page)).toContainText("Overview · 1 of");
    await expect(page.getByTestId("blast-badge")).toHaveCount(0);

    // Exit: the flow doesn't stay open in the editor.
    await bar(page).getByLabel("Show").selectOption({ label: "Flow: Customer places an order" });
    await page.keyboard.press("Escape");
    await expect(bar(page)).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Saved flow" })).toHaveCount(0);
    await expect(page.getByTestId("blast-badge")).toHaveCount(0);
  });

  test("the palette presents a flow straight away", async ({ page }) => {
    await withFlow(page);
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Present flow");
    await page.keyboard.press("Enter");
    await expect(bar(page)).toBeVisible();
    await expect(stepLine(page)).toContainText("Customer places an order · Start");
    await expect(bar(page).getByLabel("Show")).toHaveValue(/.+/);
  });

  test("a model without flows has no Show choice", async ({ page }) => {
    await page.goto("/editor?example=checkout");
    await saved(page);
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(bar(page)).toBeVisible();
    await expect(bar(page).getByLabel("Show")).toHaveCount(0);
  });
});
