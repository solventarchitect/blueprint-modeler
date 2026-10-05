import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { classes, relationships } from "../src/metamodel";
import { openExample } from "./examples";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const filterBox = (page: Page) => page.getByRole("searchbox", { name: "Filter the guide" });
const visibleCards = (page: Page) => page.locator("[data-guide-section=classes] [data-guide-item]:visible");
const visibleRelationships = (page: Page) => page.locator("[data-guide-section=relationships] [data-guide-item]:visible");
/** What an entry is found by (its own words, not the class names folded into its "Connects to" list). */
const texts = (items: ReturnType<Page["locator"]>) => items.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.text ?? ""));
const ends = (items: ReturnType<Page["locator"]>) => items.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.ends ?? ""));
const rail = (page: Page) => page.getByRole("navigation", { name: "On this page" });
/** A layer or kind chip. On narrow screens the chips sit behind the Filters button. */
async function chip(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) await page.getByRole("button", { name: /^Filters/ }).click();
  return button;
}

test.describe("guide filter", () => {
  test("narrows every section to what matches, with counts, and Clear brings everything back", async ({ page }) => {
    await page.goto("/guide");
    const allCards = await visibleCards(page).count();
    const allRels = await visibleRelationships(page).count();
    expect(allCards).toBe(classes.length);
    expect(allRels).toBe(relationships.length);

    await filterBox(page).fill("kubernetes");
    await expect(visibleCards(page)).not.toHaveCount(allCards);
    for (const text of await texts(visibleCards(page))) expect(text).toContain("kubernetes");
    await expect(visibleRelationships(page).first()).toBeVisible();
    for (const text of await texts(visibleRelationships(page))) expect(text).toContain("kubernetes");
    // The rail counts what is shown, and the status line says so.
    const shown = await visibleCards(page).count();
    await expect(rail(page).getByRole("link", { name: /^Classes/ })).toContainText(`${shown} of ${classes.length}`);
    await expect(page.getByRole("status").filter({ hasText: /match/ })).toContainText("kubernetes");

    await page.getByRole("button", { name: "Clear filter" }).click();
    await expect(visibleCards(page)).toHaveCount(allCards);
    await expect(visibleRelationships(page)).toHaveCount(allRels);
    await expect(filterBox(page)).toBeFocused();
  });

  test("says when a section has nothing that matches", async ({ page }) => {
    await page.goto("/guide");
    await filterBox(page).fill("zzzz-no-such-thing");
    await expect(visibleCards(page)).toHaveCount(0);
    for (const id of ["classes", "relationships", "impact", "hints", "archimate"]) {
      await expect(page.locator(`[data-guide-section=${id}] [data-guide-empty]`)).toBeVisible();
    }
    await expect(page.getByRole("status").filter({ hasText: /match/ })).toContainText("No entries match");
  });

  test("layer and kind chips narrow classes and relationships; hints answer to the words alone", async ({ page }) => {
    await page.goto("/guide");
    const infra = await chip(page, "Infrastructure");
    await infra.click();
    await expect(infra).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("[data-guide-section=classes] [data-guide-item]:visible").filter({ hasText: "Business Capability" })).toHaveCount(0);
    await expect(visibleCards(page).filter({ hasText: "Host" }).first()).toBeVisible();
    // A relationship stays when either end is in the layer.
    await expect(visibleRelationships(page).filter({ hasText: "Business Capability" })).toHaveCount(0);
    await expect(visibleRelationships(page).filter({ hasText: "Host" }).first()).toBeVisible();
    await expect(page.locator("[data-guide-section=hints] [data-guide-item]:visible")).toHaveCount(11);

    const cmdb = await chip(page, "CMDB");
    await cmdb.click();
    for (const e of await ends(visibleCards(page))) expect(e).toMatch(/^infrastructure:.*cmdb/);
    await infra.click();
    await cmdb.click();
    await expect(visibleCards(page)).toHaveCount(classes.length);
  });

  test("with a layer and a kind on, a relationship stays only when one end is both", async ({ page }) => {
    await page.goto("/guide");
    await (await chip(page, "Infrastructure")).click();
    await (await chip(page, "Extended")).click();
    const rows = await ends(visibleRelationships(page));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.split(" ").some((end) => /^infrastructure:.*extended/.test(end))).toBe(true);
    // Host → Product Model: Host is infrastructure, Product Model is extended, neither end is both.
    await expect(visibleRelationships(page).filter({ has: page.locator("a[href='#host']") }).filter({ has: page.locator("a[href='#product-model']") })).toHaveCount(0);
  });
});

