import { deflateRawSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel, modelButton, modelMenu } from "./model-menu";

// M85: a decision superseded by another, shown both ways.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const dialog = (page: Page) => page.getByTestId("decisions-dialog");
const editor = (page: Page) => page.getByTestId("decision-editor");
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });

test.describe("decision links (M85, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("Superseded asks what replaced it; each decision links to the other; deleting the new one unlinks the old", async ({ page }) => {
    await page.goto("/editor?example=checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await saved(page);

    await node(page, "Orders database").click();
    await page.getByRole("complementary", { name: "Inspector" }).getByRole("button", { name: "New decision about this element…" }).click();
    await dialog(page).getByLabel("New decision title").fill("Cache the product catalog");
    await dialog(page).getByLabel("New decision title").press("Enter");
    await dialog(page).getByLabel("New decision title").fill("Serve the catalog from a CDN");
    await dialog(page).getByRole("button", { name: "Make decision" }).click();
    await expect(editor(page).getByRole("heading")).toHaveText("Decision “Serve the catalog from a CDN”");

    // Back to the first: Superseded asks which decision replaces it, and the question takes focus.
    await dialog(page).getByTestId("decision").getByRole("button", { name: "Cache the product catalog" }).click();
    await expect(editor(page).getByLabel("Superseded by")).toHaveCount(0);
    await editor(page).getByLabel("Status").selectOption("superseded");
    await expect(editor(page).getByLabel("Superseded by")).toBeFocused();
    await expect(editor(page).getByLabel("Superseded by").locator("option")).toHaveText(["Not chosen", "Serve the catalog from a CDN"]);
    await editor(page).getByLabel("Superseded by").selectOption({ label: "Serve the catalog from a CDN" });
    await editor(page).getByRole("button", { name: "Save decision" }).click();
    await expect(dialog(page).getByRole("status")).toHaveText("Saved decision “Cache the product catalog”.");
    await expect(dialog(page).getByTestId("decision").first()).toContainText("Superseded by “Serve the catalog from a CDN”");
    await expect(dialog(page).getByTestId("decision").last()).toContainText("Supersedes “Cache the product catalog”");

    // The link opens the new decision, which says what it supersedes; that link comes back.
    await editor(page).getByTestId("decision-links").getByRole("button", { name: "Serve the catalog from a CDN" }).click();
    await expect(editor(page).getByRole("heading")).toHaveText("Decision “Serve the catalog from a CDN”");
    await expect(editor(page).getByTestId("decision-links")).toHaveText("Supersedes Cache the product catalog");
    // The new one can't be superseded by the one it replaced: that would be a loop.
    await editor(page).getByLabel("Status").selectOption("superseded");
    await expect(editor(page).getByLabel("Superseded by")).toHaveCount(0);
    await expect(editor(page)).toContainText("Make the decision that replaces this one, then choose it here.");
    await editor(page).getByLabel("Status").selectOption("accepted");
    expect(await new AxeBuilder({ page }).withTags(axeTags).include("[data-testid=decisions-dialog]").analyze().then((r) => r.violations)).toEqual([]);

    // Deleting the new one leaves the old one Superseded, without the link.
    await editor(page).getByRole("button", { name: "Delete decision…" }).click();
    await editor(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog(page).getByTestId("decision")).toHaveCount(1);
    await expect(dialog(page).getByTestId("decision")).toHaveText(/Superseded/);
    await expect(dialog(page).getByTestId("decision")).not.toContainText("Superseded by");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await saved(page);

    // Undo brings the new one back, and the link with it; kept over a reload.
    await page.getByRole("button", { name: "Undo" }).click();
    await saved(page);
    await page.reload();
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await modelButton(page).click();
    await modelMenu(page).getByRole("button", { name: "Decisions…" }).click();
    await expect(dialog(page).getByTestId("decision")).toHaveCount(2);
    await expect(dialog(page).getByTestId("decision").first()).toContainText("Superseded by “Serve the catalog from a CDN”");
  });
});

/** A model whose first decision is superseded by the second, linked with Node's zlib. */
const model = {
  schema: 1,
  id: "e2e-view-links",
  name: "Payroll",
  created: "2026-11-01T00:00:00.000Z",
  updated: "2026-11-01T00:00:00.000Z",
  nodes: [{ id: "ba", class: "business_application", name: "Payroll" }],
  edges: [],
  layout: { ba: { x: 0, y: 160 } },
  decisions: [
    { id: "d1", title: "Run payroll on premises", status: "superseded", supersededBy: "d2", elements: ["ba"] },
    { id: "d2", title: "Run payroll in the cloud", status: "accepted", date: "2026-10-30" },
  ],
};

test("the view-only page says which decision superseded which, both ways", async ({ page }) => {
  await page.goto(`/view#model=1.${deflateRawSync(Buffer.from(JSON.stringify(model))).toString("base64url")}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Payroll");
  const decisions = page.getByTestId("view-decisions");
  await decisions.getByText("Decisions (2)").click();
  await expect(decisions).toContainText("Superseded · Superseded by “Run payroll in the cloud” · Concerns Payroll");
  await expect(decisions).toContainText("Accepted · Oct 30, 2026 · Supersedes “Run payroll on premises”");
  expect(await new AxeBuilder({ page }).withTags(axeTags).analyze().then((r) => r.violations)).toEqual([]);
});
