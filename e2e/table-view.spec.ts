import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel, modelButton } from "./model-menu";

// M67: the table view, every element and relationship as rows; elements edited in place.
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const dialog = (page: Page) => page.getByTestId("table-dialog");
const rows = (page: Page) => dialog(page).getByTestId("elements-table").locator("tbody tr");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });

async function start(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await saved(page);
}

async function openTable(page: Page) {
  await modelButton(page).click();
  await page.getByRole("button", { name: "Table…" }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("heading", { name: "Table of “Online Store Checkout”" })).toBeVisible();
}

test.describe("table view (M67, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the Model menu is on the desktop toolbar");

  test("sort, filter, edit in place (one undo step each), go to an element; axe passes", async ({ page }) => {
    await start(page);
    await openTable(page);
    await expect(rows(page)).toHaveCount(14);
    expect(await new AxeBuilder({ page }).withTags(tags).include('[data-testid="table-dialog"]').analyze().then((r) => r.violations)).toEqual([]);

    // Sort by name, then the other way.
    const nameHeader = dialog(page).getByRole("columnheader", { name: "Name" });
    await nameHeader.getByRole("button").click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
    await expect(rows(page).first().getByRole("textbox").first()).toHaveValue("Application hosting");
    await nameHeader.getByRole("button").click();
    await expect(nameHeader).toHaveAttribute("aria-sort", "descending");
    await expect(rows(page).first().getByRole("textbox").first()).toHaveValue("web-test-01");

    // Filter: any text in a row.
    await dialog(page).getByLabel("Filter").fill("host");
    await expect(rows(page)).toHaveCount(5);
    await expect(dialog(page).getByRole("status")).toContainText("5 of 14 elements match.");
    await dialog(page).getByLabel("Filter").fill("");

    // Owner, then life cycle stage: each saved as it is set.
    const owner = dialog(page).getByLabel("Owner of Checkout web app");
    await owner.fill("Team Storefront");
    await owner.press("Enter");
    await dialog(page).getByLabel("Life cycle stage of Checkout web app").selectOption("Operational");
    // Escape puts back an unsaved edit and keeps the dialog open.
    const env = dialog(page).getByLabel("Environment of Checkout web app");
    await env.fill("Nowhere");
    await env.press("Escape");
    await expect(env).toHaveValue("");
    await expect(dialog(page)).toBeVisible();

    // Go to: the dialog closes and the element is selected, with what was set.
    await dialog(page).getByRole("button", { name: "Go to Checkout web app" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator("#tab-details")).toBeFocused();
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue("Checkout web app");
    await expect(inspector(page).getByLabel("Owner")).toHaveValue("Team Storefront");
    await expect(inspector(page).getByLabel("Life cycle stage")).toHaveValue("Operational");

    // One undo step each.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(inspector(page).getByLabel("Life cycle stage")).toHaveValue("");
    await expect(inspector(page).getByLabel("Owner")).toHaveValue("Team Storefront");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(inspector(page).getByLabel("Owner")).toHaveValue("");
  });

  test("renaming in the table: trimmed, never empty, the row stays put while edited; Close returns focus", async ({ page }) => {
    await start(page);
    await openTable(page);
    const name = dialog(page).getByLabel("Name of Orders database");
    await name.fill("Order store");
    await name.press("Tab");
    await expect(dialog(page).getByLabel("Name of Order store")).toHaveValue("Order store");
    // Left empty, a name keeps what it had; spaces around it are not kept.
    const renamed = dialog(page).getByLabel("Name of Order store");
    await renamed.fill("");
    await renamed.press("Enter");
    await expect(renamed).toHaveValue("Order store");
    // Filtered, an edit that no longer matches keeps its row (and focus) until focus leaves the rows.
    await dialog(page).getByLabel("Filter").fill("Order store");
    await expect(rows(page)).toHaveCount(1);
    const env = dialog(page).getByLabel("Environment of Order store");
    await env.fill("  Production ");
    await env.press("Tab");
    await expect(env).toHaveValue("Production");
    await expect(dialog(page).getByLabel("Owner of Order store")).toBeFocused();
    await renamed.focus();
    await renamed.fill("Ledger");
    await renamed.press("Tab");
    await expect(rows(page)).toHaveCount(1);
    await expect(dialog(page).getByLabel("Name of Ledger")).toHaveValue("Ledger");
    await dialog(page).getByLabel("Filter").focus();
    await expect(rows(page)).toHaveCount(0);
    await dialog(page).getByLabel("Filter").fill("Ledger");
    await expect(rows(page)).toHaveCount(1);
    await dialog(page).getByLabel("Name of Ledger").fill("Order store");
    await dialog(page).getByLabel("Name of Ledger").press("Enter");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(modelButton(page)).toBeFocused();
    const node = (n: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(n, { exact: true }) });
    await expect(node("Order store")).toBeVisible();
    // Undo takes back the last rename only.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(node("Ledger")).toBeVisible();
  });

  test("relationships tab, arrow keys between tabs, and CSV with the rows shown", async ({ page }) => {
    await start(page);
    await openTable(page);
    const elementsTab = dialog(page).getByRole("tab", { name: "Elements (14)" });
    await elementsTab.focus();
    await page.keyboard.press("ArrowRight");
    const relTab = dialog(page).getByRole("tab", { name: "Relationships (13)" });
    await expect(relTab).toBeFocused();
    await expect(relTab).toHaveAttribute("aria-selected", "true");
    await expect(dialog(page).getByTestId("relationships-table").locator("tbody tr")).toHaveCount(13);

    await dialog(page).getByLabel("Filter").fill("db-prod-01");
    const relRows = dialog(page).getByTestId("relationships-table").locator("tbody tr");
    const n = await relRows.count();
    expect(n).toBeGreaterThan(0);
    const [download] = await Promise.all([page.waitForEvent("download"), dialog(page).getByRole("button", { name: "Save as CSV" }).click()]);
    expect(download.suggestedFilename()).toMatch(/-relationships\.csv$/);
    const csv = await readFile((await download.path())!, "utf8");
    expect(csv.startsWith("﻿From,Relationship,To,Plan status\r\n")).toBe(true);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(n + 1);
    await expect(dialog(page).getByRole("status")).toContainText(`Saved ${n} row`);

    await page.keyboard.press("ArrowLeft");
    await dialog(page).getByRole("tab", { name: "Elements (14)" }).click();
    await dialog(page).getByLabel("Filter").fill("");
    const [els] = await Promise.all([page.waitForEvent("download"), dialog(page).getByRole("button", { name: "Save as CSV" }).click()]);
    const elCsv = await readFile((await els.path())!, "utf8");
    expect(elCsv.split("\r\n")[0]).toBe("﻿Name,Class,Layer,Life cycle stage,Environment,Owner,Plan status,Record number,Relationships,Hints");
    expect(elCsv.split("\r\n").filter(Boolean)).toHaveLength(15);
  });

  test("from the command palette; read-only once the window is narrower than 768px", async ({ page }) => {
    await start(page);
    await page.keyboard.press(`${mod}+k`);
    const palette = page.getByRole("dialog", { name: "Commands" });
    await palette.getByRole("combobox", { name: "Search commands" }).fill("Table");
    await page.keyboard.press("Enter");
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByLabel("Owner of Checkout web app")).toBeVisible();
    await page.setViewportSize({ width: 700, height: 800 });
    await expect(dialog(page).getByLabel("Owner of Checkout web app")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(14);
    await expect(dialog(page)).toContainText("editing needs a screen at least 768px wide");
  });
});
