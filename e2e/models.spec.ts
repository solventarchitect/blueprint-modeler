import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const picker = (page: Page) => page.locator("select").first();

test.describe("managing saved models (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the model manager is in the desktop toolbar");

  test("lists, downloads and deletes models, one or all, asking first", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    const examples = page.getByRole("combobox", { name: "Start from an example" });
    await examples.selectOption({ label: "Online store checkout" });
    await examples.selectOption({ label: "HR self-service portal" });
    await expect(picker(page)).toHaveValue(/.+/);
    await expect(picker(page).locator("option")).toHaveCount(3);

    const manage = page.getByRole("button", { name: "Manage…" });
    await manage.click();
    const dialog = page.getByRole("dialog", { name: "Models in this browser" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId("model-list").locator("li")).toHaveCount(3);
    await expect(dialog.getByRole("button", { name: "Open HR self-service portal" })).toBeDisabled();
    expect((await new AxeBuilder({ page }).include("dialog").withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze()).violations).toEqual([]);

    const [download] = await Promise.all([page.waitForEvent("download"), dialog.getByRole("button", { name: "Download Online store checkout" }).click()]);
    expect(download.suggestedFilename()).toBe("online-store-checkout.json");

    // Deleting asks once; Cancel keeps the model.
    await dialog.getByRole("button", { name: "Delete Online store checkout" }).click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog.getByTestId("model-list").locator("li")).toHaveCount(3);
    await dialog.getByRole("button", { name: "Delete Online store checkout" }).click();
    await dialog.getByRole("button", { name: "Delete for good" }).click();
    await expect(dialog.getByTestId("model-list").locator("li")).toHaveCount(2);
    await expect(dialog.getByRole("status")).toHaveText("Deleted Online store checkout.");

    // Deleting the open model opens the next one.
    await dialog.getByRole("button", { name: "Delete HR self-service portal" }).click();
    await dialog.getByRole("button", { name: "Delete for good" }).click();
    await expect(dialog.getByTestId("model-list").locator("li")).toHaveCount(1);
    await expect(page.getByTestId("canvas-title")).toHaveCount(0);

    // Delete all leaves one new, empty model; the deletions survive a reload.
    await dialog.getByRole("button", { name: "Delete all models…" }).click();
    await dialog.getByRole("button", { name: /Delete all 1 for good/ }).click();
    await expect(dialog.getByRole("status")).toContainText("Deleted every model");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(manage).toBeFocused();
    await page.reload();
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await expect(picker(page).locator("option")).toHaveCount(1);
    await expect(picker(page).locator("option")).toHaveText("Untitled model");
  });
});

test.describe("starting blank (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the empty state starts a blank model and hands focus to the palette; Examples offers a blank model too", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.getByRole("button", { name: /^Blank model/ }).click();
    await expect(page.getByRole("heading", { name: "Start blank, or open an example" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Element palette" }).getByRole("button").first()).toBeFocused();
    await expect(page.getByRole("status")).toContainText("Blank model ready");

    await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Online store checkout" });
    await expect(page.locator(".react-flow__node")).not.toHaveCount(0);
    const before = await page.getByRole("combobox", { name: "Open model" }).locator("option").count();
    await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Blank model" });
    await expect(page.getByRole("combobox", { name: "Open model" }).locator("option")).toHaveCount(before + 1);
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Open model" })).toHaveValue(/.+/);
    await expect(page.getByRole("combobox", { name: "Start from an example" })).toHaveValue("");
  });
});
