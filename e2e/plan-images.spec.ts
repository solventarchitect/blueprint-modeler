import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

// M71: the isometric view and the image exports follow the state shown, and name it.
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const bar = (page: Page) => page.getByTestId("plan-bar");
const picture = (page: Page) => page.getByTestId("iso-picture");
const choose = (page: Page, name: "Plan" | "Iso") => page.getByRole("group", { name: "Projection" }).getByRole("button", { name, exact: true }).click();

async function stateShown(page: Page, which: "Both" | "Current" | "Target") {
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("group", { name: "State shown" }).getByRole("button", { name: which, exact: true }).click();
  await page.keyboard.press("Escape");
}

async function exportSvg(page: Page) {
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Image, light \(SVG\)/ }).click()]);
  return readFile((await download.path())!, "utf8");
}

test.describe("current and target in pictures (M71, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("Current leaves the planned element out of the SVG and the isometric view, and says so; both marks it", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    await openExample(page, "Online Store Checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await node(page, "Orders database").click();
    await inspector(page).getByRole("combobox", { name: "Plan status", exact: true }).selectOption("planned");
    await saved(page);

    // Both: the planned element is in the picture, dotted, and the title block says how it is marked.
    let svg = await exportSvg(page);
    expect(svg).toContain(">Orders database<");
    expect(svg).toMatch(/data-plan="planned"/);
    expect(svg).toMatch(/data-title="view"[^>]*>Current and target: planned dotted, retiring struck through, each labeled · /);

    // Current: left out of the SVG, named in the title block.
    await stateShown(page, "Current");
    svg = await exportSvg(page);
    expect(svg).not.toContain(">Orders database<");
    expect(svg).toMatch(/data-title="view"[^>]*>Current state · showing 13 of 14 elements</);

    // The isometric view follows it, with the bar saying what is left out.
    await choose(page, "Iso");
    await expect(bar(page)).toContainText("Current state");
    await expect(picture(page).locator("[data-iso-el]")).toHaveCount(13);
    await expect(picture(page).locator("[data-iso-label]").filter({ hasText: "Orders database" })).toHaveCount(0);
    svg = await exportSvg(page);
    expect(svg).toContain("data-iso=");
    expect(svg).not.toContain(">Orders database<");
    expect(svg).toMatch(/data-title="view"[^>]*>Current state · /);

    // Back to both, still in isometric: the element returns, tagged Planned.
    await bar(page).getByRole("button", { name: "Show current and target" }).click();
    await expect(picture(page).locator("[data-iso-el]")).toHaveCount(14);
    await expect(picture(page).locator("[data-iso-label]").filter({ hasText: "Orders database" })).toContainText("PLANNED");
  });

  test("in the isometric view, Go to an element the state leaves out shows both again and selects it", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    await openExample(page, "Online Store Checkout");
    await node(page, "Orders database").click();
    await inspector(page).getByRole("combobox", { name: "Plan status", exact: true }).selectOption("planned");
    await stateShown(page, "Current");
    await choose(page, "Iso");
    await expect(picture(page).locator("[data-iso-el]")).toHaveCount(13);

    await page.getByTestId("model-menu-button").click();
    await page.getByRole("button", { name: "Table…" }).click();
    await page.getByTestId("table-dialog").getByRole("button", { name: "Go to Orders database" }).click();
    await expect(bar(page)).toHaveCount(0);
    await expect(picture(page).locator("[data-iso-el]")).toHaveCount(14);
    await expect(picture(page).locator("[data-selected]")).toHaveCount(1);
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue("Orders database");
  });
});
