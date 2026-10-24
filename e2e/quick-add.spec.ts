import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { settled } from "./layout";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";
const paletteNav = (page: Page) => page.getByRole("navigation", { name: "Element palette" });
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ hasText: name });
const nodes = (page: Page) => page.locator(".react-flow__node");
const edges = (page: Page) => page.locator(".react-flow__edge");
const quickMenu = (page: Page, name = "Checkout") => page.getByRole("menu", { name: `Add related to ${name}` });

/** A blank model with one Business Application, "Checkout", fitted and still. */
async function openWithCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await paletteNav(page).getByRole("button", { name: "Business Application", exact: true }).click();
  const field = inspector(page).getByLabel("Name", { exact: true });
  await expect(field).toBeFocused();
  await field.fill("Checkout");
  await field.press("Enter");
  await expect(node(page, "Checkout")).toBeVisible();
  await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
  await page.getByRole("button", { name: "Fit View" }).click();
  await settled(page);
}

/** Draws a line from Checkout's bottom handle and lets go `dx`, `dy` pixels away. Returns the drop point. */
async function dragFromCheckout(page: Page, dx: number, dy: number) {
  const h = (await node(page, "Checkout").locator(".react-flow__handle-bottom").boundingBox())!;
  const start = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
  const end = { x: start.x + dx, y: start.y + dy };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await page.mouse.up();
  return end;
}

test.describe("quick-add (M53, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("a line dropped on empty canvas offers new related elements; one choice adds both, where dropped, in one undo step", async ({ page }) => {
    await openWithCheckout(page);
    await expect(nodes(page)).toHaveCount(1);
    const drop = await dragFromCheckout(page, 160, 220);
    const menu = quickMenu(page);
    await expect(menu).toBeVisible();
    // The menu opens at the pointer, its first entry focused.
    const box = (await menu.boundingBox())!;
    expect(Math.abs(box.x - drop.x)).toBeLessThan(8);
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    // Every entry is a new element with its relationship type.
    const service = menu.getByRole("menuitem", { name: /^New Application Service/ });
    await expect(service).toContainText("Uses::Used by");
    await expect(menu.getByRole("menuitem", { name: /^New Service Instance/ })).toHaveCount(0);

    await service.click();
    await expect(menu).toHaveCount(0);
    await expect(nodes(page)).toHaveCount(2);
    await expect(edges(page)).toHaveCount(1);
    const added = node(page, "New Application Service");
    // Placed centered on the drop point.
    const b = (await added.boundingBox())!;
    expect(Math.hypot(b.x + b.width / 2 - drop.x, b.y + b.height / 2 - drop.y)).toBeLessThan(40);
    await expect(inspector(page).getByLabel("Name", { exact: true })).toBeFocused();
    await expect(page.getByRole("status")).toContainText("related to Checkout");

    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press(`${mod}+z`);
    await expect(nodes(page)).toHaveCount(1);
    await expect(edges(page)).toHaveCount(0);
  });

  test("a click on a handle, or a very short drag, opens nothing; Escape closes the menu with nothing added", async ({ page }) => {
    await openWithCheckout(page);
    await dragFromCheckout(page, 6, 8);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await node(page, "Checkout").locator(".react-flow__handle-bottom").click();
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("menu")).toHaveCount(0);

    await dragFromCheckout(page, 160, 220);
    await expect(quickMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(quickMenu(page)).toHaveCount(0);
    await expect(nodes(page)).toHaveCount(1);
    await expect(node(page, "Checkout")).toBeFocused();
  });

  test("with lanes on, the new element goes to its own layer, as a drag would", async ({ page }) => {
    await openWithCheckout(page);
    await page.getByRole("button", { name: "View", exact: true }).click();
    await page.getByRole("button", { name: /^Lanes/ }).click();
    await page.keyboard.press("Escape");
    await settled(page);
    await dragFromCheckout(page, 300, -40);
    await quickMenu(page).getByRole("menuitem", { name: /^New Application Service/ }).click();
    await expect(nodes(page)).toHaveCount(2);
    // Service lane row (laneY.service = 480), whatever the drop point.
    const t = await node(page, "New Application Service").evaluate((el) => (el as HTMLElement).style.transform);
    expect(Number(/translate\((-?[\d.]+)px, ?(-?[\d.]+)px\)/.exec(t)![2])).toBe(480);
  });

  test("Shift+A on a focused element opens the same menu from the keyboard; the element's menu and the palette do too", async ({ page }) => {
    await openWithCheckout(page);
    await node(page, "Checkout").focus();
    await page.keyboard.press("Shift+A");
    const menu = quickMenu(page);
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("ArrowDown");
    const second = (await menu.getByRole("menuitem").nth(1).textContent())!;
    await page.keyboard.press("Enter");
    await expect(nodes(page)).toHaveCount(2);
    await expect(edges(page)).toHaveCount(1);
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue(/^New /);
    expect(second).toContain((await inspector(page).getByLabel("Name", { exact: true }).inputValue()).replace(/^New /, ""));

    // The element's right-click menu.
    await node(page, "Checkout").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add a related element…" }).click();
    await expect(quickMenu(page)).toBeVisible();
    await expect(quickMenu(page).getByRole("menuitem").first()).toBeFocused();
    await page.keyboard.press("Escape");

    // The command palette: unavailable until an element is selected.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press(`${mod}+k`);
    const palette = page.getByRole("dialog", { name: "Commands" });
    await palette.getByRole("combobox").fill("related element");
    await expect(palette.locator('[role="option"][aria-selected="true"]')).toContainText("Select an element first");
    await page.keyboard.press("Escape");
    await node(page, "Checkout").click();
    await page.keyboard.press(`${mod}+k`);
    await palette.getByRole("combobox").fill("related element");
    await page.keyboard.press("Enter");
    await expect(quickMenu(page)).toBeVisible();
    await expect(quickMenu(page).getByRole("menuitem").first()).toBeFocused();
  });

  test("Shift+A in a text field types a capital A", async ({ page }) => {
    await openWithCheckout(page);
    await node(page, "Checkout").click();
    const field = inspector(page).getByLabel("Name", { exact: true });
    await field.focus();
    await page.keyboard.press("End");
    await page.keyboard.press("Shift+A");
    await expect(field).toHaveValue("CheckoutA");
    await expect(page.getByRole("menu")).toHaveCount(0);
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the quick-add menu has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openWithCheckout(page);
      await dragFromCheckout(page, 160, 220);
      await expect(quickMenu(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});

test.describe("quick-add on a small screen (M53)", () => {
  test.skip(({ isMobile }) => !isMobile, "small screens only");

  test("is not offered where editing is not", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.getByRole("button", { name: "Commands", exact: true }).click();
    const palette = page.getByRole("dialog", { name: "Commands" });
    await palette.getByRole("combobox").fill("related element");
    await expect(palette.getByRole("option")).toHaveCount(0);
  });
});
