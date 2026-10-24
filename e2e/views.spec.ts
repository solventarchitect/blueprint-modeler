import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ has: page.getByText(name, { exact: true }) });
/** An optional property field; its accessible name starts with the label and goes on with the help text. */
const prop = (page: Page, label: "Environment" | "Owner") => inspector(page).getByRole("combobox", { name: new RegExp(`^${label} `) });
const viewsButton = (page: Page) => page.getByRole("button", { name: /^Views/ });
const viewsMenu = (page: Page) => page.getByTestId("views-menu");
const dialog = (page: Page) => page.getByTestId("view-dialog");
const legend = (page: Page) => page.getByTestId("view-legend");
const faded = (page: Page) => page.locator(".react-flow__node.bm-faded");
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");

async function start(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await saved(page);
}

/** Selects an element and sets its properties in the Inspector, each committed with Tab. */
async function setProps(page: Page, name: string, props: { lifecycle?: string; environment?: string; owner?: string }) {
  await node(page, name).click();
  await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue(name);
  if (props.lifecycle !== undefined) await inspector(page).getByLabel("Life cycle stage").selectOption(props.lifecycle);
  for (const key of ["environment", "owner"] as const) {
    const value = props[key];
    if (value === undefined) continue;
    const field = prop(page, key === "environment" ? "Environment" : "Owner");
    await field.fill(value);
    await field.press("Tab");
  }
}

async function openDialog(page: Page) {
  await viewsButton(page).click();
  await viewsMenu(page).getByRole("button", { name: "Filter and color…" }).click();
  await expect(dialog(page)).toBeVisible();
}

const tick = (page: Page, group: string, value: string) => dialog(page).getByRole("group", { name: group, exact: true }).getByLabel(value, { exact: true }).click();
const colorBy = (page: Page, by: string) => dialog(page).getByRole("group", { name: "Color by" }).getByLabel(by, { exact: true }).check();

/** Two hosts in Production, one in Test; the view keeps Production, colored by environment. */
async function productionView(page: Page) {
  await setProps(page, "db-prod-01", { environment: "Production", lifecycle: "Operational" });
  await setProps(page, "web-prod-01", { environment: "Production" });
  await setProps(page, "web-test-01", { environment: "Test" });
  await openDialog(page);
  await colorBy(page, "Environment");
  await tick(page, "Environment", "Production");
  await expect(dialog(page).getByTestId("view-count")).toHaveText("Showing 2 of 14 elements");
}

async function saveAs(page: Page, name: string) {
  await dialog(page).getByLabel("View name").fill(name);
  await dialog(page).getByRole("button", { name: "Save as new view" }).click();
  await expect(page.getByRole("status")).toContainText(`Saved the view “${name}”.`);
  await dialog(page).getByRole("button", { name: "Close" }).click();
  await expect(dialog(page)).toHaveCount(0);
}

async function exportFile(page: Page, item: RegExp) {
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: item }).click()]);
  return { name: download.suggestedFilename(), text: await readFile((await download.path())!, "utf8") };
}

