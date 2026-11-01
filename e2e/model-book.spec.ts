import { expect, test } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

// M76: the model book, one document for a review, printed or saved as a PDF from the Export menu.
test("the model book prints the picture, the model by layer, tables, saved flows and health, then tidies up", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "the Export menu is on the desktop toolbar");
  await page.addInitScript(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => {
      (window as unknown as { __printed: number }).__printed += 1;
    };
  });
  await page.clock.install();
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  const title = await page.title();
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /^Model book…/ }).click();
  const book = page.locator("#bm-print .bm-book");
  await expect(book).toHaveCount(1);
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
  await expect(page).toHaveTitle("online-store-checkout-model-book");
  await expect(page.getByRole("status")).toContainText("Model book: 14 elements, 13 relationships and 0 saved flows");
  await page.emulateMedia({ media: "print" });
  await expect(book.locator("h1")).toHaveText("Online Store Checkout");
  await expect(book.locator("h2")).toHaveText(["Picture", "The model by layer", "Elements", "Relationships", "Saved flows", "Health", "Elements without relationships"]);
  await expect(book.locator(".bm-book-picture svg")).toHaveCount(1);
  const elements = book.locator("table").filter({ has: page.locator("caption", { hasText: "Every element" }) });
  await expect(elements.locator("tbody tr")).toHaveCount(14);
  const rels = book.locator("table").filter({ has: page.locator("caption", { hasText: "Every relationship" }) });
  await expect(rels.locator("tbody tr")).toHaveCount(13);
  await expect(book).toContainText("No saved flows.");
  await expect(book.locator("table").filter({ has: page.locator("caption", { hasText: "Elements by CSDM layer" }) })).toHaveCount(1);
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("#bm-print")).toHaveCount(0);
  await expect(page).toHaveTitle(title);
});
