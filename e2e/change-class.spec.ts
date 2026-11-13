import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M89: change an element's class; its relationships are kept where CSDM still allows one.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const dialog = (page: Page) => page.getByTestId("reclass-dialog");
const outcome = (page: Page) => page.getByTestId("reclass-outcome");
const edges = (page: Page) => page.locator(".react-flow__edge");

/** A node's place on the canvas (not the screen, which moves with the viewport), read from its transform. */
const canvasY = (page: Page, name: string) =>
  node(page, name).evaluate((el) => Number(/translate\((-?[\d.]+)px, ?(-?[\d.]+)px\)/.exec((el as HTMLElement).style.transform)![2]));

const model = {
  schema: 1,
  id: "e2e-change-class",
  name: "Payroll",
  created: "2026-11-13T00:00:00.000Z",
  updated: "2026-11-13T00:00:00.000Z",
  nodes: [
    { id: "cap", class: "business_capability", name: "Pay people" },
    { id: "ba", class: "business_application", name: "Payroll", attrs: { owner: "HR" } },
    { id: "svc", class: "application_service", name: "Payroll production" },
    { id: "app", class: "application", name: "payroll.war" },
    { id: "host", class: "host", name: "web-01" },
  ],
  edges: [
    { id: "e1", from: "cap", to: "ba", type: "Provided by::Provides" },
    { id: "e2", from: "ba", to: "svc", type: "Uses::Used by" },
    { id: "e3", from: "svc", to: "app", type: "Depends on::Used by" },
    { id: "e4", from: "app", to: "host", type: "Runs on::Runs" },
  ],
  layout: { cap: { x: 0, y: 0 }, ba: { x: 0, y: 240 }, svc: { x: 0, y: 480 }, app: { x: 0, y: 720 }, host: { x: 0, y: 960 } },
};

async function open(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await page.getByTestId("import-file").setInputFiles({ name: "payroll.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(model)) });
  await expect(currentModel(page)).toHaveText("Payroll");
  await expect(edges(page)).toHaveCount(4);
}

test.describe("change an element's class (M89, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("from the Inspector: says what happens to each relationship first; one undo step", async ({ page }) => {
    await open(page);
    await node(page, "payroll.war").click();
    await inspector(page).getByRole("button", { name: "Change class…" }).click();
    await expect(dialog(page)).toContainText("“payroll.war” is of class Application.");
    await expect(dialog(page).getByLabel("New class")).toBeFocused();
    // Its own class is not offered; nothing can be changed until one is chosen.
    await expect(dialog(page).getByLabel("New class").locator("option", { hasText: /^Application$/ })).toHaveCount(0);
    await expect(dialog(page).getByRole("button", { name: "Change class" })).toBeDisabled();
    await expect(outcome(page)).toHaveText("Choose a class to see what happens to its 2 relationships.");

    await dialog(page).getByLabel("New class").selectOption({ label: "Application Service" });
    await expect(outcome(page)).toContainText("Keeps 1 relationship as it is.");
    await expect(outcome(page)).toContainText("1 relationship takes the type CSDM allows for Application Service:");
    await expect(outcome(page)).toContainText("“payroll.war” → “web-01”: Runs on becomes Depends on");
    expect(await new AxeBuilder({ page }).withTags(axeTags).include("[data-testid=reclass-dialog]").analyze().then((r) => r.violations)).toEqual([]);

    await dialog(page).getByRole("button", { name: "Change class" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Changed “payroll.war” from Application to Application Service. 1 relationship kept, 1 given a new type. Undo brings it back." })).toHaveCount(1);
    await expect(node(page, "payroll.war")).toHaveAttribute("aria-label", /^Application Service: payroll\.war/);
    await expect(edges(page)).toHaveCount(4);
    await expect(page.locator('.react-flow__edge[aria-label="Depends on::Used by from payroll.war to web-01"]')).toHaveCount(1);
    // Focus is back where the dialog was opened.
    await expect(inspector(page).getByRole("button", { name: "Change class…" })).toBeFocused();
    await saved(page);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(node(page, "payroll.war")).toHaveAttribute("aria-label", /^Application: payroll\.war/);
    await expect(page.locator('.react-flow__edge[aria-label="Runs on::Runs from payroll.war to web-01"]')).toHaveCount(1);
  });

  test("from the element's menu: relationships CSDM has no place for are listed, then removed; Cancel changes nothing", async ({ page }) => {
    await open(page);
    await node(page, "Payroll").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Change class…" }).click();
    await dialog(page).getByLabel("New class").selectOption({ label: "Application" });
    await expect(outcome(page)).toContainText("Removes 2 relationships CSDM has no place for with Application:");
    await expect(outcome(page)).toContainText("“Pay people” → “Payroll” (Provided by)");
    await expect(outcome(page)).toContainText("“Payroll” → “Payroll production” (Uses)");

    // The Extended classes are offered only when Extended is on, as in the palette.
    await expect(dialog(page).getByLabel("New class").locator("option", { hasText: /^Strategic Priority$/ })).toHaveCount(0);
    // Delete and Backspace on a button belong to the dialog, not to the element selected behind it.
    await dialog(page).getByRole("button", { name: "Cancel" }).focus();
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await expect(dialog(page)).toBeVisible();
    await expect(node(page, "Payroll")).toHaveCount(1);

    await dialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(edges(page)).toHaveCount(4);
    await expect(node(page, "Payroll")).toBeFocused();

    await node(page, "Payroll").click({ button: "right" });
    await page.getByRole("menuitem", { name: "Change class…" }).click();
    await dialog(page).getByLabel("New class").selectOption({ label: "Application" });
    // By keyboard: on to the button, and Enter.
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(dialog(page).getByRole("button", { name: "Change class" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Changed “Payroll” from Business Application to Application. 2 relationships removed. Undo brings it back." })).toHaveCount(1);
    await expect(edges(page)).toHaveCount(2);
    await expect(node(page, "Payroll")).toHaveAttribute("aria-label", /^Application: Payroll/);
    // What isn't a relationship stays: the owner set on it.
    await node(page, "Payroll").click();
    await expect(inspector(page).getByRole("combobox", { name: /^Owner/ })).toHaveValue("HR");
  });

  test("with lanes on, the element goes to its new layer's lane; the palette offers it for the selection", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "View", exact: true }).click();
    await page.getByRole("button", { name: /^Lanes/ }).click();
    await page.keyboard.press("Escape");
    const before = await canvasY(page, "payroll.war");
    await node(page, "payroll.war").click();
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog", { name: "Commands" }).getByRole("combobox", { name: "Search commands" }).fill("change class");
    await page.keyboard.press("Enter");
    await dialog(page).getByLabel("New class").selectOption({ label: "Application Service" });
    await dialog(page).getByRole("button", { name: "Change class" }).click();
    await expect(page.getByRole("status").filter({ hasText: /Changed “payroll\.war” from Application to Application Service\. .*Moved to the Service lane\. Undo brings it back\./ })).toHaveCount(1);
    // Up out of the Application lane, to sit with the other Application Service.
    await expect.poll(() => canvasY(page, "payroll.war")).toBeLessThan(before - 40);
    const service = await canvasY(page, "Payroll production");
    expect(Math.abs((await canvasY(page, "payroll.war")) - service)).toBeLessThan(200);
  });
});
