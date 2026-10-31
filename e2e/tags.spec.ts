import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

// M69: tags on elements, edited in the Inspector and the table, and filtered on.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const tagInput = (page: Page) => inspector(page).getByRole("combobox", { name: "Add a tag" });
/** Each tag's text (its Remove button aside). */
const chips = (page: Page) => inspector(page).getByRole("list", { name: "Tags" }).getByRole("listitem").locator(":scope > span");
const dialog = (page: Page) => page.getByTestId("view-dialog");

async function start(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await saved(page);
}

async function tag(page: Page, name: string, text: string) {
  await node(page, name).click();
  await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue(name);
  await tagInput(page).fill(text);
  await tagInput(page).press("Enter");
}

test.describe("tags (M69, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("add several at once, once each ignoring case; remove one; one undo step each; kept after a reload; axe passes", async ({ page }) => {
    await start(page);
    await tag(page, "Checkout web app", "Team Storefront, Program X, team storefront");
    await expect(chips(page)).toHaveText(["Team Storefront", "Program X"]);
    await expect(tagInput(page)).toBeFocused();
    await tagInput(page).fill("program x");
    await tagInput(page).press("Enter");
    await expect(inspector(page).getByRole("status").filter({ hasText: "Already tagged with that." })).toBeAttached();
    await expect(chips(page)).toHaveCount(2);
    expect(await new AxeBuilder({ page }).withTags(axeTags).include('[aria-label="Inspector"]').analyze().then((r) => r.violations)).toEqual([]);

    await inspector(page).getByRole("button", { name: "Remove tag Program X" }).click();
    await expect(chips(page)).toHaveText(["Team Storefront"]);
    // Focus stays in the list: the Remove button before it.
    await expect(inspector(page).getByRole("button", { name: "Remove tag Team Storefront" })).toBeFocused();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(chips(page)).toHaveText(["Team Storefront", "Program X"]);

    await saved(page);
    await page.reload();
    await saved(page);
    await node(page, "Checkout web app").click();
    await expect(chips(page)).toHaveText(["Team Storefront", "Program X"]);
  });

  test("filter by tag in Filter and color; the palette finds an element by its tag; the table edits tags", async ({ page }) => {
    await start(page);
    await tag(page, "Checkout web app", "Team Storefront");
    await tag(page, "Orders database", "team storefront, Billing");

    await page.getByRole("button", { name: /^Views/ }).click();
    await page.getByTestId("views-menu").getByRole("button", { name: "Filter and color…" }).click();
    await expect(dialog(page)).toBeVisible();
    const group = dialog(page).getByRole("group", { name: "Tag", exact: true });
    await expect(group.getByRole("checkbox")).toHaveCount(3);
    await group.getByLabel("Team Storefront", { exact: true }).click();
    await expect(dialog(page).getByTestId("view-count")).toHaveText("Showing 2 of 14 elements");
    await group.getByLabel("Not tagged", { exact: true }).click();
    await expect(dialog(page).getByTestId("view-count")).toHaveText("Showing 14 of 14 elements");
    await dialog(page).getByRole("button", { name: "Close" }).click();

    // The palette finds an element by one of its tags.
    await page.keyboard.press(`${mod}+k`);
    const palette = page.getByRole("dialog", { name: "Commands" });
    await palette.getByRole("combobox", { name: "Search commands" }).fill("billing");
    await expect(palette.getByRole("option").first()).toHaveText(/Orders database/);
    await page.keyboard.press("Escape");

    // The table shows and edits them, as a comma-separated list.
    await page.getByTestId("model-menu-button").click();
    await page.getByRole("button", { name: "Table…" }).click();
    const table = page.getByTestId("table-dialog");
    const cell = table.getByLabel("Tags of Orders database");
    await expect(cell).toHaveValue("team storefront, Billing");
    await cell.fill("Billing, Data");
    await cell.press("Enter");
    await table.getByRole("button", { name: "Go to Orders database" }).click();
    await expect(chips(page)).toHaveText(["Billing", "Data"]);
  });
});
