import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { currentModel, modelButton } from "./model-menu";
import { openExample } from "./examples";

// M92: the model's Business Capabilities as nested tiles, each counting the Business Applications that support it.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const map = (page: Page) => page.getByTestId("capability-map");
const tile = (page: Page, id: string) => map(page).locator(`[data-cap="${id}"] > button`);
const viewsButton = (page: Page) => page.getByRole("button", { name: /^Views/ });

const caps: [string, string, string | null, string][] = [
  ["sell", "Sell", null, "Sales"],
  ["online", "Sell online", "sell", "Digital"],
  ["store", "Sell in store", "sell", "Sales"],
  ["pay", "Take payment", "online", "Digital"],
  ["people", "Manage people", null, ""],
];
const model = {
  schema: 1,
  id: "e2e-capmap",
  name: "Retail",
  created: "2026-11-14T00:00:00.000Z",
  updated: "2026-11-14T00:00:00.000Z",
  nodes: [
    ...caps.map(([id, name, , owner]) => ({ id, class: "business_capability", name, ...(owner ? { attrs: { owner } } : {}) })),
    { id: "shop", class: "business_application", name: "Shop" },
    { id: "pos", class: "business_application", name: "Point of sale" },
    { id: "payments", class: "business_application", name: "Payments" },
  ],
  edges: [
    ...caps.filter((c) => c[2]).map(([id, , parent]) => ({ id: `p-${id}`, from: id, to: parent, type: "reference:parent" })),
    { id: "a1", from: "online", to: "shop", type: "Provided by::Provides" },
    { id: "a2", from: "store", to: "pos", type: "Provided by::Provides" },
    { id: "a3", from: "pay", to: "payments", type: "Provided by::Provides" },
  ],
  views: [{ id: "v1", name: "Sales side", filter: { owner: ["Sales"] }, colorBy: "owner" }],
  layout: Object.fromEntries([...caps.map((c) => c[0]), "shop", "pos", "payments"].map((id, i) => [id, { x: (i % 4) * 280, y: Math.floor(i / 4) * 200 }])),
};

