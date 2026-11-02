import { readFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M80: decisions on the canvas, selected from the dialog, saved as CSV, and on the view-only page.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const dialog = (page: Page) => page.getByTestId("decisions-dialog");

test.describe("decisions everywhere (M80, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("a marker on each element a decision concerns; Select its elements; Save as CSV", async ({ page }) => {
    await page.goto("/editor?example=checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await saved(page);
    await expect(page.getByTestId("decision-marker")).toHaveCount(0);

    await node(page, "Orders database").click();
    await inspector(page).getByRole("button", { name: "New decision about this element…" }).click();
    await dialog(page).getByLabel("New decision title").fill("Cache the product catalog");
    await dialog(page).getByLabel("New decision title").press("Enter");
    await dialog(page).getByLabel("Add an element").selectOption({ label: "Checkout web app (Application)" });
    await dialog(page).getByRole("button", { name: "Save decision" }).click();

    // Save as CSV: the decisions, one row each.
    const [download] = await Promise.all([page.waitForEvent("download"), dialog(page).getByRole("button", { name: "Save as CSV" }).click()]);
    expect(download.suggestedFilename()).toBe("online-store-checkout-decisions.csv");
    const csv = await readFile((await download.path())!, "utf8");
    expect(csv.replace(/^﻿/, "").split("\r\n").slice(0, 2)).toEqual(["Title,Status,Date,Elements,Context,Decision,Consequences", expect.stringMatching(/^Cache the product catalog,Proposed,\d{4}-\d{2}-\d{2},Checkout web app; Orders database,,,$/)]);
    await expect(dialog(page).getByRole("status")).toContainText("Saved 1 decision as CSV.");

    // Select its elements: the dialog closes, both are selected and said.
    await dialog(page).getByRole("button", { name: "Select its elements" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator(".react-flow__node-csdm.selected")).toHaveCount(2);
    await expect(page.getByRole("status").filter({ hasText: "Selected 2 elements of decision “Cache the product catalog”." })).toHaveCount(1);
    await saved(page);

    // The marker, and the element's name says it.
    await expect(page.getByTestId("decision-marker")).toHaveCount(2);
    await expect(node(page, "Orders database")).toHaveAttribute("aria-label", /\(1 decision\)/);
    expect(await new AxeBuilder({ page }).withTags(axeTags).include(".react-flow__nodes").analyze().then((r) => r.violations)).toEqual([]);
  });
});

/** A small model with a decision, linked with Node's zlib (an encoder independent of the app's). */
const model = {
  schema: 1,
  id: "e2e-view-dec",
  name: "Payroll",
  created: "2026-11-01T00:00:00.000Z",
  updated: "2026-11-01T00:00:00.000Z",
  nodes: [
    { id: "ba", class: "business_application", name: "Payroll" },
    { id: "svc", class: "application_service", name: "Payroll — production" },
  ],
  edges: [{ id: "e1", from: "ba", to: "svc", type: "Uses::Used by" }],
  layout: { ba: { x: 0, y: 160 }, svc: { x: 0, y: 320 } },
  decisions: [{ id: "d1", title: "Run payroll in the cloud", status: "accepted", date: "2026-10-30", context: "The data center closes in 2027.", elements: ["ba"] }],
};

test("the view-only page lists the decisions, and each element's decisions in the model in words", async ({ page }) => {
  await page.goto(`/view#model=1.${deflateRawSync(Buffer.from(JSON.stringify(model))).toString("base64url")}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payroll");
  const decisions = page.getByTestId("view-decisions");
  await decisions.getByText("Decisions (1)").click();
  await expect(decisions.getByRole("heading", { name: "Run payroll in the cloud" })).toBeVisible();
  await expect(decisions).toContainText("Accepted · Oct 30, 2026 · Concerns Payroll");
  await expect(decisions).toContainText("The data center closes in 2027.");
  await page.getByText("The model in words").click();
  await expect(page.getByText("Decisions: Run payroll in the cloud")).toBeVisible();
  expect(await new AxeBuilder({ page }).withTags(axeTags).analyze().then((r) => r.violations)).toEqual([]);
});
