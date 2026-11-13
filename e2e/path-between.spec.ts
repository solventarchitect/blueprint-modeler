import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M91: the shortest chain of relationships between two selected elements, shown and said.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const panel = (page: Page) => page.getByTestId("selection-panel");
const strip = (page: Page) => page.getByRole("region", { name: "Path", exact: true });
const said = (page: Page, text: string) => expect(page.getByRole("status").filter({ hasText: text })).toHaveCount(1);

const model = {
  schema: 1,
  id: "e2e-path",
  name: "Shop",
  created: "2026-11-13T00:00:00.000Z",
  updated: "2026-11-13T00:00:00.000Z",
  nodes: [
    { id: "cap", class: "business_capability", name: "Sell online" },
    { id: "ba", class: "business_application", name: "Shop" },
    { id: "svc", class: "application_service", name: "Shop production" },
    { id: "app", class: "application", name: "shop.war" },
    { id: "db", class: "application", name: "Orders database" },
    { id: "host", class: "host", name: "web-01" },
    { id: "alone", class: "host", name: "spare-01" },
  ],
  edges: [
    { id: "e1", from: "cap", to: "ba", type: "Provided by::Provides" },
    { id: "e2", from: "ba", to: "svc", type: "Uses::Used by" },
    { id: "e3", from: "svc", to: "app", type: "Depends on::Used by" },
    { id: "e4", from: "svc", to: "db", type: "Depends on::Used by" },
    { id: "e5", from: "app", to: "host", type: "Runs on::Runs" },
    { id: "e6", from: "db", to: "host", type: "Runs on::Runs" },
  ],
  layout: { cap: { x: 0, y: 0 }, ba: { x: 0, y: 200 }, svc: { x: 0, y: 400 }, app: { x: -200, y: 600 }, db: { x: 200, y: 600 }, host: { x: 0, y: 800 }, alone: { x: 500, y: 0 } },
};

