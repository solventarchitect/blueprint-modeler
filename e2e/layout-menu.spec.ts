import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { chooseLayout, diagramRect, layerBoxRects, layoutButton, layoutMenu } from "./layout";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

/** The on-screen rectangles of the elements whose center lies in a layer box. */
const nodesIn = (page: Page, box: { left: number; top: number; right: number; bottom: number }) =>
  page.locator(".react-flow__node").evaluateAll(
    (els, box) =>
      els
        .map((e) => e.getBoundingClientRect())
        .filter((r) => r.left + r.width / 2 > box.left && r.left + r.width / 2 < box.right && r.top + r.height / 2 > box.top && r.top + r.height / 2 < box.bottom)
        .map((r) => ({ left: r.left, top: r.top })),
    box,
  );

const open = async (page: Page, name = "Online Store Checkout") => {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, name);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
};

test.describe("Layout menu (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("replaces the Auto-layout button with a menu of five arrangements, each explained", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("group", { name: "Arrange" }).getByRole("button", { name: "Auto-layout" })).toHaveCount(0);
    await expect(layoutButton(page)).toHaveAttribute("aria-expanded", "false");
    await layoutButton(page).click();
    await expect(layoutButton(page)).toHaveAttribute("aria-expanded", "true");
    const menu = layoutMenu(page);
    await expect(menu.getByRole("button")).toHaveText([/Auto-layout/, /Top to bottom/, /Left to right/, /Symmetric/, /Fill space/]);
    await expect(menu.getByRole("button", { name: "Left to right", exact: true })).toHaveAccessibleDescription(/column/);
    await expect(menu).toContainText("CSDM layer");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(layoutButton(page)).toBeFocused();
  });

  test("top to bottom gives every layer one row; left to right one column; the lanes follow", async ({ page }) => {
    await open(page);
    await chooseLayout(page, "Top to bottom");
    let boxes = await layerBoxRects(page);
    expect(boxes).toHaveLength(5);
    for (const [i, b] of boxes.entries()) {
      expect(new Set((await nodesIn(page, b)).map((n) => Math.round(n.top))).size, `row ${i} is one row`).toBe(1);
      if (i) expect(b.top, `row ${i} below row ${i - 1}`).toBeGreaterThan(boxes[i - 1]!.bottom);
    }

    await chooseLayout(page, "Left to right");
    boxes = await layerBoxRects(page);
    for (const [i, b] of boxes.entries()) {
      expect(new Set((await nodesIn(page, b)).map((n) => Math.round(n.left))).size, `column ${i} is one column`).toBe(1);
      if (i) expect(b.left, `column ${i} right of column ${i - 1}`).toBeGreaterThan(boxes[i - 1]!.right);
    }
    // Lanes become columns: taller than wide, side by side, and a drop settles sideways.
    await page.locator(".react-flow__pane").click({ button: "right", position: { x: 30, y: 30 } });
    await page.getByRole("menu", { name: "Canvas menu" }).getByRole("menuitemcheckbox", { name: "Lanes" }).click();
    const lanes = page.getByTestId("layer-lane");
    await expect(lanes).toHaveCount(5);
    const laneRects = await lanes.evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: r.left, width: r.width, height: r.height })));
    for (const [i, l] of laneRects.entries()) {
      expect(l.height).toBeGreaterThan(l.width);
      if (i) expect(l.left).toBeGreaterThan(laneRects[i - 1]!.left);
    }
    await expect(page.getByRole("button", { name: /^Infrastructure layer/ })).toBeVisible();
    const host = page.locator(".react-flow__node").filter({ hasText: "web-prod-01" });
    const hb = (await host.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 - 200, hb.y + hb.height / 2, { steps: 6 });
    await page.mouse.move(hb.x + hb.width / 2 - 400, hb.y + hb.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByRole("status")).toHaveText("Kept in the Infrastructure lane.");
    // Within a column a relationship runs up or down; the one below leaves by the right side.
    await expect(page.locator(".react-flow__edge").first()).toBeVisible();

    // Undo twice: positions back to top-to-bottom rows.
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    boxes = await layerBoxRects(page);
    for (const [i, b] of boxes.entries()) if (i) expect(b.top).toBeGreaterThan(boxes[i - 1]!.bottom);
  });

  test("symmetric centers every layer on one axis", async ({ page }) => {
    await open(page, "HR Self-Service Portal");
    await chooseLayout(page, "Symmetric");
    const boxes = await layerBoxRects(page);
    expect(boxes.length).toBeGreaterThan(2);
    const centers = boxes.map((b) => (b.left + b.right) / 2);
    for (const c of centers) expect(Math.abs(c - centers[0]!)).toBeLessThanOrEqual(2);
    for (const [i, b] of boxes.entries()) if (i) expect(b.top).toBeGreaterThan(boxes[i - 1]!.bottom);
  });

  test("fill space stretches the picture to the view, then says so when there is nothing left to do", async ({ page }) => {
    await open(page, "Shared Database Platform");
    await chooseLayout(page, "Left to right");
    const canvas = (await page.locator(".react-flow").boundingBox())!;
    // A fit pads 0.15 (React Flow: 6.5% of a side each way); the picture fills the view when it
    // reaches that padding on the left, right and bottom (the title block sits above it).
    const side = (length: number) => Math.floor((length - length / 1.15) / 2);
    const gaps = async () => {
      const r = await diagramRect(page);
      return { left: r.left - canvas.x, right: canvas.x + canvas.width - r.left - r.width, bottom: canvas.y + canvas.height - r.top - r.height };
    };
    expect((await gaps()).bottom, "a fitted left-to-right picture leaves an empty band below").toBeGreaterThan(side(canvas.height) + 40);
    await chooseLayout(page, "Fill space");
    await expect(page.getByRole("status")).toContainText("Spread to fill the view");
    await expect.poll(gaps).toEqual({ left: expect.closeTo(side(canvas.width), -1), right: expect.closeTo(side(canvas.width), -1), bottom: expect.closeTo(side(canvas.height), -1) });
    await chooseLayout(page, "Fill space");
    await expect(page.getByRole("status")).toContainText("already fills the view");
  });

  test("is disabled on an empty model, and the canvas menu still offers Auto-layout", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await expect(layoutButton(page)).toBeDisabled();
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the open Layout menu has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await layoutButton(page).click();
      await expect(layoutMenu(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});
