import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

// M62: state that follows a prop or the browser, without setting state in an effect.
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ has: page.getByText(name, { exact: true }) });

test.describe("Inspector fields follow the selection (M62, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the name field shows the value after an undo, and the relationship target starts empty for each element", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    await openExample(page, "Online Store Checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await node(page, "Checkout web app").click();
    const name = inspector(page).getByLabel("Name", { exact: true });
    await expect(name).toHaveValue("Checkout web app");
    await name.fill("Storefront");
    await name.press("Tab");
    await expect(node(page, "Storefront")).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(name).toHaveValue("Checkout web app");

    const target = inspector(page).getByLabel("Add a relationship");
    const first = await target.locator("option").nth(1).getAttribute("value");
    await target.selectOption(first!);
    await expect(inspector(page).getByRole("button", { name: "Add", exact: true })).toBeEnabled();
    await node(page, "Orders database").click();
    await expect(name).toHaveValue("Orders database");
    await expect(target).toHaveValue("");
    await expect(inspector(page).getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  });
});

test("with storage blocked, the theme toggle still cycles and says which theme is on", async ({ page }) => {
  await page.addInitScript(() => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    Object.defineProperty(window, "localStorage", { get: blocked, configurable: true });
  });
  await page.goto("/");
  const toggle = page.getByTestId("theme-toggle");
  await expect(toggle).toHaveAccessibleName(/Color theme: Auto/);
  await toggle.click();
  await expect(toggle).toHaveAccessibleName(/Color theme: Light/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await toggle.click();
  await expect(toggle).toHaveAccessibleName(/Color theme: Dark/);
  await toggle.click();
  await expect(toggle).toHaveAccessibleName(/Color theme: Auto/);
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});
