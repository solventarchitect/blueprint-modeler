import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel, modelButton } from "./model-menu";

// M66: snapshots of a model, kept in this browser; compared with or restored into the model.
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const dialog = (page: Page) => page.getByTestId("snapshots-dialog");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });

async function start(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await saved(page);
}

async function openSnapshots(page: Page) {
  await modelButton(page).click();
  await page.getByRole("button", { name: "Snapshots…" }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole("heading", { name: "Snapshots of “Online Store Checkout”" })).toBeVisible();
}

async function take(page: Page, name: string) {
  await dialog(page).getByLabel("Name (optional)").fill(name);
  await dialog(page).getByRole("button", { name: "Take snapshot" }).click();
  await expect(dialog(page).getByRole("status")).toHaveText(`Took snapshot “${name}”.`);
}

async function rename(page: Page, from: string, to: string) {
  await node(page, from).click();
  const field = inspector(page).getByLabel("Name", { exact: true });
  await field.fill(to);
  await field.press("Tab");
  await expect(node(page, to)).toBeVisible();
}

const close = (page: Page) => dialog(page).getByRole("button", { name: "Close" }).click();

test.describe("snapshots (M66, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the Model menu's snapshots are on the desktop toolbar");

  test("take a snapshot, change the model, compare with it, restore it in one undo step; kept after a reload", async ({ page }) => {
    await start(page);
    await openSnapshots(page);
    await expect(dialog(page)).toContainText("No snapshots of this model yet.");
    await take(page, "Before the review");
    await expect(dialog(page).getByTestId("snapshot")).toHaveCount(1);
    await expect(dialog(page).getByTestId("snapshot")).toContainText("14 elements · 13 relationships");
    // Focus stays in the name field for the next one.
    await expect(dialog(page).getByLabel("Name (optional)")).toBeFocused();
    await close(page);
    await expect(dialog(page)).toHaveCount(0);

    await rename(page, "Checkout web app", "Storefront");
    await saved(page);

    // Compare: what changed since the snapshot.
    await openSnapshots(page);
    await dialog(page).getByRole("button", { name: "Compare with snapshot Before the review" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByText("Comparing with “Before the review (snapshot)”: 1 element changed.")).toBeVisible();
    await page.keyboard.press("Escape");

    // Restore: back as it was, and one undo brings the change back.
    await openSnapshots(page);
    await dialog(page).getByRole("button", { name: "Restore snapshot Before the review" }).click();
    await expect(page.getByText("Restored snapshot “Before the review”. Undo puts the model back as it was.")).toBeVisible();
    await expect(node(page, "Checkout web app")).toBeVisible();
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(node(page, "Storefront")).toBeVisible();

    await saved(page);
    await page.reload();
    await saved(page);
    await openSnapshots(page);
    await expect(dialog(page).getByTestId("snapshot")).toHaveCount(1);
    await expect(dialog(page).getByTestId("snapshot")).toContainText("Before the review");
  });

  test("deleting asks first and keeps focus in the list; a model's snapshots go with it; axe passes", async ({ page }) => {
    await start(page);
    await openSnapshots(page);
    await take(page, "First");
    await take(page, "Second");
    await expect(dialog(page).getByTestId("snapshot")).toHaveCount(2);
    // Newest first.
    await expect(dialog(page).getByTestId("snapshot").first()).toContainText("Second");
    expect(await new AxeBuilder({ page }).withTags(tags).include('[data-testid="snapshots-dialog"]').analyze().then((r) => r.violations)).toEqual([]);

    await dialog(page).getByRole("button", { name: "Delete snapshot Second" }).click();
    await expect(dialog(page).getByText("Delete this snapshot? This can't be undone.")).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Delete", exact: true })).toBeFocused();
    await dialog(page).getByRole("button", { name: "Keep it" }).click();
    await expect(dialog(page).getByTestId("snapshot")).toHaveCount(2);
    await dialog(page).getByRole("button", { name: "Delete snapshot Second" }).click();
    await dialog(page).getByRole("button", { name: "Delete", exact: true }).click();
    await expect(dialog(page).getByRole("status")).toHaveText("Deleted snapshot “Second”.");
    await expect(dialog(page).getByTestId("snapshot")).toHaveCount(1);
    await expect(dialog(page).getByRole("button", { name: "Compare with snapshot First" })).toBeFocused();
    await close(page);

    // Deleting the model deletes its snapshots, in the browser's own store.
    const snapshotsFor = (id: string) =>
      page.evaluate(
        (modelId) =>
          new Promise<number>((resolve, reject) => {
            const req = indexedDB.open("blueprint-modeler");
            req.onsuccess = () => {
              const db = req.result;
              const get = db.transaction("snapshots").objectStore("snapshots").index("modelId").count(modelId);
              get.onsuccess = () => {
                db.close();
                resolve(get.result);
              };
              get.onerror = () => reject(get.error);
            };
            req.onerror = () => reject(req.error);
          }),
        id,
      );
    const id = (await modelButton(page).getAttribute("data-current"))!;
    expect(await snapshotsFor(id)).toBe(1);
    await page.getByRole("button", { name: "Manage…" }).click();
    const manage = page.getByRole("dialog", { name: "Models in this browser" });
    await manage.getByRole("button", { name: "Delete Online Store Checkout" }).click();
    await manage.getByRole("button", { name: "Delete for good" }).click();
    await expect(manage.getByRole("status")).toHaveText("Deleted Online Store Checkout.");
    expect(await snapshotsFor(id)).toBe(0);
  });
});

