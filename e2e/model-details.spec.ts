import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel, modelButton, modelMenu, openStoredModel } from "./model-menu";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const details = (page: Page) => page.getByRole("tabpanel", { name: "Details" });
const titleBlock = (page: Page) => page.getByTestId("canvas-title-block");

async function start(page: Page, example = "Online Store Checkout") {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, example);
  await expect(currentModel(page)).toHaveText(example);
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
}

async function setDetails(page: Page, values: { description?: string; artifactId?: string }) {
  if (values.artifactId !== undefined) {
    await details(page).getByLabel("Artifact ID").fill(values.artifactId);
    await details(page).getByLabel("Artifact ID").press("Tab");
  }
  if (values.description !== undefined) {
    await details(page).getByLabel("Description").fill(values.description);
    await details(page).getByLabel("Description").press("Tab");
  }
}

test.describe("model details (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the Details tab edits an optional description and Artifact ID; the canvas shows them only when set", async ({ page }) => {
    await start(page);
    await expect(details(page).getByLabel("Model name")).toHaveValue("Online Store Checkout");
    await expect(details(page).getByLabel("Description")).toHaveValue(/checkout/);
    await expect(details(page).getByLabel("Artifact ID")).toHaveValue("BM-EX-001");
    await expect(titleBlock(page).getByTestId("canvas-title")).toHaveText("Online Store Checkout");
    // Examples come with a description and a sequenced Artifact ID; clearing them clears the canvas.
    await expect(page.getByTestId("canvas-artifact")).toHaveText("BM-EX-001");
    await expect(page.getByTestId("canvas-description")).toContainText("checkout");
    await setDetails(page, { artifactId: "", description: "" });
    await expect(page.getByTestId("canvas-artifact")).toHaveCount(0);
    await expect(page.getByTestId("canvas-description")).toHaveCount(0);
    // The date is always shown: today, the day the example was made, and it can be changed.
    const today = new Date().toISOString().slice(0, 10);
    await expect(page.getByTestId("canvas-date")).toHaveAttribute("datetime", today);
    await expect(details(page).getByLabel("Date")).toHaveValue(today);
    await details(page).getByLabel("Date").fill("2026-03-15");
    await expect(page.getByTestId("canvas-date")).toHaveText("Mar 15, 2026");

    await setDetails(page, { artifactId: "EA-0042", description: "How an order moves from the web store to the orders database." });
    await expect(page.getByTestId("canvas-artifact")).toHaveText("EA-0042");
    await expect(titleBlock(page).locator("svg")).toHaveCount(1);
    await expect(page.getByTestId("canvas-description")).toHaveText("How an order moves from the web store to the orders database.");
    // The block sits above the diagram: its bottom is above the highest element.
    const block = (await titleBlock(page).boundingBox())!;
    const top = Math.min(...(await page.locator(".react-flow__node").evaluateAll((ns) => ns.map((n) => n.getBoundingClientRect().top))));
    expect(block.y + block.height).toBeLessThanOrEqual(top);

    // One undo step each; clearing a field removes it from the canvas.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByTestId("canvas-description")).toHaveCount(0);
    await expect(details(page).getByLabel("Description")).toHaveValue("");
    await setDetails(page, { artifactId: "" });
    await expect(page.getByTestId("canvas-artifact")).toHaveCount(0);

    await setDetails(page, { artifactId: "EA-0042", description: "Order flow." });
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.reload();
    await expect(page.getByTestId("canvas-artifact")).toHaveText("EA-0042");
    await expect(page.getByTestId("canvas-description")).toHaveText("Order flow.");
  });

  test("present mode and the image export carry the title block", async ({ page }) => {
    await start(page);
    await setDetails(page, { artifactId: "EA-0042", description: "Order flow for the web store." });
    await page.getByRole("button", { name: "Present" }).click();
    await expect(page.getByTestId("canvas-artifact")).toHaveText("EA-0042");
    await expect(page.getByTestId("canvas-description")).toHaveText("Order flow for the web store.");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^Image, light/ }).click()]);
    const svg = await readFile((await download.path())!, "utf8");
    expect(svg).toMatch(/data-title="name"[^>]*>Online Store Checkout</);
    expect(svg).toContain(">EA-0042<");
    expect(svg).toMatch(/data-title="date"[^>]*>[A-Z][a-z]{2} \d{1,2}, \d{4}</);
    expect(svg).toContain(">Order flow for the web store.<");
  });

  test("the Model menu lists stored models with their details, counts and dates, and opens one", async ({ page }) => {
    await start(page);
    await setDetails(page, { artifactId: "EA-0042", description: "How an order moves from the web store to the orders database." });
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await openExample(page, "HR Self-Service Portal");
    await expect(currentModel(page)).toHaveText("HR Self-Service Portal");

    const button = modelButton(page);
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    const menu = modelMenu(page);
    await expect(menu.getByRole("heading", { name: /Models in this browser/ })).toBeVisible();
    const checkout = menu.getByRole("button", { name: "Online Store Checkout", exact: true });
    await expect(checkout).toContainText("EA-0042");
    await expect(checkout).toContainText("How an order moves");
    await expect(checkout).toContainText("14 elements · 13 relationships");
    await expect(checkout).toContainText(/Updated /);
    await expect(menu.getByRole("button", { name: "HR Self-Service Portal", exact: true })).toHaveAttribute("aria-current", "true");

    await checkout.click();
    await expect(menu).toBeHidden();
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await expect(button).toBeFocused();
    await expect(page.getByTestId("canvas-artifact")).toHaveText("EA-0042");
  });

  test("the Model menu works from the keyboard and closes on Escape or a click outside", async ({ page }) => {
    await start(page);
    const button = modelButton(page);
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(modelMenu(page)).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(modelMenu(page).getByRole("button").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(modelMenu(page)).toBeHidden();
    await expect(button).toBeFocused();
    await button.click();
    await page.mouse.click(600, 600);
    await expect(modelMenu(page)).toBeHidden();
    await openStoredModel(page, "Online Store Checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the open Model menu and the title block have no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await start(page);
      await setDetails(page, { artifactId: "EA-0042", description: "Order flow for the web store." });
      await modelButton(page).click();
      await expect(modelMenu(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});

for (const width of [768, 1024, 1536]) {
  test(`the open Model menu fits at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await modelButton(page).click();
    const box = (await modelMenu(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
}
