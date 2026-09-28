import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { contrastOf } from "./contrast";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ hasText: name });

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Online store checkout" });
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
}

/** A node's canvas position, read from its transform. */
async function position(page: Page, name: string) {
  const t = await node(page, name).evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\((-?[\d.]+)px, ?(-?[\d.]+)px\)/.exec(t)!;
  return { x: Number(m[1]), y: Number(m[2]) };
}

test.describe("moving layers (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("dragging a layer's label moves everything in it, as one undo step", async ({ page }) => {
    await openCheckout(page);
    const before = { a: await position(page, "Online shopping —"), b: await position(page, "Checkout — test"), other: await position(page, "web-prod-01") };
    const handle = page.getByRole("button", { name: /^Service layer, 6 elements/ });
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width / 2 + i * 12, box.y + box.height / 2 + i * 4);
    await page.mouse.up();
    await expect(page.getByRole("status")).toHaveText("Moved the Service layer.");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    const a = await position(page, "Online shopping —");
    const b = await position(page, "Checkout — test");
    expect(a.x - before.a.x).toBeGreaterThan(20);
    expect(a.x - before.a.x).toBeCloseTo(b.x - before.b.x, 0);
    expect(a.y - before.a.y).toBeCloseTo(b.y - before.b.y, 0);
    expect(await position(page, "web-prod-01")).toEqual(before.other);

    await page.getByRole("button", { name: "Undo" }).click();
    expect(await position(page, "Online shopping —")).toEqual(before.a);
    expect(await position(page, "Checkout — test")).toEqual(before.b);
  });

  test("a selected layer moves by its box, and from the keyboard", async ({ page }) => {
    await openCheckout(page);
    const handle = page.getByRole("button", { name: /^Infrastructure layer/ });
    const start = await position(page, "db-prod-01");
    await handle.focus();
    await page.keyboard.press("Enter");
    await expect(handle).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("ArrowRight");
    expect(await position(page, "db-prod-01")).toEqual({ x: start.x + 16, y: start.y });
    await page.keyboard.press("Shift+ArrowDown");
    expect(await position(page, "db-prod-01")).toEqual({ x: start.x + 16, y: start.y + 64 });
    await expect(handle).toBeFocused();

    // Drag from inside the selected box, away from its elements.
    const boxEl = page.getByTestId("layer-box").nth(4);
    const r = (await boxEl.boundingBox())!;
    const before = await position(page, "web-test-01");
    await page.mouse.move(r.x + r.width - 6, r.y + r.height - 6);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(r.x + r.width - 6 + i * 10, r.y + r.height - 6);
    await page.mouse.up();
    expect((await position(page, "web-test-01")).x).toBeGreaterThan(before.x + 20);

    await page.keyboard.press("Escape");
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await expect(handle).toHaveAttribute("aria-pressed", "false");
  });
});

test.describe("context menus (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("an element's menu renames, duplicates and deletes it", async ({ page }) => {
    await openCheckout(page);
    await node(page, "Checkout web app").click({ button: "right" });
    const menu = page.getByRole("menu", { name: "Checkout web app menu" });
    await expect(menu.getByRole("menuitem")).toHaveText(["Rename", "Add a relationship…", "Duplicate", "No hints", "Select the Functional layer", "Delete"]);
    await expect(menu.getByRole("menuitem", { name: "Rename" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("complementary", { name: "Inspector" }).getByLabel("Name", { exact: true })).toBeFocused();

    await node(page, "Checkout web app").click({ button: "right" });
    await menu.getByRole("menuitem", { name: "Duplicate" }).click();
    await expect(node(page, "Checkout web app (copy)")).toBeVisible();

    await node(page, "Checkout web app (copy)").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(node(page, "Checkout web app (copy)")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("Undo restores it");
  });

  test("the keyboard opens menus (Shift+F10) and Escape returns focus", async ({ page }) => {
    await openCheckout(page);
    const target = node(page, "Orders database");
    await target.focus();
    await page.keyboard.press("Shift+F10");
    const menu = page.getByRole("menu", { name: "Orders database menu" });
    await expect(menu).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Add a relationship…" })).toBeFocused();
    await page.keyboard.press("End");
    await expect(menu.getByRole("menuitem", { name: "Delete" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(target).toBeFocused();

    const handle = page.getByRole("button", { name: /^Business layer/ });
    await handle.focus();
    await page.keyboard.press("Shift+F10");
    await expect(page.getByRole("menu", { name: "Business layer menu" }).getByRole("menuitem")).toHaveText(["Zoom to layer", "Select layer", "Distribute evenly", "Delete 1 element in this layer"]);
    await page.keyboard.press("Escape");
    await expect(handle).toBeFocused();
  });

  test("the canvas menu toggles view options; the layer menu deletes a layer as one undo step", async ({ page }) => {
    await openCheckout(page);
    await page.locator(".react-flow__pane").click({ button: "right", position: { x: 30, y: 30 } });
    const menu = page.getByRole("menu", { name: "Canvas menu" });
    await expect(menu.getByRole("menuitemcheckbox", { name: "Layer boxes" })).toHaveAttribute("aria-checked", "true");
    await menu.getByRole("menuitemcheckbox", { name: "Lanes" }).click();
    await expect(page.getByTestId("layer-lane")).toHaveCount(5);

    await page.getByRole("button", { name: /^Infrastructure layer/ }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete 3 elements in this layer" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(11);
    await page.keyboard.press("Control+z");
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
  });

  test("a relationship drawn the old way is updated to CSDM 5 from its menu", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    const file = {
      schema: 1,
      id: "legacy-demo",
      name: "Legacy demo",
      created: "2026-09-27T00:00:00.000Z",
      updated: "2026-09-27T00:00:00.000Z",
      nodes: [
        { id: "cap", class: "business_capability", name: "Order management" },
        { id: "ba", class: "business_application", name: "Checkout" },
      ],
      edges: [{ id: "e1", from: "ba", to: "cap", type: "Provides::Provided by" }],
      layout: { cap: { x: 0, y: 0 }, ba: { x: 0, y: 160 } },
    };
    await page.getByTestId("import-file").setInputFiles({ name: "legacy.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(file)) });
    // The legacy relationship, and the application has no Application Service yet.
    await expect(page.getByRole("tab", { name: "Hints (2)" })).toBeVisible();
    await page.getByRole("button", { name: "Fit View" }).click();
    await page.locator(".react-flow__edge-textwrapper").first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Update to CSDM 5 (Provided by::Provides)" }).click();
    await expect(page.getByRole("tab", { name: "Hints (1)" })).toBeVisible();
    await expect(page.locator(".react-flow__edge").first()).toContainText("Provided by");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`an open menu and selected layer have no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openCheckout(page);
      await page.getByRole("button", { name: /^Design layer/ }).click();
      await node(page, "Checkout web app").click({ button: "right" });
      const del = page.getByRole("menuitem", { name: "Delete" });
      await expect(del).toBeVisible();
      expect(await contrastOf(del)).toBeGreaterThanOrEqual(4.5);
      expect(await contrastOf(page.getByRole("menuitem", { name: "No hints" }))).toBeGreaterThanOrEqual(4.5);
      expect(await contrastOf(page.getByRole("button", { name: /^Design layer/ }))).toBeGreaterThanOrEqual(4.5);
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});
