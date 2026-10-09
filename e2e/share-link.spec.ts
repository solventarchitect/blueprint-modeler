import { deflateRawSync, inflateRawSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel, modelButton, storedModelNames } from "./model-menu";
import { watchForeignRequests } from "./network";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const cleanEditorUrl = /\/editor\/?$/;
/** The editor's problem banner (Next.js also renders an empty role="alert" route announcer on every page). */
const banner = (page: Page) => page.getByRole("alert").filter({ hasText: /\S/ });
const copyItem = (page: Page) => page.getByRole("button", { name: /^Copy link to this model/ });

/** A small model, made here rather than by the app, so the tests pin the link format itself. */
const shared = {
  schema: 1,
  id: "e2e-shared-1",
  name: "Shared From A Colleague",
  created: "2026-10-09T00:00:00.000Z",
  updated: "2026-10-09T00:00:00.000Z",
  nodes: [
    { id: "ba", class: "business_application", name: "Payroll" },
    { id: "svc", class: "application_service", name: "Payroll — production" },
  ],
  edges: [{ id: "e1", from: "ba", to: "svc", type: "Uses::Used by" }],
  layout: { ba: { x: 0, y: 160 }, svc: { x: 0, y: 320 } },
};

/** `#model=1.<base64url(raw deflate(JSON))>`, made with Node's zlib: an encoder independent of the app's. */
const payloadFor = (m: object, version = "1") => `${version}.${deflateRawSync(Buffer.from(JSON.stringify(m))).toString("base64url")}`;
const linkFor = (m: object, version = "1") => `/editor#model=${payloadFor(m, version)}`;
/** The model inside a copied link. */
const modelIn = (url: string) => JSON.parse(inflateRawSync(Buffer.from(url.split("#model=1.")[1] ?? "", "base64url")).toString());

/** After the editor has loaded: wait out the time a link would take to add a model, then check nothing was added. */
async function nothingAdded(page: Page, count: string) {
  await saved(page);
  await page.waitForTimeout(800);
  await expect(modelButton(page)).toHaveAttribute("data-count", count);
}

async function copyLink(page: Page) {
  await page.getByRole("button", { name: "Export" }).click();
  await copyItem(page).click();
}

