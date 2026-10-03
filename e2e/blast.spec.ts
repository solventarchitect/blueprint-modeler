import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { contrastOf } from "./contrast";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
/** An element by its exact name ("Checkout" alone, not "Checkout — production"). */
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ has: page.getByText(name, { exact: true }) });
const strip = (page: Page) => page.getByRole("region", { name: "Blast radius" });

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Online store checkout" });
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
  // Example loads fit the view after a short delay; let it settle so clicks land where expected.
  await page.getByRole("button", { name: "Fit View" }).click();
}

async function showFrom(page: Page, name: string) {
  await node(page, name).click({ button: "right" });
  await page.getByRole("menu", { name: `${name} menu` }).getByRole("menuitem", { name: "Show blast radius" }).click();
  await expect(strip(page)).toBeVisible();
}

test.describe("blast radius (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the element menu shows a blast radius that steps hop by hop", async ({ page }) => {
    await page.clock.install();
    await openCheckout(page);
    await showFrom(page, "db-prod-01");
    const s = strip(page);
    await expect(s.getByRole("heading", { name: "If db-prod-01 fails" })).toBeVisible();
    await expect(s.getByTestId("blast-progress")).toHaveText("Start · 0 of 6 affected");
    await expect(page.getByRole("status")).toHaveText("Blast radius: if db-prod-01 fails, 6 elements are affected within 4 hops.");
    await expect(page.locator(".react-flow__node [data-blast]")).toHaveCount(1);
    await expect(node(page, "db-prod-01").locator("[data-blast]")).toHaveAttribute("data-blast", "start");

    await s.getByRole("button", { name: "Pause" }).click();
    await s.getByRole("button", { name: "Next step" }).click();
    await s.getByRole("button", { name: "Next step" }).click();
    await expect(s.getByTestId("blast-progress")).toHaveText("Hop 2 of 4 · 2 of 6 affected");
    await expect(page.getByRole("status")).toHaveText("Hop 2: Checkout — production affected.");
    await expect(page.locator(".react-flow__node [data-blast]")).toHaveCount(3);
    const prod = node(page, "Checkout — production").locator("[data-blast]");
    await expect(prod).toHaveAttribute("data-blast-hop", "2");
    await expect(prod).toHaveAttribute("data-blast-current", "true");
    await expect(prod.getByTestId("blast-badge")).toHaveText("2");
    await expect(node(page, "Orders database").locator("[data-blast]")).not.toHaveAttribute("data-blast-current", "true");
    await expect(page.locator(".react-flow__edge.blast")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge.blast-now")).toHaveCount(1);
    await expect(node(page, "Checkout — production")).toHaveAttribute("aria-label", /affected at hop 2/);

    await s.getByRole("button", { name: "Previous step" }).click();
    await expect(s.getByTestId("blast-progress")).toHaveText("Hop 1 of 4 · 1 of 6 affected");
    await expect(s.getByRole("button", { name: "Previous step" })).toBeEnabled();

    // The step list names every hop.
    await s.getByText("Steps (5)").click();
    const items = s.getByRole("list", { name: "Steps" }).getByRole("listitem");
    await expect(items).toHaveCount(5);
    await expect(items.first()).toHaveText("Failed: db-prod-01");
    await expect(items.last()).toHaveText("Hop 4: Order management, Online shopping");
  });

  test("Play steps through on its own and stops at the last hop", async ({ page }) => {
    await page.clock.install();
    await openCheckout(page);
    await showFrom(page, "db-prod-01");
    const progress = strip(page).getByTestId("blast-progress");
    await expect(progress).toHaveText("Start · 0 of 6 affected");
    await page.clock.runFor(1600);
    await expect(progress).toHaveText("Hop 1 of 4 · 1 of 6 affected");
    await page.clock.runFor(1500 * 3 + 100);
    await expect(progress).toHaveText("Hop 4 of 4 · 6 of 6 affected");
    await expect(strip(page).getByRole("button", { name: "Play" })).toBeVisible();
    await page.clock.runFor(5000);
    await expect(progress).toHaveText("Hop 4 of 4 · 6 of 6 affected");
    // Play at the end starts again from the failed element.
    await strip(page).getByRole("button", { name: "Play" }).click();
    await expect(progress).toHaveText("Start · 0 of 6 affected");
  });

  test("Dependencies walks the other way: what the element needs", async ({ page }) => {
    await page.clock.install();
    await openCheckout(page);
    await showFrom(page, "Checkout");
    const s = strip(page);
    await s.getByRole("button", { name: "Dependencies" }).click();
    await expect(s.getByRole("button", { name: "Dependencies" })).toHaveAttribute("aria-pressed", "true");
    await expect(s.getByRole("button", { name: "Impact" })).toHaveAttribute("aria-pressed", "false");
    await expect(s.getByRole("heading", { name: "What Checkout needs" })).toBeVisible();
    await expect(s.getByTestId("blast-progress")).toHaveText("Start · 0 of 8 needed");
    await expect(page.getByRole("status")).toHaveText("Dependencies: Checkout needs 8 elements within 3 hops.");
    await s.getByRole("button", { name: "Pause" }).click();
    await s.getByRole("button", { name: "Next step" }).click();
    await expect(node(page, "Customer orders").locator("[data-blast]")).toHaveAttribute("data-blast-hop", "1");
  });

  test("the Inspector opens it too, and Escape closes it and returns focus", async ({ page }) => {
    await openCheckout(page);
    await node(page, "Orders database").click();
    const button = page.getByRole("complementary", { name: "Inspector" }).getByRole("button", { name: "Show blast radius" });
    await button.click();
    await expect(strip(page)).toBeVisible();
    await expect(strip(page).getByRole("button", { name: "Pause" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(strip(page)).toHaveCount(0);
    await expect(page.locator(".react-flow__node [data-blast]")).toHaveCount(0);
    await expect(page.locator(".react-flow__edge.blast")).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  test("works from the keyboard: Shift+F10 on an element, then Close returns focus to it", async ({ page }) => {
    await openCheckout(page);
    const target = node(page, "web-prod-01");
    await target.focus();
    await page.keyboard.press("Shift+F10");
    const menu = page.getByRole("menu", { name: "web-prod-01 menu" });
    await expect(menu.getByRole("menuitem")).toHaveText(["Rename", "Add a relationship…", "Duplicate", "No hints", "Show blast radius", "Select the Infrastructure layer", "Delete"]);
    await menu.getByRole("menuitem", { name: "Show blast radius" }).focus();
    await page.keyboard.press("Enter");
    await expect(strip(page).getByRole("button", { name: "Pause" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(strip(page).getByRole("button", { name: "Next step" })).toBeFocused();
    await strip(page).getByRole("button", { name: "Close" }).focus();
    await page.keyboard.press("Enter");
    await expect(strip(page)).toHaveCount(0);
    await expect(target).toBeFocused();
  });

  test("reduced motion opens paused on the whole radius, with nothing moving", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openCheckout(page);
    await showFrom(page, "db-prod-01");
    await expect(strip(page).getByTestId("blast-progress")).toHaveText("Hop 4 of 4 · 6 of 6 affected");
    await expect(strip(page).getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.locator(".react-flow__node [data-blast]")).toHaveCount(7);
    const path = page.locator(".react-flow__edge.blast-now .react-flow__edge-path").first();
    expect(await path.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
    const pulse = page.locator("[data-blast-current=true]").first();
    expect(await pulse.evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  });

  test("with motion, the current relationships flow toward the affected elements", async ({ page }) => {
    await page.clock.install();
    await openCheckout(page);
    await showFrom(page, "db-prod-01");
    await strip(page).getByRole("button", { name: "Next step" }).click();
    const edge = page.locator(".react-flow__edge.blast-now");
    // db-prod-01's application runs on it: the line is drawn from the application, so impact runs against it.
    await expect(edge).toHaveClass(/blast-reverse/);
    expect(await edge.locator(".react-flow__edge-path").evaluate((el) => getComputedStyle(el).animationName)).toBe("blast-flow-reverse");
  });

  test("closes when its element is deleted, when another model opens, and when presenting", async ({ page }) => {
    await openCheckout(page);
    await showFrom(page, "web-test-01");
    await node(page, "web-test-01").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(strip(page)).toHaveCount(0);

    await showFrom(page, "Checkout");
    await page.getByRole("button", { name: "Present" }).click();
    await expect(strip(page)).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Presentation" })).toHaveCount(0);

    await showFrom(page, "Checkout");
    await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Shared database platform" });
    await expect(strip(page)).toHaveCount(0);
  });

  test("leaves the model unchanged", async ({ page }) => {
    await openCheckout(page);
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
    await showFrom(page, "db-prod-01");
    await strip(page).getByRole("button", { name: "Next step" }).click();
    await strip(page).getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`an open blast radius has no WCAG 2.2 AA violations, and its badges and outlines contrast (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await openCheckout(page);
      await showFrom(page, "db-prod-01");
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations).toEqual([]);
      for (const badge of await page.getByTestId("blast-badge").all()) expect(await contrastOf(badge)).toBeGreaterThanOrEqual(4.5);
      for (const box of await page.locator("[data-blast]").all()) expect(await contrastOf(box, "outline")).toBeGreaterThanOrEqual(3);
      expect(await contrastOf(strip(page).getByTestId("blast-progress"))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