test.describe("saved views, filters and color by (M54, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only; mobile has its own test");

  test("an element's life cycle stage, environment and owner are set in the Inspector, one undo step each, and kept", async ({ page }) => {
    await start(page);
    await node(page, "db-prod-01").click();
    // A Host follows the tangible or logical life cycle; the stages come from the white paper.
    const stage = inspector(page).getByLabel("Life cycle stage");
    await expect(stage.locator("option")).toContainText(["Not set", "Purchase", "Design", "Inventory", "Deploy", "Operational", "End of Operation", "End of Life", "Defective", "Missing"]);
    await expect(inspector(page).getByRole("link", { name: /^CSDM 5 white paper \(opens in a new tab\)/ })).toBeVisible();
    await setProps(page, "db-prod-01", { lifecycle: "Operational", environment: "  Production ", owner: "Platform team" });
    await expect(prop(page, "Environment")).toHaveValue("Production");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(prop(page, "Owner")).toHaveValue("");
    await expect(prop(page, "Environment")).toHaveValue("Production");
    await saved(page);
    await page.reload();
    await node(page, "db-prod-01").click();
    await expect(inspector(page).getByLabel("Life cycle stage")).toHaveValue("Operational");
    await expect(prop(page, "Environment")).toHaveValue("Production");
  });

  test("a filter fades the rest, which can't be selected; color by shows a legend with markers and counts", async ({ page }) => {
    await start(page);
    await productionView(page);
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(faded(page)).toHaveCount(12);
    await expect(page.locator(".react-flow__edge.faded").first()).toBeAttached();
    await expect(viewsButton(page)).toHaveAccessibleName("Views: Unsaved");
    // Coloring never relies on color alone: every element has a marker, and the legend names each value.
    await expect(page.getByTestId("slot-marker")).toHaveCount(14);
    await expect(node(page, "db-prod-01").locator("[data-slot]")).toHaveAttribute("data-slot", "0");
    await expect(legend(page)).toContainText("Colored by environment");
    await expect(legend(page).getByRole("listitem")).toHaveText([/Production\s*2/, /Test\s*0/, /Not set\s*0/]);
    await expect(legend(page)).toContainText("Showing 2 of 14 elements; the rest are faded.");
    // A faded element is out of reach: clicking it selects nothing.
    await node(page, "Checkout web app").click({ force: true });
    // Nothing is selected: the Inspector shows no element.
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveCount(0);
    await expect(node(page, "Checkout web app")).toHaveAttribute("aria-label", /Environment: Not set/);
    // Show all brings everything back in layer colors.
    await legend(page).getByRole("button", { name: "Show all" }).click();
    await expect(faded(page)).toHaveCount(0);
    await expect(legend(page)).toHaveCount(0);
    await expect(page.getByTestId("slot-marker")).toHaveCount(0);
  });

  test("a selected element the view fades is let go and can't be deleted; Go to lifts the filter; Show all keeps focus", async ({ page }) => {
    await start(page);
    await setProps(page, "db-prod-01", { environment: "Production" });
    await node(page, "Checkout web app").click();
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue("Checkout web app");
    await openDialog(page);
    await tick(page, "Environment", "Production");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    // Faded, so no longer selected: Delete removes nothing.
    await expect(node(page, "Checkout web app")).toHaveClass(/bm-faded/);
    // Nothing is selected: the Inspector shows no element.
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveCount(0);
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Delete");
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
    // Go to a faded element: the filter lifts (the coloring stays) and it is selected.
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Checkout web app");
    await page.keyboard.press("Enter");
    await expect(faded(page)).toHaveCount(0);
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue("Checkout web app");
    // Show all in the legend: the legend goes, and focus moves to the Views button.
    await openDialog(page);
    await colorBy(page, "Environment");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await legend(page).getByRole("button", { name: "Show all" }).click();
    await expect(legend(page)).toHaveCount(0);
    await expect(viewsButton(page)).toBeFocused();
  });

  test("save, switch, rename and delete a view, each change one undo step; the palette switches views", async ({ page }) => {
    await start(page);
    await productionView(page);
    await saveAs(page, "Production estate");
    await expect(viewsButton(page)).toHaveAccessibleName("Views: Production estate");
    // Changing the view in use marks it edited until it is updated or another view is chosen.
    await openDialog(page);
    await colorBy(page, "Layer");
    await expect(viewsButton(page)).toHaveAccessibleName("Views: Production estate (edited)");
    await expect(legend(page)).toContainText("View: Production estate (edited)");
    await colorBy(page, "Environment");
    await expect(viewsButton(page)).toHaveAccessibleName("Views: Production estate");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await viewsButton(page).click();
    await expect(viewsMenu(page).getByRole("button", { name: /Production estate/ })).toHaveAttribute("aria-pressed", "true");
    await viewsMenu(page).getByRole("button", { name: /All elements/ }).click();
    await expect(page.getByRole("status")).toContainText("Showing all elements, in layer colors.");
    await expect(faded(page)).toHaveCount(0);

    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("View: Production");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status")).toContainText("View “Production estate”: 2 of 14 elements, environment colors.");
    await expect(faded(page)).toHaveCount(12);

    // Rename it, then undo the rename.
    await openDialog(page);
    await dialog(page).getByLabel("View name").fill("Prod");
    await dialog(page).getByRole("button", { name: "Update “Production estate”" }).click();
    await expect(viewsButton(page)).toHaveAccessibleName("Views: Prod");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(viewsButton(page)).toHaveAccessibleName("Views: Production estate");

    // Delete it: its filter stays on screen, unsaved; undo brings the view back.
    await openDialog(page);
    await dialog(page).getByRole("button", { name: "Delete view" }).click();
    await expect(page.getByRole("status")).toContainText("Deleted the view “Production estate”.");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(viewsButton(page)).toHaveAccessibleName("Views: Unsaved");
    await expect(faded(page)).toHaveCount(12);
    await page.getByRole("button", { name: "Undo" }).click();
    await viewsButton(page).click();
    await expect(viewsMenu(page).getByRole("button", { name: /Production estate/ })).toBeVisible();
    await page.keyboard.press("Escape");

    // Show all elements from the palette.
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Show all elements");
    await page.keyboard.press("Enter");
    await expect(faded(page)).toHaveCount(0);
  });

  test("views travel in the model file and the share link; images follow the view, data exports carry the whole model", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await start(page);
    await productionView(page);
    await saveAs(page, "Production estate");
    await saved(page);

    const json = JSON.parse((await exportFile(page, /Model file \(JSON\)/)).text);
    expect(json.schema).toBe(1);
    expect(json.nodes).toHaveLength(14);
    expect(json.views).toEqual([{ id: expect.any(String), name: "Production estate", filter: { environment: ["Production"] }, colorBy: "environment" }]);
    expect(json.nodes.find((n: { name: string }) => n.name === "db-prod-01").attrs).toMatchObject({ environment: "Production", lifecycle: "Operational" });

    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("button", { name: /^Copy link to this model/ }).click();
    const url = await page.evaluate(() => navigator.clipboard.readText());
    const inLink = JSON.parse(inflateRawSync(Buffer.from(url.split("#model=1.")[1] ?? "", "base64url")).toString());
    expect(inLink.views).toEqual(json.views);

    for (const theme of ["dark", "light"] as const) {
      const svg = (await exportFile(page, new RegExp(`Image, ${theme} \\(SVG\\)`))).text;
      expect(svg).toMatch(/data-title="view"[^>]*>View: Production estate · colored by environment · showing 2 of 14 elements</);
      expect(svg.match(/<g data-faded="">/g) ?? []).toHaveLength(12);
      expect(svg).not.toContain('opacity="0.28"');
      expect(svg).toContain(">Production (2)<");
    }

    // Importing the file brings the view back, ready in the Views menu.
    await page.getByTestId("import-file").setInputFiles({ name: "estate.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(json)) });
    await expect(page.getByRole("status")).toContainText("as a copy");
    await expect(viewsButton(page)).toHaveAccessibleName("Views");
    await viewsButton(page).click();
    await viewsMenu(page).getByRole("button", { name: /Production estate/ }).click();
    await expect(faded(page)).toHaveCount(12);
  });

  for (const width of [1280, 1366]) {
    test(`the Views button keeps its width, so the toolbar doesn't reflow when a view is chosen (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await start(page);
      const row = () => page.getByRole("button", { name: /^Layout/ }).evaluate((b) => Math.round(b.getBoundingClientRect().top));
      const modelRow = await page.getByRole("button", { name: "Manage…" }).evaluate((b) => Math.round(b.getBoundingClientRect().top));
      // The Arrange group shares the first row with the Model group, as before Views was added.
      expect(await row()).toBe(modelRow);
      const width0 = (await viewsButton(page).boundingBox())!.width;
      await productionView(page);
      await saveAs(page, "A view with a long name that would push the toolbar");
      await expect(page.getByTestId("views-active")).toBeVisible();
      expect(await row()).toBe(modelRow);
      expect((await viewsButton(page).boundingBox())!.width).toBeLessThanOrEqual(width0 + 12);
    });
  }

  for (const scheme of ["dark", "light"] as const) {
    test(`axe passes with the dialog open and with the legend showing (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await start(page);
      await productionView(page);
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
      await dialog(page).getByRole("button", { name: "Close" }).click();
      await expect(legend(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});

test.describe("views on a phone (M54)", () => {
  test.skip(({ isMobile }) => !isMobile, "mobile only");

  test("the Filter and color dialog fits the screen and colors the read-only canvas", async ({ page }) => {
    await page.goto("/editor?example=checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await openDialog(page);
    const box = (await dialog(page).boundingBox())!;
    const width = page.viewportSize()!.width;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await colorBy(page, "Owner");
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(legend(page)).toContainText("Colored by owner");
    await expect(legend(page).getByRole("listitem")).toHaveText([/Not set\s*14/]);
  });
});
