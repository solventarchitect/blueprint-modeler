import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel, modelButton } from "./model-menu";

// M70: saved flows, built step by step and played in the strip above the canvas.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const dialog = (page: Page) => page.getByTestId("flows-dialog");
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const strip = (page: Page) => page.getByRole("region", { name: "Saved flow" });

async function start(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await saved(page);
}

async function openFlows(page: Page) {
  await modelButton(page).click();
  await page.getByRole("button", { name: "Saved flows…" }).click();
  await expect(dialog(page)).toBeVisible();
}

async function step(page: Page, text: string) {
  await dialog(page).getByLabel(/^Next step/).selectOption({ label: text });
  await dialog(page).getByRole("button", { name: "Add step" }).click();
}

/** "Customer places an order": the offering, its service, the app, its host. */
async function makeOrderFlow(page: Page) {
  await openFlows(page);
  await dialog(page).getByLabel("New flow name").fill("Customer places an order");
  await dialog(page).getByRole("button", { name: "Make flow" }).click();
  await expect(dialog(page).getByLabel("Starts at")).toBeFocused();
  await dialog(page).getByLabel("Starts at").selectOption({ label: "Online shopping — North America (Business Service Offering)" });
  await step(page, "Online shopping — North America → Checkout — production (Depends on)");
  await step(page, "Checkout — production → Checkout web app (Depends on)");
  await step(page, "Checkout web app → web-prod-01 (Runs on)");
  await expect(dialog(page).getByTestId("flow-steps").getByRole("listitem")).toHaveText([
    "Online shopping — North America → Checkout — production (Depends on)",
    "Checkout — production → Checkout web app (Depends on)",
    "Checkout web app → web-prod-01 (Runs on)",
  ]);
}

test.describe("saved flows (M70, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("build a flow step by step, take a step back, play it with numbered elements, kept after a reload; axe passes", async ({ page }) => {
    await start(page);
    await makeOrderFlow(page);
    expect(await new AxeBuilder({ page }).withTags(axeTags).include('[data-testid="flows-dialog"]').analyze().then((r) => r.violations)).toEqual([]);

    // Take back the last step, and add it again.
    await dialog(page).getByRole("button", { name: "Take back the last step" }).click();
    await expect(dialog(page).getByTestId("flow-steps").getByRole("listitem")).toHaveCount(2);
    await step(page, "Checkout web app → web-prod-01 (Runs on)");
    await expect(dialog(page).getByTestId("flow")).toContainText("3 steps");

    // Play: the strip names the flow, steps through it, numbers what each step reaches.
    await dialog(page).getByRole("button", { name: "Play flow Customer places an order" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(strip(page)).toBeVisible();
    await expect(strip(page).getByRole("heading", { name: "Customer places an order" })).toBeVisible();
    // It plays to the end by itself; then step back by hand.
    await expect(strip(page).getByTestId("blast-progress")).toHaveText("Step 3 of 3", { timeout: 15000 });
    await strip(page).getByRole("button", { name: "Previous step" }).click();
    await expect(strip(page).getByTestId("blast-progress")).toHaveText("Step 2 of 3");
    await expect(node(page, "Checkout web app").getByTestId("blast-badge")).toHaveText("2");
    await expect(node(page, "Checkout web app")).toHaveAttribute("aria-label", /step 2 of the flow/);
    await expect(page.getByText("Step 2: Checkout — production to Checkout web app.")).toBeAttached();
    await strip(page).getByRole("button", { name: "Close" }).click();
    await expect(strip(page)).toHaveCount(0);

    await saved(page);
    await page.reload();
    await saved(page);
    await openFlows(page);
    await expect(dialog(page).getByTestId("flow")).toContainText("Customer places an order");
    await expect(dialog(page).getByTestId("flow")).toContainText("3 steps");
  });

  test("a deleted relationship leaves the flow, one undo brings both back; the palette plays a flow; the GIF exports", async ({ page }) => {
    await start(page);
    await makeOrderFlow(page);
    await dialog(page).getByRole("button", { name: "Close" }).click();

    // Delete the app's host and its relationship: the flow loses its last step; Undo puts both back.
    await node(page, "web-prod-01").click();
    await page.keyboard.press("Delete");
    await expect(node(page, "web-prod-01")).toHaveCount(0);
    await openFlows(page);
    await expect(dialog(page).getByTestId("flow")).toContainText("2 steps");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await openFlows(page);
    await expect(dialog(page).getByTestId("flow")).toContainText("3 steps");
    await dialog(page).getByRole("button", { name: "Close" }).click();

    // The palette plays it.
    await page.keyboard.press(`${mod}+k`);
    const palette = page.getByRole("dialog", { name: "Commands" });
    await palette.getByRole("combobox", { name: "Search commands" }).fill("Play flow");
    await page.keyboard.press("Enter");
    await expect(strip(page)).toBeVisible();

    // And it saves as a GIF.
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Saved flow animation \(GIF\)/ }).click()]);
    expect(download.suggestedFilename()).toMatch(/-flow-customer-places-an-order\.gif$/i);
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(0, 6).toString("latin1")).toBe("GIF89a");
  });
});
