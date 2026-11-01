import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M75: view-only links open the model read only, save nothing, and work in a frame.
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function viewLink(page: Page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /Copy view-only link/ }).click();
  await expect(page.getByRole("status")).toContainText("View-only link copied");
  const url = await page.evaluate(() => navigator.clipboard.readText());
  expect(url).toMatch(/\/view#model=1\./);
  return url;
}

const savedModels = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("blueprint-modeler");
        req.onsuccess = () => {
          const db = req.result;
          const names = [...db.objectStoreNames];
          const store = names.find((n) => n.includes("model")) ?? names[0];
          if (!store) return resolve(0);
          const count = db.transaction(store).objectStore(store).count();
          count.onsuccess = () => resolve(count.result);
        };
        req.onerror = () => resolve(-1);
      }),
  );

test.describe("view-only links (M75)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the link is made on the desktop");

  test("open read only, saving nothing; plan and isometric; Save a copy opens it in the editor; axe passes", async ({ page, browser }) => {
    const url = await viewLink(page);
    // A fresh browser: nothing stored before or after viewing.
    const other = await browser.newContext();
    const viewer = await other.newPage();
    await viewer.goto(url.replace(/^https?:\/\/[^/]+/, ""));
    await expect(viewer.getByRole("heading", { level: 1 })).toHaveText("Online Store Checkout");
    await expect(viewer.getByText("View only", { exact: true })).toBeVisible();
    await expect(viewer.getByTestId("view-picture").locator("svg")).toHaveCount(1);
    // The address keeps the model, so a reload shows it again.
    expect(viewer.url()).toContain("#model=1.");
    await viewer.reload();
    await expect(viewer.getByRole("heading", { level: 1 })).toHaveText("Online Store Checkout");
    await viewer.getByRole("button", { name: "Isometric" }).click();
    await expect(viewer.getByTestId("view-picture").locator("svg[data-iso]")).toHaveCount(1);
    await viewer.getByText("The model in words").click();
    await expect(viewer.getByRole("listitem").filter({ hasText: "web-prod-01" })).toHaveCount(1);
    expect(await new AxeBuilder({ page: viewer }).withTags(tags).analyze().then((r) => r.violations)).toEqual([]);
    expect(await savedModels(viewer)).toBeLessThanOrEqual(0);

    await viewer.getByRole("link", { name: "Save a copy" }).click();
    await expect(currentModel(viewer)).toHaveText("Online Store Checkout");
    await expect(viewer.getByTestId("save-status")).toHaveText("Saved in this browser");
    await other.close();
  });

  test("in a frame: the model alone, and Save a copy opens a new tab", async ({ page }) => {
    const url = await viewLink(page);
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    await page.setContent(`<!doctype html><title>Wiki</title><iframe title="Model" src="${new URL(page.url()).origin}${path}" width="900" height="600"></iframe>`);
    const frame = page.frameLocator('iframe[title="Model"]');
    await expect(frame.getByRole("heading", { level: 1 })).toHaveText("Online Store Checkout");
    await expect(frame.locator("body > header")).toBeHidden();
    await expect(frame.getByRole("link", { name: /Save a copy/ })).toHaveAttribute("target", "_blank");
  });

  test("a link with no model, or a damaged one, says so", async ({ page }) => {
    await page.goto("/view");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("No model in this link");
    await page.goto("/view#model=1.!!!");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This link can't be opened");
    await expect(page.getByRole("main").getByRole("alert")).toContainText("damaged");
  });
});
