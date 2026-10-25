import { expect, test } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

// M64: a one-page health report, printed or saved as a PDF from the Export menu.
test("the health report prints a page on layers, hints, details and unconnected elements, then tidies up", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "the Export menu's report is on the desktop toolbar");
  await page.addInitScript(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed += 1;
    };
  });
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  const title = await page.title();
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /^Health report…/ }).click();
  const sheet = page.locator("#bm-print .bm-report");
  await expect(sheet).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
  await expect(page).toHaveTitle("online-store-checkout-health-report");
  await expect(page.getByRole("status")).toContainText("Health report: 14 elements and 13 relationships.");
  await page.emulateMedia({ media: "print" });
  // The sheet is hidden from assistive tech on screen (it only prints), so CSS finds its parts.
  await expect(sheet.locator("h1")).toHaveText("Online Store Checkout");
  const layers = sheet.locator("table").filter({ has: page.locator("caption", { hasText: "Elements by CSDM layer" }) });
  await expect(layers.locator("tbody tr")).toHaveCount(5);
  await expect(layers.locator("tbody tr").nth(2)).toHaveText("Service6");
  const details = sheet.locator("table").filter({ has: page.locator("caption", { hasText: "Details filled in" }) });
  await expect(details.locator("tbody tr").filter({ hasText: "Owner" })).toHaveText("Owner0140%");
  await expect(sheet).toContainText("Elements without relationships");
  await expect(page.getByRole("button", { name: "Export" })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("#bm-print")).toHaveCount(0);
  await expect(page).toHaveTitle(title);
});