test.describe("the browser's store moves to version 2 (M66, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "desktop is enough: the store is the same");

  /** The store as version 1.13 left it: one model row, no snapshots store. */
  async function seedVersion1(page: Page) {
    await page.goto("/about");
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const req = indexedDB.open("blueprint-modeler", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("models", { keyPath: "id" });
          req.onsuccess = () => {
            const db = req.result;
            const now = new Date().toISOString();
            const model = { schema: 1, id: "old-1", name: "Kept from 1.13", created: now, updated: now, nodes: [{ id: "n", class: "business_application", name: "Ledger" }], edges: [], layout: { n: { x: 0, y: 0 } } };
            const t = db.transaction("models", "readwrite");
            t.objectStore("models").put({ id: model.id, name: model.name, updated: now, json: JSON.stringify(model), nodes: 1, edges: 0 });
            t.oncomplete = () => {
              db.close();
              resolve();
            };
            t.onerror = () => reject(t.error);
          };
          req.onerror = () => reject(req.error);
        }),
    );
  }

  test("models saved by the version before snapshots are all still there, and can have snapshots", async ({ page }) => {
    await seedVersion1(page);
    await page.goto("/editor");
    await saved(page);
    await expect(currentModel(page)).toHaveText("Kept from 1.13");
    await expect(node(page, "Ledger")).toBeVisible();
    await modelButton(page).click();
    await page.getByRole("button", { name: "Snapshots…" }).click();
    await dialog(page).getByRole("button", { name: "Take snapshot" }).click();
    await expect(dialog(page).getByTestId("snapshot")).toHaveCount(1);
    await expect(dialog(page).getByTestId("snapshot")).toContainText(/^Snapshot, /);
  });

  test("a tab still on the older version holding the store: said, and the models open once it lets go", async ({ page, context }) => {
    await seedVersion1(page);
    // The older tab: holds version 1 open and, like 1.13, does not let go when asked.
    const older = await context.newPage();
    await older.goto("/about");
    await older.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const req = indexedDB.open("blueprint-modeler", 1);
          req.onsuccess = () => {
            (window as unknown as { __db: IDBDatabase }).__db = req.result;
            resolve();
          };
        }),
    );
    await page.goto("/editor");
    await expect(page.getByRole("alert").filter({ hasText: "open in another tab on an earlier version" })).toBeVisible();
    await older.evaluate(() => (window as unknown as { __db: IDBDatabase }).__db.close());
    await saved(page);
    await expect(currentModel(page)).toHaveText("Kept from 1.13");
    await expect(page.getByRole("alert").filter({ hasText: "open in another tab" })).toHaveCount(0);
  });
});
