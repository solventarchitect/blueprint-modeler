import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M93: notes on the canvas: free, or attached to an element so they move with it.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const note = (page: Page, label: string | RegExp) => page.getByRole("button", { name: label });
const said = (page: Page, text: string) => expect(page.getByRole("status").filter({ hasText: text })).toHaveCount(1);
/** Where a note or element sits on the canvas, from its transform. */
const at = (l: Locator) => l.evaluate((el) => (/translate\((-?[\d.]+)px, ?(-?[\d.]+)px\)/.exec((el as HTMLElement).style.transform) ?? []).slice(1, 3).map(Number));

const model = {
  schema: 1,
  id: "e2e-notes",
  name: "Payroll",
  created: "2026-11-14T00:00:00.000Z",
  updated: "2026-11-14T00:00:00.000Z",
  nodes: [
    { id: "ba", class: "business_application", name: "Payroll" },
    { id: "svc", class: "application_service", name: "Payroll production" },
  ],
  edges: [{ id: "e1", from: "ba", to: "svc", type: "Uses::Used by" }],
  layout: { ba: { x: 0, y: 0 }, svc: { x: 0, y: 260 } },
};

async function open(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await page.getByTestId("import-file").setInputFiles({ name: "payroll.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(model)) });
  await expect(currentModel(page)).toHaveText("Payroll");
  await saved(page);
}
async function exported(page: Page, item: RegExp) {
  await saved(page);
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: item }).click()]);
  return readFile((await download.path())!, "utf8");
}

