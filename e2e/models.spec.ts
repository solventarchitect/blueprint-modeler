import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";

const picker = (page: Page) => page.locator("select").first();

test.describe("managing saved models (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the model manager is in the desktop toolbar");

  test("lists, downloads and deletes models, one or all, asking first", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await openExample(page, "Online store checkout");
    await openExample(page, "HR self-service portal");
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

  test("a change still waiting to autosave cannot bring a deleted model back", async ({ page }) => {
    test.slow(true, "stretched autosave pause and a held-back model list");
    // Make the race deterministic: the autosave pause (300 ms) is stretched so the change is still
    // pending when the model is deleted, and the model list read right after a delete is held back,
    // so that pending save fires after the delete (what a slow machine does by chance).
    await page.addInitScript(() => {
      const set = window.setTimeout;
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) => set(fn, ms === 300 ? 4000 : ms, ...rest)) as typeof window.setTimeout;
      let afterDelete = false;
      const del = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function (this: IDBObjectStore, key: IDBValidKey | IDBKeyRange) {
        afterDelete = true;
        return del.call(this, key);
      };
      const getAll = IDBObjectStore.prototype.getAll;
      IDBObjectStore.prototype.getAll = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["getAll"]>) {
        const req = getAll.apply(this, args);
        if (!afterDelete) return req;
        afterDelete = false;
        let handler: ((e: Event) => void) | null = null;
        Object.defineProperty(req, "onsuccess", { get: () => handler, set: (h) => (handler = h) });
        req.addEventListener("success", (e) => void set(() => handler?.call(req, e), 6000));
        return req;
      };
    });
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await openExample(page, "Online store checkout");
    await expect(picker(page).locator("option:checked")).toHaveText("Online store checkout");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");

    // A change, then delete the model before its autosave has run.
    await page.getByRole("navigation", { name: "Element palette" }).getByRole("button", { name: "Business Capability", exact: true }).click();
    await page.getByRole("button", { name: "Manage…" }).click();
    const dialog = page.getByRole("dialog", { name: "Models in this browser" });
    await dialog.getByRole("button", { name: "Delete Online store checkout" }).click();
    // The race only exists while the change is unsaved; fail loudly rather than pass without it.
    await expect(page.getByTestId("save-status")).toHaveText("Saving…");
    await dialog.getByRole("button", { name: "Delete for good" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Deleted Online store checkout.", { timeout: 15_000 });
    await page.keyboard.press("Escape");

    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser", { timeout: 15_000 });
    await expect(picker(page).locator("option", { hasText: "Online store checkout" })).toHaveCount(0);
  });

  test("switching to another model keeps a change that was still waiting to autosave", async ({ page }) => {
    test.slow(true, "stretched autosave pause");
    // The autosave pause (300 ms) is stretched so the switch happens before the change is saved,
    // as it does by chance when someone edits and switches quickly.
    await page.addInitScript(() => {
      const set = window.setTimeout;
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) => set(fn, ms === 300 ? 4000 : ms, ...rest)) as typeof window.setTimeout;
    });
    const open = page.getByRole("combobox", { name: "Open model" });
    const saved = () => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser", { timeout: 15_000 });
    await page.goto("/editor");
    await saved();
    await openExample(page, "Online store checkout");
    await expect(open.locator("option:checked")).toHaveText("Online store checkout");
    await saved();
    await openExample(page, "HR self-service portal");
    await expect(open.locator("option:checked")).toHaveText("HR self-service portal");
    await saved();
    await open.selectOption({ label: "Online store checkout" });
    await expect(open.locator("option:checked")).toHaveText("Online store checkout");
    await saved();

    // A change, then switch away before its autosave has run.
    await page.getByRole("navigation", { name: "Element palette" }).getByRole("button", { name: "Business Capability", exact: true }).click();
    await expect(page.locator(".react-flow__node").filter({ hasText: "New Business Capability" })).toBeVisible();
    await expect(page.getByTestId("save-status")).toHaveText("Saving…");
    await open.selectOption({ label: "HR self-service portal" });
    await expect(open.locator("option:checked")).toHaveText("HR self-service portal");
    await saved();

    await page.reload();
    await saved();
    await open.selectOption({ label: "Online store checkout" });
    await expect(open.locator("option:checked")).toHaveText("Online store checkout");
    await expect(page.locator(".react-flow__node").filter({ hasText: "New Business Capability" })).toBeVisible();
  });

  test("if a waiting change cannot be saved, the switch stops and says so", async ({ page }) => {
    test.slow(true, "stretched autosave pause");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const set = window.setTimeout;
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...rest: unknown[]) => set(fn, ms === 300 ? 4000 : ms, ...rest)) as typeof window.setTimeout;
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
        if ((window as unknown as { failPut?: boolean }).failPut) throw new DOMException("Quota exceeded", "QuotaExceededError");
        return put.apply(this, args);
      };
    });
    const open = page.getByRole("combobox", { name: "Open model" });
    const saved = () => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser", { timeout: 15_000 });
    await page.goto("/editor");
    await saved();
    await openExample(page, "Online store checkout");
    await expect(open.locator("option:checked")).toHaveText("Online store checkout");
    await saved();

    await page.getByRole("navigation", { name: "Element palette" }).getByRole("button", { name: "Business Capability", exact: true }).click();
    await expect(page.getByTestId("save-status")).toHaveText("Saving…");
    await page.evaluate(() => ((window as unknown as { failPut?: boolean }).failPut = true));
    await open.selectOption({ label: "Untitled model" });

    await expect(page.getByRole("alert").filter({ hasText: "could not be saved" })).toBeVisible();
    await expect(open.locator("option:checked")).toHaveText("Online store checkout");
    await expect(page.locator(".react-flow__node").filter({ hasText: "New Business Capability" })).toBeVisible();
    expect(errors).toEqual([]);
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

    await openExample(page, "Online store checkout");
    await expect(page.locator(".react-flow__node")).not.toHaveCount(0);
    const before = await page.getByRole("combobox", { name: "Open model" }).locator("option").count();
    await openExample(page, "Blank model");
    await expect(page.getByRole("combobox", { name: "Open model" }).locator("option")).toHaveCount(before + 1);
    await expect(page.locator(".react-flow__node")).toHaveCount(0);
    await expect(page.getByRole("combobox", { name: "Open model" })).toHaveValue(/.+/);
    await expect(page.getByRole("button", { name: "Examples", exact: true })).toHaveAttribute("aria-expanded", "false");
  });
});
