import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";
const nodes = (page: Page) => page.locator(".react-flow__node");
const panel = (page: Page) => page.getByTestId("selection-panel");
const status = (page: Page) => page.getByRole("status");

async function open(page: Page) {
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await expect(nodes(page)).toHaveCount(14);
}

/** An element's position on the canvas (flow coordinates), from its transform. */
const pos = (n: Locator) =>
  n.evaluate((el) => {
    const m = /translate\(([-\d.]+)px, ?([-\d.]+)px\)/.exec((el as HTMLElement).style.transform)!;
    return { x: Number(m[1]), y: Number(m[2]) };
  });
const zoom = (page: Page) => page.locator(".react-flow__viewport").evaluate((el) => Number(/scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform)![1]));
/** Every element's position, by name. */
const all = (page: Page) =>
  nodes(page).evaluateAll((els) =>
    els.map((el) => {
      const m = /translate\(([-\d.]+)px, ?([-\d.]+)px\)/.exec((el as HTMLElement).style.transform)!;
      return { id: el.getAttribute("data-id")!, x: Number(m[1]), y: Number(m[2]) };
    }),
  );

/** Drags an element by a canvas (flow) distance, in small steps; checks `during` before letting go. */
async function dragBy(page: Page, n: Locator, dx: number, dy: number, during?: () => Promise<void>) {
  const k = await zoom(page);
  const start = await pos(n);
  const b = (await n.boundingBox())!;
  const [x, y] = [b.x + b.width / 2, b.y + 10];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 8, y + 8, { steps: 2 });
  // React Flow starts the drag a few pixels in and ignores them: aim from where the element is now.
  const now = await pos(n);
  await page.mouse.move(x + 8 + (start.x + dx - now.x) * k, y + 8 + (start.y + dy - now.y) * k, { steps: 12 });
  await during?.();
  await page.mouse.up();
}

/** Two elements on different rows: the one to move and the one to line up with. */
async function pair(page: Page) {
  const ps = await all(page);
  const a = ps[0]!;
  const b = ps.find((p) => Math.abs(p.y - a.y) > 120 && Math.abs(p.x - a.x) > 60)!;
  return { a, b, na: page.locator(`.react-flow__node[data-id="${a.id}"]`), nb: page.locator(`.react-flow__node[data-id="${b.id}"]`) };
}

