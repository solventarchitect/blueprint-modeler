import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { watchForeignRequests } from "./network";

const palette = (page: Page) => page.getByRole("navigation", { name: "Element palette" });
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const canvasNode = (page: Page, name: string) => page.locator(".react-flow__node").filter({ hasText: name });

async function openEditor(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
}

async function addNamed(page: Page, cls: string, name: string) {
  await palette(page).getByRole("button", { name: cls, exact: true }).click();
  const field = inspector(page).getByLabel("Name", { exact: true });
  await expect(field).toBeFocused();
  await field.fill(name);
  await field.press("Enter");
  await expect(canvasNode(page, name)).toBeVisible();
}

test.describe("editor (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only; mobile has its own test");

  test("add, name, connect with an allowed type, and survive a reload", async ({ page }) => {
    await openEditor(page);
    await addNamed(page, "Business Application", "Checkout");
    await addNamed(page, "Application Service", "Checkout prod");
    await addNamed(page, "Host", "web-01");

    // Lanes are far enough apart that three layers can outgrow the canvas at 100%: fit first.
    await page.getByRole("button", { name: "Fit View" }).click();
    // Keyboard path: select the service, then connect it to its host via the inspector.
    await canvasNode(page, "Checkout prod").click();
    const connect = inspector(page).getByLabel("Add a relationship");
    await connect.selectOption({ label: "→ web-01 (Depends on::Used by)" });
    await inspector(page).getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // A business application cannot reach infrastructure directly: the host is not offered.
    await canvasNode(page, "Checkout").first().click();
    const options = await inspector(page).getByLabel("Add a relationship").locator("option").allTextContents();
    expect(options).toContain("→ Checkout prod (Uses::Used by)");
    expect(options.some((o) => o.includes("web-01"))).toBe(false);
    await inspector(page).getByLabel("Add a relationship").selectOption({ label: "→ Checkout prod (Uses::Used by)" });
    await inspector(page).getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);

    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.reload();
    await expect(canvasNode(page, "Checkout prod")).toBeVisible();
    await expect(canvasNode(page, "web-01")).toBeVisible();
    await expect(page.locator(".react-flow__edge")).toHaveCount(2);
  });

  test("dragging a disallowed connection explains why and creates nothing", async ({ page }) => {
    await openEditor(page);
    await addNamed(page, "Business Application", "Billing");
    await addNamed(page, "Host", "db-01");
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    // New nodes are placed in their layer's lane, which can sit at (or past) the canvas edge; fit
    // first so both handles are fully on screen before the drag.
    await page.getByRole("button", { name: "Fit View" }).click();
    await canvasNode(page, "Billing").locator(".react-flow__handle-bottom").dragTo(canvasNode(page, "db-01").locator(".react-flow__handle-top"));
    await expect(page.getByRole("status")).toContainText("not related directly");
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  });

  test("undo and redo from the toolbar and the keyboard", async ({ page }) => {
    await openEditor(page);
    await addNamed(page, "Business Capability", "Order management");
    await page.getByRole("button", { name: "Undo" }).click(); // rename
    await page.getByRole("button", { name: "Undo" }).click(); // add
    await expect(canvasNode(page, "Order management")).toHaveCount(0);
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } }); // clear of the empty-state card
    await page.keyboard.press("Control+Shift+Z");
    await page.keyboard.press("Control+Shift+Z");
    await expect(canvasNode(page, "Order management")).toBeVisible();
    await page.keyboard.press("Control+Z");
    await expect(canvasNode(page, "New Business Capability")).toBeVisible();
  });

  test("keyboard only: palette → name → delete", async ({ page }) => {
    await openEditor(page);
    const add = palette(page).getByRole("button", { name: "Information Object", exact: true });
    await add.focus();
    await page.keyboard.press("Enter");
    const field = inspector(page).getByLabel("Name", { exact: true });
    await expect(field).toBeFocused();
    await page.keyboard.type("Customer data");
    await page.keyboard.press("Enter");
    await expect(canvasNode(page, "Customer data")).toBeVisible();
    await inspector(page).getByRole("button", { name: "Delete element" }).focus();
    await page.keyboard.press("Enter");
    await expect(canvasNode(page, "Customer data")).toHaveCount(0);
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`editor has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openEditor(page);
      await addNamed(page, "Business Application", "Checkout");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("the editor makes no requests beyond its own origin", async ({ page, baseURL }) => {
    const foreign = watchForeignRequests(page, baseURL);
    await openEditor(page);
    await addNamed(page, "Business Application", "Checkout");
    await page.waitForLoadState("networkidle");
    expect(foreign).toEqual([]);
  });
});

test("mobile shows the model read-only with a clear note", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/editor");
  await expect(page.getByText("Editing needs a screen at least 768px wide")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Element palette" })).toHaveCount(0);
});
