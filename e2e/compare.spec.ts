import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";
import { openExample } from "./examples";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ has: page.getByText(name, { exact: true }) });
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const bar = (page: Page) => page.getByTestId("compare-bar");
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");

async function open(page: Page) {
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await saved(page);
}

/** Rename one element, delete another: one changed, one removed, and its relationships removed. */
async function edit(page: Page) {
  await node(page, "Checkout").click();
  const name = inspector(page).getByLabel("Name", { exact: true });
  await name.fill("Checkout v2");
  await name.press("Enter");
  await node(page, "web-test-01").click();
  await page.keyboard.press("Delete");
  await expect(page.locator(".react-flow__node")).toHaveCount(13);
  await saved(page);
}

async function compareWith(page: Page) {
  await page.keyboard.press(`${mod}+k`);
  await page.getByRole("combobox", { name: "Search commands" }).fill("Compare with");
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("compare-dialog")).toBeVisible();
}

test.describe("compare (M58, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("with another saved model: counts, marks on the canvas, the change list, and Escape closes it", async ({ page }) => {
    await open(page);
    // A second copy of the example, then change it.
    await openExample(page, "Online Store Checkout");
    await saved(page);
    await edit(page);

    await compareWith(page);
    await page.getByTestId("compare-dialog").getByRole("button", { name: /^Online Store Checkout/ }).click();
    await expect(page.getByTestId("compare-dialog")).toHaveCount(0);
    await expect(bar(page)).toContainText("Changes since “Online Store Checkout”");
    await expect(page.getByTestId("compare-summary")).toHaveText(/1 element changed, 1 element removed, \d+ relationships? removed/);
    // Marked on the canvas, in words for screen readers too.
    await expect(page.locator('[data-testid="diff-badge"][data-diff="changed"]')).toHaveCount(1);
    await expect(node(page, "Checkout v2")).toHaveAttribute("aria-label", /changed since “Online Store Checkout”: name/);
    // The list: removed by name; changed with what changed; a changed element goes to it.
    const list = page.getByTestId("compare-list");
    await expect(list).toContainText("web-test-01 (Host)");
    await expect(list).toContainText("Name: Checkout → Checkout v2");
    await list.getByRole("button", { name: /Checkout v2/ }).click();
    await expect(page.locator(".react-flow__node.selected")).toContainText("Checkout v2");

    // Undoing the change takes it out of the comparison as it happens.
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("compare-summary")).toHaveText("1 element changed");
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("compare-summary")).toHaveText("No differences");

    await page.keyboard.press("Escape");
    await expect(bar(page)).toHaveCount(0);
    await expect(page.getByTestId("diff-badge")).toHaveCount(0);
  });

  test("with a model file; a file that is not a model says why", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Model file \(JSON\)/ }).click()]);
    const file = await readFile((await download.path())!, "utf8");
    await edit(page);

    await compareWith(page);
    await page.getByTestId("compare-file").setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from('{"hello": 1}') });
    await expect(page.getByTestId("compare-dialog").getByRole("alert")).toContainText("not a Blueprint Modeler file");
    await page.getByTestId("compare-file").setInputFiles({ name: "checkout-before.json", mimeType: "application/json", buffer: Buffer.from(file) });
    await expect(bar(page)).toContainText("Changes since “checkout-before.json”");
    await expect(page.getByTestId("compare-summary")).toHaveText(/1 element changed, 1 element removed/);
  });

  test("the same model compared with itself says there are no differences", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Model file \(JSON\)/ }).click()]);
    await compareWith(page);
    await page.getByTestId("compare-file").setInputFiles((await download.path())!);
    await expect(page.getByTestId("compare-summary")).toHaveText("No differences");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the dialog and the compare bar pass WCAG 2.2 AA (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await openExample(page, "Online Store Checkout");
      await saved(page);
      await edit(page);
      await compareWith(page);
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations, "dialog").toEqual([]);
      await page.getByTestId("compare-dialog").getByRole("button", { name: /^Online Store Checkout/ }).click();
      await expect(bar(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations, "bar").toEqual([]);
    });
  }
});

test.describe("compare covers everything saved (M72, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("saved views, saved flows and the model's details are listed; the bar passes axe", async ({ page }) => {
    await open(page);
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Model file \(JSON\)/ }).click()]);
    // The base: the same model with a description, a saved view and a saved flow this one doesn't have.
    const base = JSON.parse(await readFile((await download.path())!, "utf8"));
    base.description = "Before the review.";
    base.views = [{ id: "v1", name: "Production", filter: { environment: ["Production"] }, colorBy: "layer" }];
    base.flows = [{ id: "f1", name: "Customer places an order", steps: [{ edge: base.edges[0].id }] }];

    await compareWith(page);
    await page.getByTestId("compare-file").setInputFiles({ name: "before-review.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(base)) });
    await expect(page.getByTestId("compare-summary")).toHaveText("model details changed, 1 view removed, 1 flow removed");
    const list = page.getByTestId("compare-list");
    await expect(list).toContainText("View “Production”");
    await expect(list).toContainText("Flow “Customer places an order”");
    await expect(page.getByTestId("compare-details")).toContainText(/Description: Before the review\. → /);
    expect((await new AxeBuilder({ page }).withTags(tags).include('[data-testid="compare-bar"]').analyze()).violations).toEqual([]);
  });
});
