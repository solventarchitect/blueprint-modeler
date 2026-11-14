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
  await expect(page.getByRole("status")).toContainText("Model book: 14 elements, 13 relationships, no saved flows.");
  await page.emulateMedia({ media: "print" });
  await expect(book.locator("h1")).toHaveText("Online Store Checkout");
  await expect(book.locator("h2")).toHaveText(["Contents", "Picture", "The model by layer", "Elements", "Relationships", "Saved flows", "Decisions", "Notes", "Health"]);
  await expect(book.locator("section").last().locator("h3")).toHaveText(["Elements without relationships"]);
  await expect(book.locator(".bm-book-picture svg")).toHaveCount(1);
  const elements = book.locator("table").filter({ has: page.locator("caption", { hasText: "Every element, by layer" }) });
  await expect(elements.locator("tbody tr")).toHaveCount(14);
  const rels = book.locator("table").filter({ has: page.locator("caption", { hasText: "Every relationship" }) });
  await expect(rels.locator("tbody tr")).toHaveCount(13);
  await expect(book).toContainText("No saved flows.");
  // A reference relationship by name, as the picture names it.
  await expect(rels.locator("tbody tr").filter({ hasText: "reference" }).first()).toBeVisible();
  await expect(rels).not.toContainText("reference:");
  await expect(book.locator("table").filter({ has: page.locator("caption", { hasText: "Elements by CSDM layer" }) })).toHaveCount(1);
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("#bm-print")).toHaveCount(0);
  await expect(page).toHaveTitle(title);
});

test("the book names what the picture shows, lists saved flows, keeps model text as text, and says when there is nothing yet", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "the Export menu is on the desktop toolbar");
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await page.clock.install();
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  // A name that would be markup, a saved flow, and a focus.
  const node = page.locator(".react-flow__node-csdm").filter({ has: page.getByText("web-prod-01", { exact: true }) });
  await node.click();
  const name = page.getByRole("complementary", { name: "Inspector" }).getByLabel("Name", { exact: true });
  await name.fill('<img src=x onerror="window.__xss=1">');
  await name.press("Enter");
  await page.getByTestId("model-menu-button").click();
  await page.getByRole("button", { name: "Saved flows…" }).click();
  const dialog = page.getByTestId("flows-dialog");
  await dialog.getByLabel("New flow name").fill("Customer places an order");
  await dialog.getByRole("button", { name: "Make flow" }).click();
  await dialog.getByLabel("Starts at").selectOption({ label: "Online shopping — North America (Business Service Offering)" });
  await dialog.getByLabel(/^Next step/).selectOption({ label: "Online shopping — North America → Checkout — production (Depends on)" });
  await dialog.getByRole("button", { name: "Add step" }).click();
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.locator(".react-flow__node-csdm").filter({ has: page.getByText("Checkout web app", { exact: true }) }).dblclick();
  await expect(page.getByTestId("focus-bar")).toBeVisible();

  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /^Model book…/ }).click();
  await page.emulateMedia({ media: "print" });
  const book = page.locator("#bm-print .bm-book");
  await expect(book.locator(".bm-book-picture-page > p")).toHaveText(/As the editor shows it: focused on Checkout web app, within 1 relationship\. The lists and tables below cover the whole model\./);
  await expect(book.locator("ol:not(.bm-book-contents) li")).toHaveText(["Online shopping — North America → Checkout — production (Depends on)"]);
  await expect(book).toContainText("Starts at Online shopping — North America.");
  await expect(book).toContainText('<img src=x onerror="window.__xss=1">');
  await expect(page.locator("#bm-print img")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await page.emulateMedia({ media: "screen" });

  // An empty model: each section says so.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "New model", exact: true }).click();
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /^Model book…/ }).click();
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#bm-print .bm-book").getByText("No elements yet.")).toHaveCount(3);
});


// M81: a book of only what the view, focus or state shown keeps, with its contents listed.
test("the book of what's shown covers only the focus, and says so; off while the whole model shows", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "the Export menu is on the desktop toolbar");
  await page.addInitScript(() => {
    window.print = () => {};
  });
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");

  // The whole model shows: the item says why it is off.
  await page.getByRole("button", { name: "Export" }).click();
  await expect(page.getByRole("button", { name: /^Model book of what's shown…/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^Model book of what.s shown…/ })).toContainText("What's shown is the whole model");
  await page.keyboard.press("Escape");

  // Focus on one element, within one relationship.
  const node = page.locator(".react-flow__node-csdm").filter({ has: page.getByText("web-prod-01", { exact: true }) });
  await node.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Focus on this element" }).click();
  const kept = Number((await page.getByTestId("focus-count").textContent())!.split(" ")[0]);
  expect(kept).toBeLessThan(14);

  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("button", { name: /^Model book of what's shown…/ }).click();
  const book = page.locator("#bm-print .bm-book");
  await expect(book).toHaveCount(1);
  await expect(book).toContainText(`What's shown: focused on web-prod-01, within 1 relationship. The lists and tables below cover only that: ${kept} of 14 elements`);
  await expect(book.locator("ol.bm-book-contents li")).toHaveText(["Picture", /The model by layer \(\d layers?\)/, `Elements (${kept})`, /Relationships \(\d+\)/, "Saved flows (none)", "Decisions (none)", "Notes (none)", "Health"]);
  // Said on the cover, before the contents; the health summary is the whole model's.
  await expect(book.locator("p.bm-book-part")).toContainText("What's shown: focused on web-prod-01");
  await expect(book.locator("section").last()).toContainText("For the whole model");
  const elements = book.locator("table").filter({ has: page.locator("caption", { hasText: "Every element, by layer" }) });
  await expect(elements.locator("tbody tr")).toHaveCount(kept);
  await expect(page.getByRole("status").filter({ hasText: "Model book of what's shown" })).toContainText(`${kept} elements`);
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
});
