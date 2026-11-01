import { deflateRawSync } from "node:zlib";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";
import { watchForeignRequests } from "./network";

declare global {
  interface Window {
    __bmNoBeacon?: boolean;
  }
}

/** A small model, linked with Node's zlib: an encoder independent of the app's (as in share-link.spec.ts). */
const small = {
  schema: 1,
  id: "e2e-view-1",
  name: "Payroll Platform Overview With A Long Name For Small Screens",
  created: "2026-11-01T00:00:00.000Z",
  updated: "2026-11-01T00:00:00.000Z",
  nodes: [
    { id: "ba", class: "business_application", name: "Payroll" },
    { id: "svc", class: "application_service", name: "Payroll — production" },
  ],
  edges: [{ id: "e1", from: "ba", to: "svc", type: "Uses::Used by" }],
  layout: { ba: { x: 0, y: 160 }, svc: { x: 0, y: 320 } },
};
const viewPath = (m: object) => `/view#model=1.${deflateRawSync(Buffer.from(JSON.stringify(m))).toString("base64url")}`;

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

/** The databases this origin has in the browser: none, if the page never opened the store. */
const databases = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));

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
    expect(await databases(viewer)).toEqual([]);

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
    await expect(frame.locator("body > footer")).toBeHidden();
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

test.describe("the view page on any screen (M75)", () => {
  test("no store, no visit counter, nothing from other sites; fits a 320px screen, the picture scrolls in its own region", async ({ page, baseURL }) => {
    const foreign = watchForeignRequests(page, baseURL);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(viewPath(small));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(small.name);
    expect(await page.evaluate(() => window.__bmNoBeacon)).toBe(true);
    expect(await databases(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    await expect(page.getByRole("region", { name: "Picture" })).toBeVisible();
    expect(await new AxeBuilder({ page }).withTags(tags).analyze().then((r) => r.violations)).toEqual([]);
    // Another link in the same tab: the page follows it.
    await page.evaluate((h) => (location.hash = h), viewPath({ ...small, id: "e2e-view-2", name: "Second" }).split("#")[1]!);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Second");
    expect(foreign).toEqual([]);
  });
});

test.describe("who may frame the site (M75)", () => {
  test("only /view may be framed by another site; every other page only by the site itself", async ({ request }) => {
    for (const path of ["/", "/editor", "/guide", "/privacy"]) expect((await request.get(path)).headers()["content-security-policy"], path).toBe("frame-ancestors 'self'");
    expect((await request.get("/view")).headers()["content-security-policy"]).toBeUndefined();
  });
});