test.describe("notes on the canvas (M93, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("written where the canvas menu was opened, edited in place, moved, deleted; each one undo step", async ({ page }) => {
    await open(page);
    await page.locator(".react-flow__pane").click({ button: "right", position: { x: 700, y: 120 } });
    await page.getByRole("menu", { name: "Canvas menu" }).getByRole("menuitem", { name: "Add note here" }).click();
    const writing = page.getByRole("textbox", { name: "New note" });
    await expect(writing).toBeFocused();
    await writing.fill("Assumes one region.");
    await page.keyboard.press("Control+Enter");
    const free = note(page, "Note: Assumes one region.");
    await expect(free).toBeFocused();
    await said(page, "Added a note. Undo removes it.");
    expect(await new AxeBuilder({ page }).withTags(axeTags).include('[data-testid="notes-layer"]').analyze().then((r) => r.violations)).toEqual([]);

    // Edited in place: Enter, then Escape puts it back, focus on the note.
    await page.keyboard.press("Enter");
    const editing = page.getByRole("textbox", { name: "Edit the note" });
    await editing.fill("Something else");
    await page.keyboard.press("Escape");
    await expect(free).toBeFocused();
    await page.keyboard.press("Enter");
    await editing.fill("Assumes one region, for now.");
    await page.keyboard.press("Control+Enter");
    await expect(note(page, "Note: Assumes one region, for now.")).toBeFocused();

    // The arrow keys move it, Shift further.
    const moved = note(page, /^Note: Assumes one region, for now\./);
    const [x0, y0] = await at(moved);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await expect.poll(() => at(moved)).toEqual([x0! + 16, y0! + 64]);

    // In the model file.
    const file = JSON.parse(await exported(page, /Model file \(JSON\)/));
    expect(file.notes).toEqual([{ id: expect.any(String), text: "Assumes one region, for now.", x: x0! + 16, y: y0! + 64 }]);

    // Moved with a click, from its menu: no dragging needed.
    await moved.click({ button: "right" });
    await page.getByRole("menu", { name: "Note menu" }).getByRole("menuitem", { name: /^Move…/ }).click();
    await said(page, "Click on the canvas where the note should go. Escape cancels.");
    const pane = (await page.locator(".react-flow__pane").boundingBox())!;
    const target = { x: pane.x + 120, y: pane.y + pane.height - 120 };
    await page.mouse.click(target.x, target.y);
    await said(page, "Moved the note.");
    await expect(moved).toBeFocused();
    const placed = (await moved.boundingBox())!;
    expect(Math.abs(placed.x - target.x)).toBeLessThan(3);
    expect(Math.abs(placed.y - target.y)).toBeLessThan(3);

    // Delete deletes the note, and only the note, with an element selected; focus goes to the canvas.
    await node(page, "Payroll").click();
    await moved.focus();
    await page.keyboard.press("Delete");
    await said(page, "Deleted the note. Undo restores it.");
    await expect(page.locator("[data-note]")).toHaveCount(0);
    await expect(node(page, "Payroll")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Model canvas" })).toBeFocused();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(moved).toBeVisible();
  });

  test("on an element: it moves with it, says so, and stays put, free, when the element is deleted", async ({ page }) => {
    await open(page);
    await node(page, "Payroll").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add note" }).click();
    // Escape drops a new note, said, and focus goes back to the element.
    await page.getByRole("textbox", { name: "New note on Payroll" }).fill("Draft");
    await page.keyboard.press("Escape");
    await said(page, "The note was not added.");
    await expect(page.locator("[data-note]")).toHaveCount(0);
    await expect(node(page, "Payroll")).toBeFocused();
    await node(page, "Payroll").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add note" }).click();
    await page.getByRole("textbox", { name: "New note on Payroll" }).fill("Who owns this?");
    await page.keyboard.press("Control+Enter");
    await said(page, "Added a note on “Payroll”. Undo removes it.");
    const onIt = note(page, "Note on Payroll: Who owns this?");
    await expect(onIt).toContainText("Note · on Payroll");
    const [nx, ny] = await at(onIt);
    const [ex, ey] = await at(node(page, "Payroll"));

    // The element moves (by keyboard): the note goes with it.
    await node(page, "Payroll").click();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => at(node(page, "Payroll")).then(([x]) => x)).toBeGreaterThan(ex!);
    const [ex2, ey2] = await at(node(page, "Payroll"));
    await expect.poll(() => at(onIt)).toEqual([nx! + (ex2! - ex!), ny! + (ey2! - ey!)]);

    // Dragged by the mouse, it stays on its element, at its new place; a double-click edits it.
    const box = (await onIt.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 6 });
    await page.mouse.up();
    const zoom = await page.locator(".react-flow__viewport").evaluate((el) => Number(/scale\(([\d.]+)\)/.exec((el as HTMLElement).style.transform)![1]));
    const [dx, dy] = await at(onIt);
    expect(Math.abs(dx! - (nx! + (ex2! - ex!) + 60 / zoom))).toBeLessThan(2);
    expect(Math.abs(dy! - (ny! + (ey2! - ey!) + 30 / zoom))).toBeLessThan(2);
    await onIt.dblclick();
    await expect(page.getByRole("textbox", { name: "Edit the note on Payroll" })).toBeFocused();
    await page.keyboard.press("Escape");
    // Back where it was before the drag, for what follows.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => at(onIt)).toEqual([nx! + (ex2! - ex!), ny! + (ey2! - ey!)]);

    // Freed from its menu, it stays where it is.
    await onIt.click({ button: "right" });
    await page.getByRole("menu", { name: "Note menu" }).getByRole("menuitem", { name: /^Free from “Payroll”/ }).click();
    await said(page, "The note no longer moves with “Payroll”.");
    const freed = note(page, "Note: Who owns this?");
    await expect.poll(() => at(freed)).toEqual([nx! + (ex2! - ex!), ny! + (ey2! - ey!)]);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(onIt).toBeVisible();

    // The element deleted: the note stays where it was, free.
    const [ax, ay] = await at(onIt);
    await node(page, "Payroll").click();
    await page.keyboard.press("Delete");
    await expect(node(page, "Payroll")).toHaveCount(0);
    await expect.poll(() => at(freed)).toEqual([ax!, ay!]);
  });

  test("hidden from the View menu, here and in images; shown in images when shown; the palette adds one", async ({ page }) => {
    await open(page);
    await node(page, "Payroll production").click();
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Commands" }).getByRole("combobox", { name: "Search commands" }).fill("add a note");
    await expect(page.getByRole("dialog", { name: "Commands" }).getByRole("option").first()).toContainText("Add a note on “Payroll production”");
    await page.keyboard.press("Enter");
    await page.getByRole("textbox", { name: "New note on Payroll production" }).fill("Check the SLA");
    await page.keyboard.press("Control+Enter");
    await expect(note(page, "Note on Payroll production: Check the SLA")).toBeVisible();

    expect(await exported(page, /^Image, light \(SVG\)/)).toContain("NOTE · ON PAYROLL PRODUCTION");

    // Left by clicking elsewhere, the edit is kept and focus stays where it went.
    await note(page, "Note on Payroll production: Check the SLA").focus();
    await page.keyboard.press("Enter");
    await page.getByRole("textbox", { name: "Edit the note on Payroll production" }).fill("Check the SLA and the RTO");
    // The selected element's name, in the Inspector.
    const modelName = page.getByRole("complementary", { name: "Inspector" }).getByLabel("Name", { exact: true });
    await modelName.click();
    await expect(note(page, "Note on Payroll production: Check the SLA and the RTO")).toBeVisible();
    await page.waitForTimeout(100);
    await expect(modelName).toBeFocused();

    await page.getByRole("button", { name: "View", exact: true }).click();
    await page.getByRole("button", { name: /^Notes/ }).click();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-note]")).toHaveCount(0);
    expect(await exported(page, /^Image, light \(SVG\)/)).not.toContain("data-note");
  });

  test("opening the model and Fit view frame its notes too", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    const far = { ...model, notes: [{ id: "far", text: "Off to the side", x: 1600, y: -300 }] };
    await page.getByTestId("import-file").setInputFiles({ name: "far.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(far)) });
    await expect(currentModel(page)).toHaveText("Payroll");
    const side = note(page, "Note: Off to the side");
    await expect(side).toBeInViewport({ ratio: 0.98 });
    await expect(node(page, "Payroll production")).toBeInViewport({ ratio: 0.98 });
    // Away and back with Fit view.
    await page.getByTestId("zoom-menu").click();
    await page.getByRole("button", { name: /^200%/ }).click();
    await expect(side).not.toBeInViewport({ ratio: 0.98 });
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Shift+Digit1");
    await expect(side).toBeInViewport({ ratio: 0.98 });
  });
});
