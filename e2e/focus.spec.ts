import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M74: focus on an element, with everything within 1, 2 or 3 relationships; the rest fades.
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const bar = (page: Page) => page.getByTestId("focus-bar");
const faded = (page: Page) => page.locator(".react-flow__node-csdm.bm-faded");

async function open(page: Page) {
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  // The canvas fits the model when it opens; a double-click lands once it has settled.
  const at = () => page.locator(".react-flow__viewport").evaluate((el) => (el as HTMLElement).style.transform);
  let last = "";
  await expect.poll(async () => {
    const now = await at();
    const still = now === last;
    last = now;
    return still;
  }).toBe(true);
}

test.describe("focus on an element (M74, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "double-click and the keyboard on the desktop");

  test("double-click focuses; 1, 2 or 3 relationships; images follow; Escape shows everything; axe passes", async ({ page }) => {
    await open(page);
    await node(page, "web-prod-01").dblclick();
    await expect(bar(page)).toContainText("web-prod-01");
    await expect(bar(page).getByRole("button", { name: "1 relationship" })).toHaveAttribute("aria-pressed", "true");
    const total = await page.locator(".react-flow__node-csdm").count();
    const kept1 = Number((await page.getByTestId("focus-count").textContent())!.split(" ")[0]);
    expect(kept1).toBeGreaterThan(1);
    await expect(faded(page)).toHaveCount(total - kept1);
    await expect(page.getByRole("status")).toContainText("Focus on “web-prod-01”");

    await bar(page).getByRole("button", { name: "3 relationships" }).click();
    const kept3 = Number((await page.getByTestId("focus-count").textContent())!.split(" ")[0]);
    expect(kept3).toBeGreaterThan(kept1);
    await expect(faded(page)).toHaveCount(total - kept3);
    expect(await new AxeBuilder({ page }).withTags(tags).include('[data-testid="focus-bar"]').analyze().then((r) => r.violations)).toEqual([]);

    // Images follow it, as they follow a filter.
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Image, light \(SVG\)/ }).click()]);
    const svg = await readFile((await download.path())!, "utf8");
    expect(svg).toMatch(/Focus: web-prod-01, within 3 relationships · showing \d+ of \d+ elements/);

    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Escape");
    await expect(bar(page)).toHaveCount(0);
    await expect(faded(page)).toHaveCount(0);
  });

  test("the palette focuses on the selected element; Go to an element outside the focus ends it", async ({ page }) => {
    await open(page);
    await node(page, "Checkout web app").click();
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Focus on");
    await page.keyboard.press("Enter");
    await expect(bar(page)).toContainText("Checkout web app");
    await bar(page).getByRole("button", { name: "1 relationship" }).click();
    // An element outside the focus, found with Go to: the focus ends so it can be shown.
    const outside = page.locator(".react-flow__node-csdm.bm-faded").first();
    const name = (await outside.locator("p.text-sm").first().textContent())!.trim();
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill(name);
    await page.getByRole("option", { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`) }).first().click();
    await expect(bar(page)).toHaveCount(0);
    await expect(node(page, name)).toHaveClass(/selected/);
  });

  test("Escape on the selected element clears the selection first, then ends the focus; keyboard focus stays on the page", async ({ page }) => {
    await open(page);
    await node(page, "web-prod-01").dblclick();
    await expect(bar(page)).toBeVisible();
    await node(page, "web-prod-01").focus();
    await page.keyboard.press("Escape");
    await expect(node(page, "web-prod-01")).not.toHaveClass(/selected/);
    await expect(bar(page)).toBeVisible();
    // From the bar: Show everything ends it, and keyboard focus lands on the element, not the page body.
    await bar(page).getByRole("button", { name: "Show everything" }).click();
    await expect(bar(page)).toHaveCount(0);
    // Focus moves once the bar has gone (on the next tick).
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
  });

  test("a new element added while focused joins the focus; the context menu focuses too", async ({ page }) => {
    await open(page);
    await node(page, "web-prod-01").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Focus on this element" }).click();
    await expect(bar(page)).toContainText("web-prod-01");
    const before = await faded(page).count();
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Add Business Application");
    await page.keyboard.press("Enter");
    await expect(page.locator(".react-flow__node-csdm")).toHaveCount(15);
    await expect(faded(page)).toHaveCount(before);
    await expect(page.locator(".react-flow__node-csdm.selected")).toHaveCount(1);
  });
});