async function open(page: Page) {
  // Reduced motion: the whole path at once, not played step by step.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/editor");
  await saved(page);
  await page.getByTestId("import-file").setInputFiles({ name: "shop.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(model)) });
  await expect(currentModel(page)).toHaveText("Shop");
  await expect(page.locator(".react-flow__edge")).toHaveCount(6);
}

/** Shift+click, holding Shift until React Flow has seen it (as in guides.spec). */
async function shiftClick(page: Page, n: Locator) {
  await page.keyboard.down("Shift");
  await expect(page.locator(".react-flow__pane.selection")).toBeAttached();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await n.click();
  await page.keyboard.up("Shift");
}

async function select(page: Page, a: string, b: string) {
  await node(page, a).click();
  await shiftClick(page, node(page, b));
  await expect(panel(page).getByRole("heading", { name: "2 elements selected" })).toBeVisible();
}

/** From the relationship's own menu (Delete on the keyboard would act on the two selected elements). */
async function deleteEdge(page: Page, id: string) {
  await page.getByTestId(`rf__edge-${id}`).focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menu", { name: "Relationship menu" }).getByRole("menuitem", { name: "Delete relationship" }).click();
}

test.describe("path between two elements (M91, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "selecting several is on the desktop");

  test("two selected: the chain between them is marked, said in words, and each equally short one can be stepped to", async ({ page }) => {
    await open(page);
    // Picked bottom first: the path still reads in the model's order, top to bottom.
    await select(page, "web-01", "Sell online");
    await panel(page).getByRole("button", { name: "Show how these connect" }).click();

    await expect(strip(page).getByRole("heading", { name: "How Sell online and web-01 connect" })).toBeVisible();
    await said(page, "Path from Sell online to web-01, 4 steps: Sell online → Shop (Provided by) → Shop production (Uses) → shop.war (Depends on) → web-01 (Runs on). Path 1 of 2 this short.");
    await expect(page.getByTestId("blast-progress")).toHaveText("Step 4 of 4");
    await expect(page.getByTestId("path-count")).toHaveText("Path 1 of 2");
    await expect(node(page, "Sell online")).toHaveAttribute("aria-label", /\(start of the path\)/);
    await expect(node(page, "shop.war")).toHaveAttribute("aria-label", /\(step 3 of the path\)/);
    await expect(node(page, "web-01")).toHaveAttribute("aria-label", /\(step 4 of the path\)/);
    await expect(node(page, "Orders database")).not.toHaveAttribute("aria-label", /of the path/);
    await expect(page.getByTestId("rf__edge-e5")).toHaveAttribute("aria-label", /\(a step of the path\)/);
    await expect(page.getByTestId("rf__edge-e6")).not.toHaveAttribute("aria-label", /of the path/);
    await expect(strip(page).getByRole("button", { name: "Previous path" })).toHaveAttribute("aria-disabled", "true");
    expect(await new AxeBuilder({ page }).withTags(axeTags).include('[role="region"][aria-label="Path"]').analyze().then((r) => r.violations)).toEqual([]);

    // The steps, listed.
    await strip(page).getByText("Steps (5)").click();
    await expect(strip(page).getByRole("list", { name: "Steps" }).getByRole("listitem")).toHaveText([
      "Start: Sell online",
      "Step 1: Sell online → Shop (Provided by)",
      "Step 2: Shop → Shop production (Uses)",
      "Step 3: Shop production → shop.war (Depends on)",
      "Step 4: shop.war → web-01 (Runs on)",
    ]);

    // The other chain as short.
    await strip(page).getByRole("button", { name: "Next path" }).click();
    await said(page, "Path from Sell online to web-01, 4 steps: Sell online → Shop (Provided by) → Shop production (Uses) → Orders database (Depends on) → web-01 (Runs on). Path 2 of 2 this short.");
    await expect(page.getByTestId("path-count")).toHaveText("Path 2 of 2");
    await expect(node(page, "Orders database")).toHaveAttribute("aria-label", /\(step 3 of the path\)/);
    await expect(node(page, "shop.war")).not.toHaveAttribute("aria-label", /of the path/);
    await expect(strip(page).getByRole("button", { name: "Next path" })).toBeFocused();
    await expect(strip(page).getByRole("button", { name: "Next path" })).toHaveAttribute("aria-disabled", "true");

    // Stepping back through it says each step.
    await strip(page).getByRole("button", { name: "Previous step" }).click();
    await said(page, "Step 3: Shop production → Orders database (Depends on).");

    await strip(page).getByRole("button", { name: "Close" }).click();
    await said(page, "Path closed.");
    await expect(strip(page)).toHaveCount(0);
    await expect(node(page, "web-01")).not.toHaveAttribute("aria-label", /of the path/);
    // Nothing was changed by looking.
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  test("from the selection's menu and the command palette; two elements nothing joins are said to be unconnected", async ({ page }) => {
    await open(page);
    await select(page, "shop.war", "Orders database");
    await node(page, "shop.war").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Show how these connect" }).click();
    // Two elements with a shared neighbor either side: up and down, or down and up, against an arrow each time.
    await said(page, "Path from shop.war to Orders database, 2 steps: shop.war → Shop production (Used by) → Orders database (Depends on). Path 1 of 2 this short.");
    await strip(page).getByRole("button", { name: "Next path" }).click();
    await said(page, "Path from shop.war to Orders database, 2 steps: shop.war → web-01 (Runs on) → Orders database (Runs). Path 2 of 2 this short.");
    await page.keyboard.press("Escape");
    await expect(strip(page)).toHaveCount(0);

    await panel(page).getByRole("button", { name: "Clear selection" }).click();
    // The view zoomed to the path: fit the whole model again to reach the other elements.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Shift+Digit1");
    await expect(node(page, "Sell online")).toBeInViewport({ ratio: 0.9 });
    await expect(node(page, "spare-01")).toBeInViewport({ ratio: 0.9 });
    await select(page, "Sell online", "spare-01");
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Commands" }).getByRole("combobox", { name: "Search commands" }).fill("how connect");
    await expect(page.getByRole("dialog", { name: "Commands" }).getByRole("option").first()).toContainText("Show how “Sell online” and “spare-01” connect");
    await page.keyboard.press("Enter");
    await said(page, "Sell online and spare-01 are not connected: no chain of relationships joins them.");
    await expect(strip(page)).toHaveCount(0);
  });

  test("it follows the model: when the chain it shows is broken, the next shortest takes its place, or it closes", async ({ page }) => {
    await open(page);
    await select(page, "Shop production", "web-01");
    await panel(page).getByRole("button", { name: "Show how these connect" }).click();
    await expect(page.getByTestId("path-count")).toHaveText("Path 1 of 2");
    await strip(page).getByRole("button", { name: "Next path" }).click();
    await expect(node(page, "Orders database")).toHaveAttribute("aria-label", /\(step 1 of the path\)/);

    // Delete the relationship the second path walks: one path is left, and it is shown.
    await deleteEdge(page, "e6");
    await expect(page.locator(".react-flow__edge")).toHaveCount(5);
    await expect(page.getByTestId("path-count")).toHaveCount(0);
    await expect(node(page, "shop.war")).toHaveAttribute("aria-label", /\(step 1 of the path\)/);

    // And the last one: nothing joins them any more, so the strip closes.
    await deleteEdge(page, "e5");
    await expect(page.locator(".react-flow__edge")).toHaveCount(4);
    await expect(strip(page)).toHaveCount(0);
  });
});
