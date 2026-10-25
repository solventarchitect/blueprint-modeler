import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { settled } from "./layout";
import { currentModel } from "./model-menu";

// M63: set life cycle stage, environment or owner on several selected elements at once.
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const panel = (page: Page) => page.getByTestId("selection-panel");
const status = (page: Page) => page.getByRole("status");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });

async function open(page: Page) {
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
  await settled(page);
}

/** Shift+click, holding Shift until React Flow has seen it (as in guides.spec). */
async function shiftClick(page: Page, n: Locator) {
  await page.keyboard.down("Shift");
  await expect(page.locator(".react-flow__pane.selection")).toBeAttached();
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await n.click();
  await page.keyboard.up("Shift");
}

/** A click on an element of a selection keeps the selection (to drag them together): clear it first. */
async function clear(page: Page) {
  const button = panel(page).getByRole("button", { name: "Clear selection" });
  if (await button.isVisible()) await button.click();
}

async function select(page: Page, names: string[]) {
  await clear(page);
  await node(page, names[0]!).click();
  for (const name of names.slice(1)) await shiftClick(page, node(page, name));
  await expect(panel(page).getByRole("heading", { name: `${names.length} elements selected` })).toBeVisible();
}

/** The value one element has, read back in the Inspector. */
async function valueOf(page: Page, name: string, field: "Environment" | "Owner" | "Life cycle stage") {
  await clear(page);
  await node(page, name).click();
  await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue(name);
  const f = field === "Life cycle stage" ? inspector(page).getByLabel(field) : inspector(page).getByRole("combobox", { name: new RegExp(`^${field} `) });
  return f.inputValue();
}

test.describe("set a property on several elements (M63, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("environment and owner apply to every selected element in one undo step each; empty clears", async ({ page }) => {
    await open(page);
    const hosts = ["web-prod-01", "db-prod-01", "web-test-01"];
    await select(page, hosts);
    const section = panel(page).getByRole("region", { name: "Set for all 3" });
    const env = section.getByLabel("Environment", { exact: true });
    await expect(env).toHaveAttribute("placeholder", "Not set");
    await env.fill("Production");
    await env.press("Enter");
    await expect(status(page)).toContainText("Set environment “Production” on 3 elements.");
    const owner = section.getByLabel("Owner", { exact: true });
    await owner.fill("Platform team");
    await section.getByRole("button", { name: "Set owner on all 3" }).click();
    await expect(status(page)).toContainText("Set owner “Platform team” on 3 elements.");
    // Again: nothing changes, and it says so.
    await section.getByRole("button", { name: "Set owner on all 3" }).click();
    await expect(status(page)).toContainText("All 3 already have owner “Platform team”.");
    for (const h of hosts) expect(await valueOf(page, h, "Environment")).toBe("Production");
    // One undo takes the owner off all three; the environment stays.
    await page.getByRole("button", { name: "Undo" }).click();
    for (const h of hosts) {
      expect(await valueOf(page, h, "Owner")).toBe("");
      expect(await valueOf(page, h, "Environment")).toBe("Production");
    }
    // Mixed, then cleared by applying empty.
    await valueOf(page, "web-test-01", "Environment");
    const field = inspector(page).getByRole("combobox", { name: /^Environment / });
    await field.fill("Test");
    await field.press("Tab");
    await select(page, hosts);
    await expect(env).toHaveAttribute("placeholder", "Mixed");
    await expect(env).toHaveValue("");
    await section.getByRole("button", { name: "Set environment on all 3" }).click();
    await expect(status(page)).toContainText("Cleared the environment of 3 elements.");
    for (const h of hosts) expect(await valueOf(page, h, "Environment")).toBe("");
  });

  test("life cycle offers only the stages every class shares; axe passes", async ({ page }) => {
    await open(page);
    await select(page, ["Checkout", "web-prod-01"]);
    const stage = panel(page).getByLabel("Life cycle stage");
    const offered = await stage.locator("option").allTextContents();
    // A Business Application follows the logical life cycle; a Host the tangible or logical one, so
    // the tangible-only stages (Defective, Missing) are not offered.
    expect(offered).toEqual(["Not set", "Purchase", "Design", "Inventory", "Deploy", "Operational", "End of Operation", "End of Life"]);
    await stage.selectOption("Operational");
    await expect(status(page)).toContainText("Set life cycle stage “Operational” on 2 elements.");
    await expect(stage).toHaveValue("Operational");
    expect(await new AxeBuilder({ page }).withTags(tags).include('[data-testid="selection-panel"]').analyze().then((r) => r.violations)).toEqual([]);
    expect(await valueOf(page, "Checkout", "Life cycle stage")).toBe("Operational");
    expect(await valueOf(page, "web-prod-01", "Life cycle stage")).toBe("Operational");
  });
});
