import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExampleFitted } from "./examples";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExampleFitted(page, "Online Store Checkout");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
}

/** The canvas zoom, read from the viewport transform. */
async function zoomOf(page: Page) {
  const t = await page.locator(".react-flow__viewport").evaluate((el) => (el as HTMLElement).style.transform);
  return Number(/scale\(([\d.]+)\)/.exec(t)![1]);
}

async function viewportCenterOf(page: Page, name: string) {
  const box = (await page.locator(".react-flow__node").filter({ hasText: name }).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("minimap and zoom commands (M49, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the minimap shows by default, colors nodes by layer, toggles from the View menu and persists", async ({ page }) => {
    await openCheckout(page);
    const minimap = page.getByRole("img", { name: /^Model overview/ });
    await expect(minimap).toBeVisible();
    await expect(minimap.locator(".react-flow__minimap-node")).toHaveCount(14);
    const fills = await minimap.locator(".react-flow__minimap-node").evaluateAll((els) => new Set(els.map((e) => getComputedStyle(e).fill)).size);
    expect(fills).toBeGreaterThanOrEqual(3);

    await page.getByRole("button", { name: "View", exact: true }).click();
    const item = page.getByRole("button", { name: /^Minimap/ });
    await expect(item).toHaveAttribute("aria-pressed", "true");
    await item.click();
    await page.keyboard.press("Escape");
    await expect(minimap).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
    await expect(minimap).toHaveCount(0);
  });

  test("the minimap pans the canvas and hides while presenting", async ({ page }) => {
    await openCheckout(page);
    const before = await viewportCenterOf(page, "Customer orders");
    const box = (await page.getByRole("img", { name: /^Model overview/ }).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(x + 5 * i, y + 3 * i);
    await page.mouse.up();
    const after = await viewportCenterOf(page, "Customer orders");
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(20);

    await page.getByRole("button", { name: "Present" }).click();
    await expect(page.getByRole("img", { name: /^Model overview/ })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("img", { name: /^Model overview/ })).toBeVisible();
  });

  test("the Zoom menu shows the level and jumps to presets, fit and the selection", async ({ page }) => {
    await openCheckout(page);
    const menu = page.getByTestId("zoom-menu");
    await expect(menu).toHaveAccessibleName(/^Zoom, \d+%$/);
    await expect(page.getByRole("button", { name: "Zoom to selection" })).toBeHidden();

    await menu.click();
    await expect(page.getByRole("button", { name: "Zoom to selection" })).toBeDisabled();
    await page.getByRole("button", { name: /^200%/ }).click();
    await expect(menu).toHaveAccessibleName("Zoom, 200%");
    expect(await zoomOf(page)).toBeCloseTo(2, 2);
    await expect(menu).toBeFocused();

    await menu.click();
    await page.getByRole("button", { name: /^50%/ }).click();
    await expect(menu).toHaveAccessibleName("Zoom, 50%");

    await page.locator(".react-flow__node").filter({ hasText: "Customer orders" }).click();
    await menu.click();
    const toSelection = page.getByRole("button", { name: "Zoom to selection" });
    await expect(toSelection).toBeEnabled();
    await toSelection.click();
    await expect(menu).toHaveAccessibleName("Zoom, 125%");
    const canvas = (await page.locator(".react-flow").boundingBox())!;
    const c = await viewportCenterOf(page, "Customer orders");
    expect(Math.abs(c.x - (canvas.x + canvas.width / 2))).toBeLessThan(40);
    expect(Math.abs(c.y - (canvas.y + canvas.height / 2))).toBeLessThan(40);

    await menu.click();
    await page.getByRole("button", { name: /^Fit view/ }).click();
    await expect.poll(() => zoomOf(page)).toBeLessThanOrEqual(1);
  });

  test("Shift+1, Shift+2 and Shift+0 fit, zoom to the selection and reset to 100%", async ({ page }) => {
    await openCheckout(page);
    const menu = page.getByTestId("zoom-menu");
    const node = page.locator(".react-flow__node").filter({ hasText: "Customer orders" });
    await node.click();
    // The shortcut reads the committed selection; wait for it (the menu's item enables with it) before pressing.
    await expect(node).toHaveClass(/selected/);
    await expect(page.getByRole("complementary", { name: "Inspector" }).getByLabel("Name", { exact: true })).toHaveValue("Customer orders");
    await page.keyboard.press("Shift+Digit2");
    await expect(menu).toHaveAccessibleName("Zoom, 125%");
    await page.keyboard.press("Shift+Digit0");
    await expect(menu).toHaveAccessibleName("Zoom, 100%");
    await page.keyboard.press("Shift+Digit1");
    await expect(menu).not.toHaveAccessibleName("Zoom, 100%");
    await expect.poll(() => zoomOf(page)).toBeLessThan(1);

    // Typing into a field never triggers them.
    await page.getByRole("textbox", { name: "Name" }).first().fill("Shift+1 as text");
    await page.keyboard.press("Shift+Digit0");
    expect(await zoomOf(page)).toBeLessThan(1);
  });

  test("the zoom menu and the minimap pass axe", async ({ page }) => {
    await openCheckout(page);
    await page.getByTestId("zoom-menu").click();
    const results = await new AxeBuilder({ page }).withTags(tags).analyze();
    expect(results.violations).toEqual([]);
  });
});
