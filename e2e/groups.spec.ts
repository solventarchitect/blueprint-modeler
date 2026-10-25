import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const dialog = (page: Page) => page.getByTestId("view-dialog");
const legend = (page: Page) => page.getByTestId("view-legend");
const frames = (page: Page) => page.getByTestId("group-frame");
const elements = (page: Page) => page.locator(".react-flow__node-csdm:visible");
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ has: page.getByText(name, { exact: true }) });

async function start(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await saved(page);
}

async function groupBy(page: Page, by: string) {
  await page.getByRole("button", { name: /^Views/ }).click();
  await page.getByTestId("views-menu").getByRole("button", { name: "Filter and color…" }).click();
  await dialog(page).getByRole("group", { name: "Group by" }).getByLabel(by, { exact: true }).check();
}

const closeDialog = async (page: Page) => {
  await dialog(page).getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
};

test.describe("group by (M56, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("frames each group, arranges them side by side in one undo step, and the view keeps its grouping", async ({ page }) => {
    await start(page);
    await groupBy(page, "Service Offering");
    await closeDialog(page);
    await expect(frames(page)).toHaveCount(2);
    await expect(legend(page)).toContainText("Grouped by Service Offering: 2 groups");
    await expect(page.getByRole("button", { name: /^Service Offering Online shopping — North America, \d+ elements: collapse$/ })).toBeVisible();

    const before = await node(page, "Checkout").getAttribute("style");
    await legend(page).getByRole("button", { name: "Arrange by group" }).click();
    await expect(page.getByRole("status")).toContainText("Arranged 2 Service Offering groups side by side.");
    await expect.poll(() => node(page, "Checkout").getAttribute("style")).not.toBe(before);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => node(page, "Checkout").getAttribute("style")).toBe(before);

    // Saved with the view, and back after a reload.
    await page.getByRole("button", { name: /^Views/ }).click();
    await page.getByTestId("views-menu").getByRole("button", { name: "Filter and color…" }).click();
    await dialog(page).getByLabel("View name").fill("By offering");
    await dialog(page).getByRole("button", { name: "Save as new view" }).click();
    await closeDialog(page);
    await saved(page);
    await page.reload();
    await page.getByRole("button", { name: /^Views/ }).click();
    await page.getByTestId("views-menu").getByRole("button", { name: /^By offering/ }).click();
    await expect(frames(page)).toHaveCount(2);
    await expect(legend(page)).toContainText("Grouped by Service Offering");
  });

  test("a group collapses into one block standing in for its elements, and expands again, by keyboard", async ({ page }) => {
    await start(page);
    await groupBy(page, "Business Application");
    await closeDialog(page);
    await expect(frames(page)).toHaveCount(1);
    const all = await elements(page).count();
    const tab = page.getByRole("button", { name: /^Business Application Checkout, 9 elements: collapse$/ });
    await expect(tab).toHaveAttribute("aria-expanded", "true");
    await tab.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText("Business Application “Checkout” collapsed into one block.");
    const block = page.getByTestId("group-node");
    await expect(block).toContainText("Checkout");
    await expect(block).toContainText("9 elements, collapsed");
    await expect(elements(page)).toHaveCount(all - 9);
    await expect(frames(page)).toHaveCount(0);
    // Relationships from the rest of the model now run to the block.
    await expect(page.locator(".react-flow__edge.group-edge").first()).toBeAttached();
    const expand = block.getByRole("button", { name: "Expand Business Application Checkout" });
    await expect(expand).toBeFocused();
    expect(await new AxeBuilder({ page }).withTags(tags).include(".react-flow").analyze().then((r) => r.violations)).toEqual([]);
    await page.keyboard.press("Enter");
    await expect(elements(page)).toHaveCount(all);
    await expect(frames(page)).toHaveCount(1);
    await expect(page.getByTestId("group-frame").getByRole("button")).toBeFocused();
  });

  test("the palette arranges by group; the image export draws the frames", async ({ page }) => {
    await start(page);
    const palette = page.getByRole("dialog", { name: "Commands" });
    const search = palette.getByRole("combobox", { name: "Search commands" });
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+k`);
    await search.fill("Arrange by group");
    await expect(palette.getByRole("option").first()).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");
    await groupBy(page, "Service Offering");
    await closeDialog(page);
    await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+k`);
    await search.fill("Arrange by group");
    await expect(palette.getByRole("option").first()).toContainText("Arrange by group");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText("Arranged 2 Service Offering groups side by side.");
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Image, light \(SVG\)/ }).click()]);
    const svg = await readFile((await download.path())!, "utf8");
    expect(svg.match(/data-group-frame=/g)).toHaveLength(2);
    expect(svg).toContain("grouped by Service Offering");
  });
});
