import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M90: a relationship turned round from its menu, where CSDM has one that way.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const menu = (page: Page) => page.getByRole("menu", { name: "Relationship menu" });
const edge = (page: Page, id: string) => page.getByTestId(`rf__edge-${id}`);
const reverse = (page: Page) => menu(page).getByRole("menuitem", { name: /^Reverse direction/ });
const openMenu = (page: Page, id: string) => edge(page, id).locator("path").first().click({ button: "right", force: true });

const model = {
  schema: 1,
  id: "e2e-reverse",
  name: "Shop",
  created: "2026-11-13T00:00:00.000Z",
  updated: "2026-11-13T00:00:00.000Z",
  nodes: [
    { id: "a", class: "application_service", name: "Checkout" },
    { id: "b", class: "application_service", name: "Payments" },
    { id: "conn", class: "connection_service_instance", name: "Store link" },
    { id: "net", class: "network_service_instance", name: "WAN" },
    { id: "app", class: "application", name: "checkout.war" },
    { id: "host", class: "host", name: "web-01" },
  ],
  edges: [
    { id: "e1", from: "a", to: "b", type: "Depends on::Used by", ports: { from: "right", to: "left" } },
    { id: "e2", from: "conn", to: "net", type: "Provided by::Provides" },
    { id: "e3", from: "app", to: "host", type: "Runs on::Runs" },
    { id: "e4", from: "b", to: "net", type: "Depends on::Used by" },
  ],
  flows: [{ id: "f1", name: "Pay", steps: [{ edge: "e1" }, { edge: "e4" }] }],
  layout: { a: { x: 0, y: 480 }, b: { x: 400, y: 480 }, conn: { x: 800, y: 480 }, net: { x: 800, y: 720 }, app: { x: 0, y: 720 }, host: { x: 0, y: 960 } },
};

async function open(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await page.getByTestId("import-file").setInputFiles({ name: "shop.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(model)) });
  await expect(currentModel(page)).toHaveText("Shop");
  await expect(page.locator(".react-flow__edge")).toHaveCount(4);
}

async function exported(page: Page) {
  await saved(page);
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Model file \(JSON\)/ }).click()]);
  return JSON.parse(await readFile((await download.path())!, "utf8"));
}

test.describe("reverse a relationship (M90, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("turns it round and says so; its sides, and the flow that walks it, follow; one undo step", async ({ page }) => {
    await open(page);
    await expect(edge(page, "e1")).toHaveAttribute("aria-label", "Depends on::Used by from Checkout to Payments");
    await openMenu(page, "e1");
    await expect(reverse(page)).toHaveAccessibleName("Reverse direction, From Payments to Checkout");
    expect(await new AxeBuilder({ page }).withTags(axeTags).include("[data-testid=context-menu]").analyze().then((r) => r.violations)).toEqual([]);
    await reverse(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Reversed the relationship: it now runs from “Payments” to “Checkout”. Undo turns it back." })).toHaveCount(1);
    await expect(edge(page, "e1")).toHaveAttribute("aria-label", "Depends on::Used by from Payments to Checkout");

    const file = await exported(page);
    // The line stays where it was drawn: each chosen side goes with its element.
    expect(file.edges.find((e: { id: string }) => e.id === "e1")).toEqual({ id: "e1", from: "b", to: "a", type: "Depends on::Used by", ports: { from: "left", to: "right" } });
    // The flow still walks Checkout to Payments to WAN: its step along e1 now goes against the arrow.
    expect(file.flows[0].steps).toEqual([{ edge: "e1", back: true }, { edge: "e4" }]);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(edge(page, "e1")).toHaveAttribute("aria-label", "Depends on::Used by from Checkout to Payments");
  });

  test("takes the type CSDM has in the new direction; where CSDM has none that way, the item says why and does nothing", async ({ page }) => {
    await open(page);
    await openMenu(page, "e2");
    await expect(reverse(page)).toHaveAccessibleName("Reverse direction, From WAN to Store link, as Connected by");
    await reverse(page).click();
    await expect(page.getByRole("status").filter({ hasText: "Reversed the relationship: it now runs from “WAN” to “Store link”, as Connected by. Undo turns it back." })).toHaveCount(1);
    await expect(edge(page, "e2")).toHaveAttribute("aria-label", "Connected by::Connects from WAN to Store link");

    await openMenu(page, "e3");
    await expect(reverse(page)).toHaveAccessibleName("Reverse direction, CSDM has no relationship from Host to Application");
    await expect(reverse(page)).toHaveAttribute("aria-disabled", "true");
    await reverse(page).click({ force: true });
    await expect(edge(page, "e3")).toHaveAttribute("aria-label", "Runs on::Runs from checkout.war to web-01");
  });

  test("by keyboard: Shift+F10 on the relationship, and focus comes back to it", async ({ page }) => {
    await open(page);
    await edge(page, "e4").focus();
    await page.keyboard.press("Shift+F10");
    await expect(menu(page)).toBeVisible();
    await reverse(page).focus();
    await page.keyboard.press("Enter");
    await expect(menu(page)).toHaveCount(0);
    await expect(edge(page, "e4")).toHaveAttribute("aria-label", "Depends on::Used by from WAN to Payments");
    await expect(edge(page, "e4")).toBeFocused();
  });
});