async function open(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await page.getByTestId("import-file").setInputFiles({ name: "retail.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(model)) });
  await expect(currentModel(page)).toHaveText("Retail");
  await saved(page);
}
async function openMap(page: Page) {
  await modelButton(page).click();
  await page.getByRole("button", { name: "Capability map…" }).click();
  await expect(map(page)).toBeVisible();
}

test.describe("capability map (M92, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the Model menu is on the desktop toolbar");

  test("each capability inside its parent, counting the applications that support it and its parts; a tile goes to it", async ({ page }) => {
    await open(page);
    await openMap(page);
    await expect(map(page).getByRole("heading", { name: "Capability map of “Retail”" })).toBeVisible();
    await expect(map(page)).toHaveAccessibleDescription(/^5 Business Capabilities, each inside its parent\./);
    // Two at the top; Sell holds two, and Sell online holds one.
    const within = (id: string) => map(page).locator(`[data-cap="${id}"] > ul > li`);
    await expect(map(page).locator("[data-cap]:not([data-cap] [data-cap])")).toHaveCount(2);
    await expect(within("sell")).toHaveCount(2);
    expect(await within("sell").evaluateAll((els) => els.map((e) => e.getAttribute("data-cap")))).toEqual(["online", "store"]);
    expect(await within("online").evaluateAll((els) => els.map((e) => e.getAttribute("data-cap")))).toEqual(["pay"]);
    await expect(map(page).getByRole("list", { name: "Inside Sell online" })).toBeVisible();
    await expect(tile(page, "sell")).toHaveText("SellNo Business Applications · 3 with its parts");
    await expect(tile(page, "online")).toHaveText("Sell online1 Business Application · 2 with its parts");
    await expect(tile(page, "people")).toHaveText("Manage peopleNo Business Applications");
    await expect(tile(page, "store")).toHaveAccessibleName("Sell in store: 1 Business Application");
    // Coloring by layer (no view): no legend, no colors.
    await expect(page.getByTestId("capability-map-legend")).toHaveCount(0);
    expect(await new AxeBuilder({ page }).withTags(axeTags).include('[data-testid="capability-map"]').analyze().then((r) => r.violations)).toEqual([]);

    // A tile goes to its capability on the canvas, selected, with its details.
    await tile(page, "pay").click();
    await expect(map(page)).toHaveCount(0);
    await expect(page.getByRole("tab", { name: "Details" })).toBeFocused();
    await expect(page.getByRole("complementary", { name: "Inspector" }).getByLabel("Name", { exact: true })).toHaveValue("Take payment");
  });

  test("follows the view: its coloring and legend, the filter fading the rest; saves as SVG and PNG", async ({ page }) => {
    await open(page);
    await viewsButton(page).click();
    await page.getByTestId("views-menu").getByRole("button", { name: /Sales side/ }).click();
    await openMap(page);
    const legend = page.getByTestId("capability-map-legend");
    await expect(legend).toContainText("View: Sales side. Colored by owner, as the view is. Showing 2 of 5 capabilities; the rest are faded.");
    // Only what the capabilities carry, counting those the view keeps.
    await expect(legend.getByRole("listitem")).toHaveText([/Digital\s*0/, /Sales\s*2/, /Not set\s*0/]);
    await expect(map(page).locator('[data-cap="store"]')).toHaveAttribute("data-slot", /\d/);
    await expect(map(page).locator('[data-cap="online"]')).toHaveAttribute("data-faded", "");
    await expect(map(page).locator('[data-cap="sell"]')).not.toHaveAttribute("data-faded");
    // Each tile names its value, and whether the filter leaves it out.
    await expect(tile(page, "sell")).toHaveAccessibleName("Sell: No Business Applications · 3 with its parts (Owner: Sales)");
    await expect(tile(page, "online")).toHaveAccessibleName("Sell online: 1 Business Application · 2 with its parts (Owner: Digital; outside the view's filter)");
    await expect(tile(page, "people")).toHaveAccessibleName("Manage people: No Business Applications (Owner: Not set; outside the view's filter)");
    expect(await new AxeBuilder({ page }).withTags(axeTags).include('[data-testid="capability-map"]').analyze().then((r) => r.violations)).toEqual([]);

    const [svg] = await Promise.all([page.waitForEvent("download"), map(page).getByRole("button", { name: "Save as SVG" }).click()]);
    expect(svg.suggestedFilename()).toBe("retail-capability-map-light.svg");
    const text = await readFile((await svg.path())!, "utf8");
    expect(text).toContain("<title id=\"t\">Capability map: Retail</title>");
    expect(text).toContain("View: Sales side · colored by owner · showing 2 of 5 capabilities");
    await expect(map(page).getByRole("status")).toHaveText("Saved retail-capability-map-light.svg.");

    await map(page).getByLabel("Image theme").selectOption("dark");
    const [png] = await Promise.all([page.waitForEvent("download"), map(page).getByRole("button", { name: "Save as PNG" }).click()]);
    expect(png.suggestedFilename()).toBe("retail-capability-map-dark.png");
    const bytes = await readFile((await png.path())!);
    expect([...bytes.subarray(1, 4)].map((b) => String.fromCharCode(b)).join("")).toBe("PNG");
    await expect(map(page).getByRole("status")).toHaveText(/^Saved retail-capability-map-dark\.png \(\d+ × \d+ px\)\.$/);
  });

  test("from the command palette; Escape closes it and focus goes back; a model with no capabilities says so", async ({ page }) => {
    await open(page);
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Commands" }).getByRole("combobox", { name: "Search commands" }).fill("capability map");
    await page.keyboard.press("Enter");
    await expect(map(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(map(page)).toHaveCount(0);

    // A blank model: nothing to draw, nothing to save.
    await openExample(page, "Blank model");
    await expect(page.getByRole("status").filter({ hasText: "Opened a new blank model." })).toHaveCount(1);
    await openMap(page);
    await expect(map(page)).toHaveAccessibleDescription(/^This model has no Business Capabilities yet\./);
    await expect(map(page).getByRole("button", { name: "Save as SVG" })).toBeDisabled();
    await expect(map(page).getByRole("button", { name: "Save as PNG" })).toBeDisabled();
    await map(page).getByRole("button", { name: "Close" }).click();
    await expect(modelButton(page)).toBeFocused();
  });
});