test.describe("smart guides, multi-select, align and distribute (M57, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("a dragged element snaps into line with another, with a guide while dragging; turned off, it does not", async ({ page }) => {
    await open(page);
    const { a, b, na } = await pair(page);
    // Aim 3 canvas px right of the other element's left edge, staying on its own row.
    await dragBy(page, na, b.x + 3 - a.x, 0, async () => {
      await expect(page.getByTestId("guide").first()).toBeAttached();
    });
    await expect(page.getByTestId("guide")).toHaveCount(0);
    await expect.poll(async () => (await pos(na)).x).toBe(b.x);

    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await pos(na)).x).toBe(a.x);
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("smart guides");
    await page.keyboard.press("Enter");
    await dragBy(page, na, b.x + 3 - a.x, 0, async () => {
      await expect(page.getByTestId("guide")).toHaveCount(0);
    });
    const x = (await pos(na)).x;
    expect(x).not.toBe(b.x);
    expect(Math.abs(x - (b.x + 3))).toBeLessThanOrEqual(2);
  });

  test("Shift+click selects several; Align left lines them up in one undo step", async ({ page }) => {
    await open(page);
    const { a, b, na, nb } = await pair(page);
    await na.click();
    await nb.click({ modifiers: ["Shift"] });
    await expect(panel(page)).toContainText("2 elements selected");
    await expect(status(page)).toContainText("2 elements selected.");
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(2);

    await panel(page).getByRole("button", { name: "Align left" }).click();
    const left = Math.min(a.x, b.x);
    await expect.poll(async () => [(await pos(na)).x, (await pos(nb)).x]).toEqual([left, left]);
    await expect(status(page)).toContainText("Aligned 2 elements on their left edges.");
    // Rows kept.
    expect((await pos(na)).y).toBe(a.y);

    await page.keyboard.press("Control+z");
    await expect.poll(async () => [(await pos(na)).x, (await pos(nb)).x]).toEqual([a.x, b.x]);

    // Shift+click again takes one out: back to a single selection and the Inspector.
    await nb.click({ modifiers: ["Shift"] });
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
  });

  test("dragging one of several moves them all, as one undo step", async ({ page }) => {
    await open(page);
    const { a, b, na, nb } = await pair(page);
    await page.getByRole("button", { name: /View/ }).first().focus();
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Turn off smart guides");
    await page.keyboard.press("Enter");
    await na.click();
    await nb.click({ modifiers: ["Shift"] });
    await dragBy(page, na, 160, 96);
    await expect.poll(async () => (await pos(na)).x - a.x).toBeGreaterThan(140);
    const [pa, pb] = [await pos(na), await pos(nb)];
    expect(pb.x - b.x).toBe(pa.x - a.x);
    expect(pb.y - b.y).toBe(pa.y - a.y);
    await page.keyboard.press("Control+z");
    await expect.poll(async () => [await pos(na), await pos(nb)]).toEqual([
      { x: a.x, y: a.y },
      { x: b.x, y: b.y },
    ]);
  });

  test("Shift+drag selects in a box; Ctrl+A selects all; Esc clears; Delete removes the selection in one undo step", async ({ page }) => {
    await open(page);
    const pane = page.locator(".react-flow__pane");
    const box = (await pane.boundingBox())!;
    // A box over the whole canvas, drawn from a corner with no element under it.
    await page.keyboard.down("Shift");
    await page.mouse.move(box.x + 4, box.y + 4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 4, box.y + box.height - 4, { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    await expect(panel(page)).toContainText(/\d+ elements selected/);

    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(status(page)).toContainText("Selection cleared.");

    await nodes(page).first().focus();
    await page.keyboard.press(`${mod}+a`);
    await expect(panel(page)).toContainText("14 elements selected");
    await page.keyboard.press("Escape");

    const lines = page.locator(".react-flow__edge");
    const edges = await lines.count();
    const { na, nb } = await pair(page);
    await na.click();
    await nb.click({ modifiers: ["Shift"] });
    await page.keyboard.press("Delete");
    await expect(nodes(page)).toHaveCount(12);
    await expect(status(page)).toContainText("Deleted 2 elements. Undo restores them.");
    // One undo brings back the elements and their relationships.
    await page.keyboard.press("Control+z");
    await expect(nodes(page)).toHaveCount(14);
    await expect(lines).toHaveCount(edges);
  });

  test("Delete on one element with relationships is one undo step too", async ({ page }) => {
    await open(page);
    const lines = page.locator(".react-flow__edge");
    const edges = await lines.count();
    const busy = nodes(page).filter({ hasText: "Checkout — production" });
    await busy.click();
    await page.keyboard.press("Delete");
    await expect(nodes(page)).toHaveCount(13);
    await expect.poll(() => lines.count()).toBeLessThan(edges - 1);
    await page.keyboard.press("Control+z");
    await expect(nodes(page)).toHaveCount(14);
    await expect(lines).toHaveCount(edges);
  });

  test("keyboard: Shift+Enter adds the focused element; the palette and the element menu align the selection", async ({ page }) => {
    await open(page);
    const { a, b, na, nb } = await pair(page);
    await na.focus();
    await page.keyboard.press("Enter");
    await nb.focus();
    await page.keyboard.press("Shift+Enter");
    await expect(panel(page)).toContainText("2 elements selected");

    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Align top");
    await page.keyboard.press("Enter");
    const top = Math.min(a.y, b.y);
    await expect.poll(async () => [(await pos(na)).y, (await pos(nb)).y]).toEqual([top, top]);

    await nb.focus();
    await page.keyboard.press("Shift+F10");
    const menu = page.getByTestId("context-menu");
    await expect(menu.getByRole("menuitem", { name: "Align left" })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Delete 2 elements" })).toBeVisible();
    await menu.getByRole("menuitem", { name: "Distribute horizontally" }).click();
    await expect(status(page)).toContainText(/Spread 2 elements evenly across|Already evenly spread/);
  });

  test("the palette says why arranging needs a selection", async ({ page }) => {
    await open(page);
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Align left");
    await expect(page.getByRole("option", { name: /Align left/ })).toContainText("Select two or more elements first");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the selection panel passes WCAG 2.2 AA (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      const { na, nb } = await pair(page);
      await na.click();
      await nb.click({ modifiers: ["Shift"] });
      await expect(panel(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});
