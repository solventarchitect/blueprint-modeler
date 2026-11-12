import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

// M77: color by plan status and by tag, saved so older versions still open the file.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const dialog = (page: Page) => page.getByTestId("view-dialog");
const legend = (page: Page) => page.getByTestId("view-legend");
const colorGroup = (page: Page) => dialog(page).getByRole("group", { name: "Color by" });
const tagInput = (page: Page) => inspector(page).getByRole("combobox", { name: "Add a tag" });

async function openDialog(page: Page) {
  await page.getByRole("button", { name: /^Views/ }).click();
  await page.getByTestId("views-menu").getByRole("button", { name: "Filter and color…" }).click();
  await expect(dialog(page)).toBeVisible();
}

async function select(page: Page, name: string) {
  await node(page, name).click();
  await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue(name);
}

async function exportFile(page: Page, item: RegExp) {
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: item }).click()]);
  return readFile((await download.path())!, "utf8");
}

test.describe("color by plan status and by tag (M77, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("offered once there is something to color by; legend, labels, saved view, file and image agree", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    await openExample(page, "Online Store Checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");

    // Nothing planned or tagged yet: neither coloring is offered.
    await openDialog(page);
    await expect(colorGroup(page).getByLabel("Plan status", { exact: true })).toHaveCount(0);
    await expect(colorGroup(page).getByLabel("Tag", { exact: true })).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Close" }).click();

    await select(page, "Orders database");
    await inspector(page).getByRole("combobox", { name: "Plan status", exact: true }).selectOption("planned");
    await select(page, "Checkout web app");
    await tagInput(page).fill("Team Storefront, Program X");
    await tagInput(page).press("Enter");
    await select(page, "Orders database");
    await tagInput(page).fill("team storefront");
    await tagInput(page).press("Enter");
    await saved(page);

    // Plan status: Live and Planned, each with its own marker, named in the element's label.
    await openDialog(page);
    await colorGroup(page).getByLabel("Plan status", { exact: true }).check();
    await expect(legend(page)).toContainText("Colored by plan status");
    await expect(legend(page).getByRole("listitem")).toHaveText([/Live\s*13/, /Planned\s*1/]);
    await expect(node(page, "Orders database").locator("[data-slot]")).toHaveAttribute("data-slot", "1");
    await expect(node(page, "Orders database")).toHaveAttribute("aria-label", /Plan status: Planned/);
    expect(await new AxeBuilder({ page }).withTags(axeTags).include('[data-testid="view-dialog"]').analyze().then((r) => r.violations)).toEqual([]);

    // Saved, it keeps layer colors for older versions and adds the new coloring beside them.
    await dialog(page).getByLabel("View name").fill("By plan");
    await dialog(page).getByRole("button", { name: "Save as new view" }).click();
    await expect(page.getByRole("status")).toContainText("Saved the view “By plan”.");

    // Tag: each element by its first tag, ignoring case; the untagged under Not tagged.
    await colorGroup(page).getByLabel("Tag", { exact: true }).check();
    // M86: with Tag chosen, the Tags to color by group says how it works; none ticked is each element's first tag.
    await expect(dialog(page)).toContainText("None ticked: each element's first tag.");
    await expect(legend(page)).toContainText("Colored by tag");
    await expect(legend(page)).toContainText("(edited)");
    await expect(legend(page).getByRole("listitem")).toHaveText([/Team Storefront\s*2/, /Not tagged\s*12/]);
    await expect(node(page, "Orders database")).toHaveAttribute("aria-label", /Tag: Team Storefront/);
    await dialog(page).getByRole("button", { name: "Close" }).click();

    // Back to the saved view: plan status again, and the menu says so.
    await page.getByRole("button", { name: /^Views/ }).click();
    await expect(page.getByTestId("views-menu").getByRole("button", { name: /By plan/ })).toContainText("Plan status colors");
    await page.getByTestId("views-menu").getByRole("button", { name: /By plan/ }).click();
    await expect(legend(page)).toContainText("Colored by plan status");
    await saved(page);

    const json = JSON.parse(await exportFile(page, /Model file \(JSON\)/));
    expect(json.views).toEqual([{ id: expect.any(String), name: "By plan", filter: {}, colorBy: "layer", colorByExt: "plan" }]);

    const svg = await exportFile(page, /Image, light \(SVG\)/);
    expect(svg).toMatch(/data-title="view"[^>]*>View: By plan · colored by plan status/);
    expect(svg).toContain(">Planned (1)<");
    expect(svg).toContain(">Live (13)<");
  });
});