test.describe("guide rail", () => {
  test("stays in view and marks the section you are reading", async ({ page }) => {
    await page.goto("/guide");
    // Scroll as a reader would, the heading reaching the top of the view.
    await page.locator("#hints").evaluate((h) => h.scrollIntoView({ block: "start" }));
    await expect(rail(page)).toBeInViewport();
    await expect(filterBox(page)).toBeInViewport();
    await expect(rail(page).getByRole("link", { name: /^Hints/ })).toHaveAttribute("aria-current", "location");
    await rail(page).getByRole("link", { name: /^Relationships/ }).click();
    await expect(page).toHaveURL(/#relationships$/);
    await expect(rail(page).getByRole("link", { name: /^Relationships/ })).toHaveAttribute("aria-current", "location");
  });

  test("a section's heading lands below the tools, even with the chips open", async ({ page }) => {
    await page.goto("/guide");
    await (await chip(page, "Design")).click();
    await rail(page).getByRole("link", { name: /^Impact/ }).click();
    await expect(page).toHaveURL(/#impact$/);
    const tools = (await page.getByRole("complementary", { name: "Guide tools" }).boundingBox())!;
    const heading = (await page.locator("#impact").boundingBox())!;
    // On narrow screens the tools are a bar over the page; on wide ones a column beside it.
    if (page.viewportSize()!.width < 1024) expect(heading.y).toBeGreaterThanOrEqual(tools.y + tools.height);
    await expect(page.locator("#impact")).toBeInViewport();

    // A class link in a table lands its card below the tools too.
    await page.locator("[data-guide-section=relationships] a[href='#application-service']").first().click();
    await expect(page).toHaveURL(/#application-service$/);
    const bar = (await page.getByRole("complementary", { name: "Guide tools" }).boundingBox())!;
    const card = (await page.locator("#application-service").boundingBox())!;
    if (page.viewportSize()!.width < 1024) expect(card.y).toBeGreaterThanOrEqual(bar.y + bar.height);
    await expect(page.locator("#application-service")).toBeInViewport();
  });
});

test.describe("classes and relationships link to each other", () => {
  test("a class has its own anchor and lists what it connects to, each a link to that class", async ({ page }) => {
    await page.goto("/guide#business-application");
    const card = page.locator("#business-application");
    await expect(card).toBeInViewport();
    await expect(card).toContainText("Business Application");
    await card.getByText(/^Connects to \d+/).click();
    const link = card.getByRole("link", { name: "Application Service", exact: true });
    await expect(link).toHaveAttribute("href", "#application-service");
    await link.click();
    await expect(page).toHaveURL(/#application-service$/);
    await expect(page.locator("#application-service")).toBeInViewport();
  });

  test("relationship rows link each end to its class", async ({ page }) => {
    await page.goto("/guide#relationships");
    const row = visibleRelationships(page).first();
    const from = row.getByRole("link").first();
    const href = (await from.getAttribute("href"))!;
    expect(href).toMatch(/^#[a-z0-9-]+$/);
    await from.click();
    await expect(page.locator(href)).toBeInViewport();
  });

  test("following a link to a class the filter hides clears the filter first", async ({ page }) => {
    await page.goto("/guide");
    await filterBox(page).fill("business application");
    // The target is hidden by the filter (else this test would prove nothing).
    await expect(page.locator("#application-service")).toBeHidden();
    const card = page.locator("#business-application");
    await card.getByText(/^Connects to \d+/).click();
    await card.getByRole("link", { name: "Application Service", exact: true }).click();
    await expect(page.locator("#application-service")).toBeInViewport();
    await expect(filterBox(page)).toHaveValue("");
  });

  test("an address naming a class the filter hides clears the filter too", async ({ page }) => {
    await page.goto("/guide");
    await filterBox(page).fill("business application");
    await expect(page.locator("#application-service")).toBeHidden();
    await page.evaluate(() => (location.hash = "application-service"));
    await expect(page.locator("#application-service")).toBeInViewport();
    await expect(filterBox(page)).toHaveValue("");
    // A malformed address is ignored without an error.
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.evaluate(() => (location.hash = "%E0"));
    await page.waitForTimeout(200);
    expect(errors).toEqual([]);
  });
});

test.describe("from the editor", () => {
  test.skip(({ isMobile }) => !!isMobile, "the Inspector is desktop-only");

  test("the Inspector links the selected element to its class in the guide", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await openExample(page, "Online Store Checkout");
    await page.getByRole("button", { name: "Fit View" }).click();
    await page.locator(".react-flow__node").filter({ hasText: "Checkout web app" }).click();
    const link = page.getByRole("complementary", { name: "Inspector" }).getByRole("link", { name: /In the guide/ });
    await expect(link).toHaveAttribute("href", /\/guide\/?#application$/);
    await link.click();
    await expect(page.locator("#application")).toBeInViewport();
  });
});

for (const scheme of ["dark", "light"] as const) {
  test(`the guide with a filter and chip on has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/guide");
    await filterBox(page).fill("service");
    await (await chip(page, "Design")).click();
    expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
  });
}
