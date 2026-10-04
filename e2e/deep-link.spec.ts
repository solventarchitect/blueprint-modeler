import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel, modelButton } from "./model-menu";
import { watchForeignRequests } from "./network";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const cleanEditorUrl = /\/editor\/?$/;
/** The editor's problem banner (Next.js also renders an empty role="alert" route announcer on every page). */
const banner = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ });

/**
 * After the editor has loaded: wait out the time a deep link would take to add a model, then check
 * nothing was added. A negative check needs the pause; "Saved" alone shows before a late copy lands.
 */
async function nothingAdded(page: Page, count: string, current: string | null) {
  await saved(page);
  await page.waitForTimeout(800);
  await expect(modelButton(page)).toHaveAttribute("data-count", count);
  if (current) await expect(modelButton(page)).toHaveAttribute("data-current", current);
  await expect(page.getByRole("status")).not.toContainText("Opened the example");
}

/** `/editor?example=<id>` (M42): the links mikereams.com builds to open a shipped example. Desktop and mobile. */
test.describe("example deep links", () => {
  test("open the example as a new model, announce it and clean the URL; a reload adds no copy", async ({ page, baseURL }) => {
    const foreign = watchForeignRequests(page, baseURL);
    await page.goto("/editor?example=checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await expect(page.getByTestId("canvas-title")).toHaveText("Online Store Checkout");
    await expect(page.getByRole("status")).toContainText("Online Store Checkout");
    await expect(page).toHaveURL(cleanEditorUrl);
    await saved(page);
    // The model that opened first, and the example.
    await expect(modelButton(page)).toHaveAttribute("data-count", "2");

    const example = await modelButton(page).getAttribute("data-current");
    await page.reload();
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await nothingAdded(page, "2", example);
    expect(foreign).toEqual([]);
  });

  test("the same link opened again on purpose makes a second copy, as choosing the example twice does", async ({ page }) => {
    await page.goto("/editor?example=hr-portal");
    await expect(currentModel(page)).toHaveText("HR Self-Service Portal");
    await saved(page);
    await expect(modelButton(page)).toHaveAttribute("data-count", "2");
    await page.goto("/editor?example=hr-portal");
    await expect(page).toHaveURL(cleanEditorUrl);
    await expect(modelButton(page)).toHaveAttribute("data-count", "3");
  });

  test("an unknown id opens the editor as usual and says so, with the id shown as text", async ({ page }) => {
    await page.goto("/editor?example=checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await saved(page);

    const example = await modelButton(page).getAttribute("data-current");
    await page.goto(`/editor?example=${encodeURIComponent("<b>nope</b>")}`);
    await saved(page);
    const alert = banner(page);
    await expect(alert).toContainText("No example named “<b>nope</b>”. Choose one from Examples.");
    await expect(alert.locator("b")).toHaveCount(0);
    await expect(page).toHaveURL(cleanEditorUrl);
    // The most recent model, and nothing new.
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await nothingAdded(page, "2", example);
    await alert.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner(page)).toHaveCount(0);
  });

  test("an empty ?example= behaves like /editor", async ({ page }) => {
    await page.goto("/editor?example=");
    await expect(currentModel(page)).toHaveText("Untitled Model");
    await nothingAdded(page, "1", null);
    await expect(banner(page)).toHaveCount(0);
    // The empty parameter is tidied away too.
    await expect(page).toHaveURL(cleanEditorUrl);
  });

  test("the landing page ignores the parameter and creates nothing", async ({ page }) => {
    await page.goto("/?example=checkout");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/editor");
    await expect(currentModel(page)).toHaveText("Untitled Model");
    await nothingAdded(page, "1", null);
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`a deep-linked example has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/editor?example=hr-portal");
      await expect(currentModel(page)).toHaveText("HR Self-Service Portal");
      await saved(page);
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});
