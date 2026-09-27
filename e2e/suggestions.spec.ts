import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { contrastOf } from "./contrast";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const palette = (page: Page) => page.getByRole("navigation", { name: "Element palette" });
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ hasText: name });

async function add(page: Page, cls: string, name: string) {
  await palette(page).getByRole("button", { name: cls, exact: true }).click();
  const field = inspector(page).getByLabel("Name", { exact: true });
  await expect(field).toBeFocused();
  await field.fill(name);
  await field.press("Enter");
  await expect(node(page, name)).toBeVisible();
}

async function openEditor(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
}

test.describe("relationship suggestions (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("a new element offers what it can connect to, and one click adds the element and the relationship", async ({ page }) => {
    await openEditor(page);
    await add(page, "Business Application", "Billing");
    const card = page.getByRole("group", { name: "Suggested relationships for Billing" });
    await expect(card).toBeVisible();
    await expect(card.getByRole("button", { name: /^New / })).toHaveText([/New Business Capability/, /New Application Service/, /New Information Object/, /New Business Process/]);
    await expect(inspector(page).getByTestId("inspector-suggestions")).toBeVisible();

    await card.getByRole("button", { name: /New Application Service/ }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(2);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.getByRole("status")).toHaveText("Added an Application Service related to Billing. Type its name.");
    await expect(inspector(page).getByLabel("Name", { exact: true })).toBeFocused();
    await expect(page.getByTestId("suggestions")).toHaveCount(0);
    // One undo step removes both.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1);
    await expect(page.locator(".react-flow__edge")).toHaveCount(0);
  });

  test("elements already on the canvas are offered first, from the Inspector too", async ({ page }) => {
    await openEditor(page);
    await add(page, "Business Capability", "Order management");
    await add(page, "Business Application", "Checkout");
    const list = inspector(page).getByTestId("inspector-suggestions");
    await expect(list.getByRole("button").first()).toHaveText(/Connect to Order management/);
    await list.getByRole("button", { name: /Connect to Order management/ }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.locator(".react-flow__edge").first()).toContainText("Provided by");
    await expect(list).toHaveCount(0);
  });

  test("hovering an unconnected element shows the card; Escape or the close button hides it", async ({ page }) => {
    await openEditor(page);
    await add(page, "Host", "web-01");
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId("suggestions")).toHaveCount(0);
    await page.getByRole("button", { name: "Fit View" }).click();
    await node(page, "web-01").hover();
    const card = page.getByRole("group", { name: "Suggested relationships for web-01" });
    await expect(card).toBeVisible();
    // The pointer can move onto the card without it closing.
    await card.getByRole("button").nth(1).hover();
    await page.waitForTimeout(500);
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Hide suggestions" }).click();
    await expect(card).toHaveCount(0);
    await node(page, "web-01").hover();
    await page.waitForTimeout(500);
    await expect(card).toHaveCount(0);
  });

  test("while drawing a line, elements it can be dropped on are outlined", async ({ page }) => {
    await openEditor(page);
    await add(page, "Business Application", "Checkout");
    await add(page, "Application Service", "Checkout prod");
    await add(page, "Host", "web-01");
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.getByRole("button", { name: "Fit View" }).click();
    const h = (await node(page, "Checkout prod").locator(".react-flow__handle-bottom").boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + 80, h.y + 40, { steps: 4 });
    await expect(page.locator("[data-connect-target]")).toHaveCount(1);
    await expect(node(page, "web-01").locator("[data-connect-target]")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("Drop on an outlined element: 1 can take a relationship from Checkout prod.");
    await page.mouse.up();
    await expect(page.locator("[data-connect-target]")).toHaveCount(0);
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the suggestion card has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openEditor(page);
      await add(page, "Business Application", "Billing");
      const card = page.getByTestId("suggestions");
      await expect(card).toBeVisible();
      expect(await contrastOf(card.locator("button span.font-mono").first())).toBeGreaterThanOrEqual(4.5);
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});
