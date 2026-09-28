import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { contrastOf } from "./contrast";

const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ hasText: name }).first();

const openExample = async (page: Page, label = "Online store checkout") => {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label });
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByRole("button", { name: "Fit View" }).click();
};

test.describe("selection, hover and layers (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  for (const scheme of ["dark", "light"] as const) {
    test(`selecting an element shades what it connects to, and those relationships (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openExample(page);
      await node(page, "Checkout — production").click();
      const neighbors = page.locator(".react-flow__node [data-neighbor]");
      await expect(neighbors).toHaveCount(4);
      for (const name of ["Checkout web app", "Orders database", "Online shopping — North America"]) {
        await expect(node(page, name).locator("[data-neighbor]")).toHaveCount(1);
      }
      await expect(node(page, "web-prod-01").locator("[data-neighbor]")).toHaveCount(0);
      await expect(page.locator(".react-flow__edge.connected")).toHaveCount(4);
      const card = neighbors.first();
      expect(await contrastOf(card.locator("p").first()), `class label (${scheme})`).toBeGreaterThanOrEqual(4.5);
      expect(await contrastOf(card.locator("p").nth(1)), `name (${scheme})`).toBeGreaterThanOrEqual(4.5);
      expect(await contrastOf(card, "outline"), `outline (${scheme})`).toBeGreaterThanOrEqual(3);
      await page.locator(".react-flow__pane").click({ position: { x: 10, y: 10 } });
      await expect(neighbors).toHaveCount(0);
    });
  }

  test("hovering an element highlights it and shows its description, without resizing it", async ({ page }) => {
    await openExample(page);
    const target = node(page, "Checkout — production");
    await target.click();
    await page.getByLabel("Description").fill("Customer-facing checkout, production.");
    await page.getByLabel("Name").focus();
    await page.locator(".react-flow__pane").click({ position: { x: 10, y: 10 } });
    await page.mouse.move(5, 5);
    const size = (await target.boundingBox())!;

    await target.hover();
    await expect(target.locator("[data-hovered]")).toHaveCount(1);
    await expect(target.getByTestId("node-description")).toHaveText("Customer-facing checkout, production.");
    const hovered = (await target.boundingBox())!;
    expect(Math.abs(hovered.width - size.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(hovered.height - size.height)).toBeLessThanOrEqual(1);

    await page.mouse.move(5, 5);
    await expect(target.locator("[data-hovered]")).toHaveCount(0);
    await expect(target.getByTestId("node-description")).toHaveCount(0);

    await page.reload();
    await node(page, "Checkout — production").click();
    await expect(page.getByLabel("Description")).toHaveValue("Customer-facing checkout, production.");
  });

  test("a layer's menu spreads its elements evenly, as one undo step", async ({ page }) => {
    await openExample(page);
    const hosts = ["web-prod-01", "db-prod-01", "web-test-01"];
    const lefts = () => Promise.all(hosts.map(async (h) => (await node(page, h).boundingBox())!.x));
    const box = (await node(page, "web-test-01").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    const before = await lefts();
    expect(Math.abs(before[1]! - before[0]! - (before[2]! - before[1]!))).toBeGreaterThan(20);

    await page.getByRole("button", { name: /^Infrastructure layer/ }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Distribute evenly" }).click();
    await expect.poll(async () => {
      const x = await lefts();
      return Math.abs(x[1]! - x[0]! - (x[2]! - x[1]!));
    }).toBeLessThanOrEqual(2);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(async () => (await lefts())[1]).toBeCloseTo(before[1]!, 0);
  });

  test("side-to-side relationships leave room for their label and arrow", async ({ page }) => {
    await openExample(page);
    const a = (await node(page, "Checkout").boundingBox())!;
    const b = (await node(page, "Customer orders").boundingBox())!;
    const label = (await page.locator(".react-flow__edge").filter({ hasText: "Uses" }).first().locator(".react-flow__edge-text").boundingBox())!;
    expect(label.x).toBeGreaterThan(a.x + a.width);
    expect(label.x + label.width).toBeLessThan(b.x);
    // Room for the arrowhead too: at least a label's width to spare.
    expect(b.x - (a.x + a.width)).toBeGreaterThan(label.width * 1.4);
  });
});

test.describe("exports and examples", () => {
  test.skip(({ isMobile }) => !!isMobile, "export is in the desktop toolbar");

  test("exports a ServiceNow import workbook", async ({ page }) => {
    await openExample(page);
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /ServiceNow import/ }).click()]);
    expect(download.suggestedFilename()).toBe("online-store-checkout-servicenow.xlsx");
    const bytes = await readFile((await download.path())!);
    expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(bytes.includes(Buffer.from("xl/worksheets/sheet1.xml"))).toBe(true);
    await expect(page.getByRole("status")).toContainText("README sheet");
  });

  test("the ArchiMate example reads purely in ArchiMate; the metamodel example is CSDM 5", async ({ page }) => {
    await openExample(page, "Claims handling (ArchiMate view)");
    await expect(page.getByRole("combobox", { name: "Framework lens" })).toHaveValue("archimate-only");
    await expect(node(page, "Claims system").getByTestId("archimate-type").first()).toHaveText("Application Component");
    await expect(page.locator(".react-flow__edge-text").filter({ hasText: "Realization" }).first()).toBeVisible();
    await expect(page.locator(".react-flow__node").getByText("Business Application", { exact: true })).toHaveCount(0);

    // The ArchiMate type stays readable on a shaded neighbor, in both themes.
    await node(page, "Claims system — production").click();
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const header = page.locator(".react-flow__node [data-neighbor]").first().getByTestId("archimate-type");
      expect(await contrastOf(header), scheme).toBeGreaterThanOrEqual(4.5);
    }
    await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "CSDM 5 core metamodel" });
    await expect(page.getByRole("combobox", { name: "Framework lens" })).toHaveValue("csdm");
    await expect(page.locator(".react-flow__node")).toHaveCount(19);
  });
});
