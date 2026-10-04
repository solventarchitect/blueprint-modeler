import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { contrastOf } from "./contrast";
import { openExample } from "./examples";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, "Online store checkout");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
}

async function toggle(page: Page, label: string) {
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${label}`) }).click();
  await page.keyboard.press("Escape");
}

/** A node's canvas position, read from its transform. */
async function position(page: Page, name: string) {
  const t = await page.locator(".react-flow__node").filter({ hasText: name }).evaluate((el) => (el as HTMLElement).style.transform);
  const m = /translate\((-?[\d.]+)px, ?(-?[\d.]+)px\)/.exec(t)!;
  return { x: Number(m[1]), y: Number(m[2]) };
}

async function drag(page: Page, name: string, dx: number, dy: number) {
  const box = (await page.locator(".react-flow__node").filter({ hasText: name }).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(x + (dx * i) / 10, y + (dy * i) / 10);
  await page.mouse.up();
}

test.describe("view options and present mode (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("layer boxes show by default, toggle from the View menu and persist", async ({ page }) => {
    await openCheckout(page);
    const boxes = page.getByTestId("layer-box");
    await expect(boxes).toHaveCount(5);
    await expect(page.getByRole("button", { name: /^Business layer/ })).toBeVisible();

    const view = page.getByRole("button", { name: "View", exact: true });
    await view.click();
    await expect(view).toHaveAttribute("aria-expanded", "true");
    const item = page.getByRole("button", { name: /^Layer boxes/ });
    await expect(item).toHaveAttribute("aria-pressed", "true");
    await item.click();
    await expect(item).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Escape");
    await expect(view).toHaveAttribute("aria-expanded", "false");
    await expect(view).toBeFocused();
    await expect(boxes).toHaveCount(0);

    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
    await expect(boxes).toHaveCount(0);
    await toggle(page, "Layer boxes");
    await expect(boxes).toHaveCount(5);
  });

  test("with lanes on, an element dropped in another layer's lane settles back into its own", async ({ page }) => {
    await openCheckout(page);
    await toggle(page, "Lanes");
    await expect(page.getByTestId("layer-lane")).toHaveCount(5);
    const before = await position(page, "web-prod-01");
    await drag(page, "web-prod-01", 40, -320);
    await expect(page.getByRole("status")).toContainText("Kept in the Infrastructure lane");
    const after = await position(page, "web-prod-01");
    expect(after.x).toBeGreaterThan(before.x);
    expect(Math.abs(after.y - before.y)).toBeLessThan(120);
  });

  test("snap to grid keeps dropped positions on a 16px grid", async ({ page }) => {
    await openCheckout(page);
    await toggle(page, "Snap to grid");
    await drag(page, "Checkout web app", 53, 27);
    const p = await position(page, "Checkout web app");
    expect(p.x % 16).toBe(0);
    expect(p.y % 16).toBe(0);
  });

  test("present mode shows the canvas alone, steps layer by layer and returns focus on exit", async ({ page }) => {
    await openCheckout(page);
    const present = page.getByRole("button", { name: "Present", exact: true });
    await present.click();
    const bar = page.getByRole("region", { name: "Presentation" });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole("button", { name: "Exit" })).toBeFocused();
    await expect(page.getByRole("complementary", { name: "Inspector" })).toBeHidden();
    await expect(page.getByTestId("layer-box")).toHaveCount(5);

    const step = page.getByTestId("present-step");
    await expect(step).toHaveText("Overview · 1 of 6");
    await page.keyboard.press("ArrowRight");
    await expect(step).toHaveText("Business · 2 of 6");
    for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
    await expect(step).toHaveText("Infrastructure · 6 of 6");
    await expect(bar.getByRole("button", { name: "Next" })).toBeDisabled();
    await page.keyboard.press("Home");
    await expect(step).toHaveText("Overview · 1 of 6");

    await page.keyboard.press("Escape");
    await expect(bar).toBeHidden();
    await expect(present).toBeFocused();
    await expect(page.getByRole("complementary", { name: "Inspector" })).toBeVisible();
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`boxes, lanes and present mode have no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openCheckout(page);
      await toggle(page, "Lanes");
      await expect(page.getByTestId("layer-lane")).toHaveCount(5);
      // Lane labels replace box labels; both are text, so both must meet 4.5:1 (axe skips aria-hidden text).
      await expect(page.getByTestId("layer-box-label")).toHaveCount(0);
      for (const label of await page.getByTestId("layer-lane-label").all()) expect(await contrastOf(label.getByTestId("layer-handle"))).toBeGreaterThanOrEqual(4.5);
      await toggle(page, "Lanes");
      for (const label of await page.getByTestId("layer-box-label").all()) expect(await contrastOf(label.getByTestId("layer-handle"))).toBeGreaterThanOrEqual(4.5);
      await toggle(page, "Lanes");
      // axe files text over the drafting grid as "incomplete", so check the canvas attribution directly.
      expect(await contrastOf(page.locator(".react-flow__attribution a"))).toBeGreaterThanOrEqual(4.5);
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
      await page.getByRole("button", { name: "Present", exact: true }).click();
      await expect(page.getByRole("region", { name: "Presentation" })).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});