test.describe("share a model as a link (M45)", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  test("Export › Copy link puts the whole model in the link; a fresh browser opens only that model", async ({ page, browser, baseURL }) => {
    await page.goto("/editor?example=checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await saved(page);
    await copyLink(page);
    await expect(page.getByRole("status")).toContainText("Link copied");
    await expect(page.getByRole("status")).toContainText("Anyone with the link can open a copy of this model");
    const url = await page.evaluate(() => navigator.clipboard.readText());
    expect(url).toMatch(new RegExp(`^${baseURL}/editor#model=1\\.[A-Za-z0-9_-]+$`));
    const inLink = modelIn(url);
    expect(inLink.name).toBe("Online Store Checkout");
    expect(inLink.nodes).toHaveLength(14);

    // Someone else, with nothing stored yet.
    const other = await browser.newContext({ viewport: page.viewportSize() });
    const visitor = await other.newPage();
    const foreign = watchForeignRequests(visitor, baseURL);
    await visitor.goto(url);
    await expect(currentModel(visitor)).toHaveText("Online Store Checkout");
    await expect(visitor.getByRole("status")).toContainText("Opened the shared model “Online Store Checkout” as a new model.");
    await expect(visitor).toHaveURL(cleanEditorUrl);
    await saved(visitor);
    await expect(modelButton(visitor)).toHaveAttribute("data-count", "1");
    expect(await storedModelNames(visitor)).toEqual(["Online Store Checkout"]);
    await expect(visitor.locator(".react-flow__node")).toHaveCount(14);
    // The URL no longer holds the model, so a reload opens what is stored and adds nothing.
    await visitor.reload();
    await expect(currentModel(visitor)).toHaveText("Online Store Checkout");
    await nothingAdded(visitor, "1");
    expect(foreign).toEqual([]);
    await other.close();
  });

  test("the model leaves the address before the page has finished loading", async ({ page }) => {
    // Recorded as soon as the document is parsed: before the page's own scripts finish, and long
    // before anything loaded after the page (such as the production site's visit counter) could read it.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { hashAtParse: string }).hashAtParse = location.hash;
      });
    });
    await page.goto(linkFor(shared));
    await expect(currentModel(page)).toHaveText("Shared From A Colleague");
    expect(await page.evaluate(() => (window as unknown as { hashAtParse: string }).hashAtParse)).toBe("");
  });

  test("a returning visitor gets the shared model beside their own; the same link again arrives as a copy", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    await expect(currentModel(page)).toHaveText("Untitled Model");

    await page.goto("about:blank");
    await page.goto(linkFor(shared));
    await expect(currentModel(page)).toHaveText("Shared From A Colleague");
    await saved(page);
    await expect(modelButton(page)).toHaveAttribute("data-count", "2");
    await expect(modelButton(page)).toHaveAttribute("data-current", "e2e-shared-1");

    await page.goto("about:blank");
    await page.goto(linkFor(shared));
    await expect(page.getByRole("status")).toContainText("as a copy");
    await saved(page);
    await expect(modelButton(page)).toHaveAttribute("data-count", "3");
    await expect(modelButton(page)).not.toHaveAttribute("data-current", "e2e-shared-1");
    expect((await storedModelNames(page)).sort()).toEqual(["Shared From A Colleague", "Shared From A Colleague", "Untitled Model"]);
  });

  test("a link pasted into an editor that is already open opens the model too", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    await page.evaluate((h) => {
      location.hash = h;
    }, `model=${payloadFor(shared)}`);
    await expect(currentModel(page)).toHaveText("Shared From A Colleague");
    await expect(page.getByRole("status")).toContainText("Opened the shared model");
    await expect(page).toHaveURL(cleanEditorUrl);
    await saved(page);
    await expect(modelButton(page)).toHaveAttribute("data-count", "2");
  });

  test("a damaged link says so once, opens nothing, and the first load runs as usual", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/editor#model=1.not$base64");
    await expect(banner(page)).toContainText("This link does not contain a model Blueprint Modeler can open.");
    await expect(banner(page)).toContainText("incomplete or damaged");
    await expect(banner(page)).toHaveCount(1);
    await expect(page).toHaveURL(cleanEditorUrl);
    await expect(currentModel(page)).toHaveText("Untitled Model");
    await nothingAdded(page, "1");
    await banner(page).getByRole("button", { name: "Dismiss" }).click();
    await expect(banner(page)).toHaveCount(0);

    // A link from a later version names the version; a model that fails validation says why, as text.
    await page.goto("about:blank");
    await page.goto(linkFor(shared, "2"));
    await expect(banner(page)).toContainText("version 2");
    await page.goto("about:blank");
    await page.goto(linkFor({ ...shared, nodes: [{ id: "n", class: "<b>flux</b>", name: "x" }], edges: [], layout: {} }));
    await expect(banner(page)).toContainText("<b>flux</b>");
    await expect(banner(page).locator("b")).toHaveCount(0);
    await nothingAdded(page, "1");
    expect(errors).toEqual([]);
  });

  test("a link with both an example and a shared model opens the shared model, and cleans both", async ({ page }) => {
    await page.goto(`/editor?example=hr-portal#model=${payloadFor(shared)}`);
    await expect(currentModel(page)).toHaveText("Shared From A Colleague");
    await expect(page).toHaveURL(cleanEditorUrl);
    await nothingAdded(page, "1");
    expect(await storedModelNames(page)).toEqual(["Shared From A Colleague"]);
  });

  test("if the shared model cannot be saved, the first load runs as usual and says why", async ({ page }) => {
    await page.addInitScript(() => {
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore["put"]>) {
        if (JSON.stringify(args[0]).includes("Shared From A Colleague")) throw new DOMException("Quota exceeded", "QuotaExceededError");
        return put.apply(this, args);
      };
    });
    await page.goto(linkFor(shared));
    await expect(banner(page)).toContainText("could not save the shared model");
    await expect(currentModel(page)).toHaveText("Untitled Model");
    await nothingAdded(page, "1");
    await expect(page.getByRole("status")).not.toContainText("Opened the shared model");
  });

  test("where the clipboard is blocked, the link is shown, selected, to copy by hand", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) }, configurable: true });
    });
    await page.goto(linkFor(shared));
    await expect(currentModel(page)).toHaveText("Shared From A Colleague");
    await copyLink(page);
    const field = page.getByRole("textbox", { name: "Link to this model" });
    await expect(field).toBeFocused();
    const value = await field.inputValue();
    expect(modelIn(value).name).toBe("Shared From A Colleague");
    expect(await field.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd])).toEqual([0, value.length]);
    await expect(page.getByRole("status")).toContainText("Copy the link below");
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    }
    await page.getByRole("button", { name: "Close link" }).click();
    await expect(field).toBeHidden();
  });
});

test.describe("share link size (M45)", () => {
  test.skip(({ isMobile }) => !!isMobile, "Import is desktop-only");
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });

  /** A model whose names barely compress, so its link is long: `count` elements with `chars` random characters each. */
  function bulky(count: number, chars: number) {
    const rand = (n: number) => Buffer.from(Array.from({ length: n }, () => Math.floor(Math.random() * 256))).toString("base64").slice(0, n);
    const nodes = Array.from({ length: count }, (_, i) => ({ id: `n${i}`, class: "business_application", name: rand(chars) }));
    const layout = Object.fromEntries(nodes.map((n, i) => [n.id, { x: (i % 20) * 240, y: 160 + Math.floor(i / 20) * 80 }]));
    return { ...shared, id: `bulky-${count}`, name: `Bulky ${count}`, nodes, edges: [], layout };
  }

  async function importModel(page: Page, m: object) {
    await page.getByTestId("import-file").setInputFiles({ name: "bulky.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(m)) });
    await expect(page.getByRole("status")).toContainText("Imported");
  }

  test("a long link still copies, with a warning; past the cap the item is off and says why", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    await importModel(page, bulky(60, 160));
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByTestId("export-note-link")).toContainText("Long link");
    await copyItem(page).click();
    await expect(page.getByRole("status")).toContainText("Link copied");
    await expect(page.getByRole("status")).toContainText("some chat and email apps cut links this long");
    expect((await page.evaluate(() => navigator.clipboard.readText())).length).toBeGreaterThan(8000);

    await importModel(page, bulky(700, 200));
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByTestId("export-note-link")).toContainText("Too large to share as a link");
    await expect(copyItem(page)).toHaveAttribute("aria-disabled", "true");
  });
});
