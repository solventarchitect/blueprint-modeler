import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

// M78: architecture decision records kept with the model.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const decisions = (page: Page) => inspector(page).getByTestId("inspector-decisions");
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const dialog = (page: Page) => page.getByTestId("decisions-dialog");
const editor = (page: Page) => dialog(page).getByTestId("decision-editor");

async function select(page: Page, name: string) {
  await node(page, name).click();
  await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue(name);
}

test.describe("decisions (M78, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("made from an element, filled in, saved, shown in its Inspector, kept in the file and the model book", async ({ page }) => {
    await page.addInitScript(() => {
      window.print = () => {};
    });
    await page.goto("/editor");
    await saved(page);
    await openExample(page, "Online Store Checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");

    await select(page, "Orders database");
    await expect(decisions(page)).toContainText("No decisions about this element.");
    await decisions(page).getByRole("button", { name: "New decision about this element…" }).click();
    await expect(dialog(page).getByRole("heading", { name: "New decision about Orders database" })).toBeVisible();
    await expect(dialog(page).getByLabel("New decision title")).toBeFocused();
    await dialog(page).getByLabel("New decision title").fill("Cache the product catalog");
    await dialog(page).getByLabel("New decision title").press("Enter");
    await expect(dialog(page).getByRole("status")).toContainText("Made decision “Cache the product catalog”, about Orders database.");
    await expect(editor(page).getByLabel("Context")).toBeFocused();

    await editor(page).getByLabel("Context").fill("Catalog reads dominate checkout traffic.");
    await editor(page).getByLabel("Decision", { exact: true }).fill("Put a read-through cache in front of the catalog.");
    await editor(page).getByLabel("Status").selectOption("accepted");
    await expect(editor(page).getByRole("listitem")).toHaveText([/Orders database/]);
    await editor(page).getByLabel("Add an element").selectOption({ label: "Checkout web app (Application)" });
    await expect(editor(page).getByRole("listitem")).toHaveText([/Orders database/, /Checkout web app/]);
    await editor(page).getByRole("button", { name: "Save decision" }).click();
    await expect(dialog(page).getByRole("status")).toContainText("Saved decision “Cache the product catalog”.");
    await expect(editor(page).getByRole("button", { name: "Save decision" })).toBeDisabled();
    await expect(dialog(page).getByTestId("decision")).toHaveText([/Cache the product catalog\s*Accepted · .* · 2 elements/]);
    expect(await new AxeBuilder({ page }).withTags(axeTags).include('[data-testid="decisions-dialog"]').analyze().then((r) => r.violations)).toEqual([]);

    // A change not saved yet is kept when the dialog closes.
    await editor(page).getByLabel("Consequences").fill("Prices can be a minute stale.");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);

    // The Inspector of each element it concerns lists it, and opens the dialog on it.
    await select(page, "Checkout web app");
    await expect(decisions(page).getByRole("listitem")).toHaveText(["Cache the product catalog (Accepted)"]);
    await decisions(page).getByRole("button", { name: "Cache the product catalog" }).click();
    await expect(dialog(page).getByRole("button", { name: "Cache the product catalog", pressed: true })).toBeVisible();
    await expect(editor(page).getByLabel("Consequences")).toHaveValue("Prices can be a minute stale.");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await saved(page);

    // In the file, after the flows, as the reader keeps it.
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Model file \(JSON\)/ }).click()]);
    const json = JSON.parse(await readFile((await download.path())!, "utf8"));
    const ids = (names: string[]) => names.map((n) => json.nodes.find((x: { name: string }) => x.name === n).id);
    expect(json.decisions).toEqual([
      {
        id: expect.any(String),
        title: "Cache the product catalog",
        status: "accepted",
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        context: "Catalog reads dominate checkout traffic.",
        decision: "Put a read-through cache in front of the catalog.",
        consequences: "Prices can be a minute stale.",
        elements: ids(["Orders database", "Checkout web app"]),
      },
    ]);

    // The model book has it, by name.
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("button", { name: /^Model book…/ }).click();
    const book = page.locator("#bm-print .bm-book");
    await expect(book.locator("section").filter({ has: page.locator("h2", { hasText: "Decisions" }) }).locator("h3")).toHaveText(["Cache the product catalog"]);
    await expect(book).toContainText("Concerns Checkout web app, Orders database");
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));

    // Deleting the decision is asked first, then one undo step brings it back.
    await page.getByTestId("model-menu-button").click();
    await page.getByRole("button", { name: "Decisions…" }).click();
    await editor(page).getByRole("button", { name: "Delete decision…" }).click();
    await expect(editor(page).getByRole("button", { name: "Delete", exact: true })).toBeFocused();
    await editor(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog(page).getByRole("status")).toContainText("Deleted decision “Cache the product catalog”. Undo brings it back.");
    await expect(dialog(page).getByTestId("decision")).toHaveCount(0);
    await expect(dialog(page).getByLabel("New decision title")).toBeFocused();
  });
});
