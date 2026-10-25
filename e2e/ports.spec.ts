import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { settled } from "./layout";
import { currentModel } from "./model-menu";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const menu = (page: Page) => page.getByTestId("context-menu");

async function open(page: Page) {
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
  await settled(page);
}

const pathOf = (page: Page, edgeId: string) => page.getByTestId(`rf__edge-${edgeId}`).locator("path.react-flow__edge-path").getAttribute("d");

test.describe("connection points that stick (M61, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the relationship menu moves either end to a chosen side, keeps it in the file, and back to automatic", async ({ page }) => {
    await open(page);
    const edgeId = (await page.locator(".react-flow__edge").first().getAttribute("data-testid"))!.replace("rf__edge-", "");
    const edge = page.getByTestId(`rf__edge-${edgeId}`);
    const before = await pathOf(page, edgeId);

    await edge.locator("path.react-flow__edge-interaction, path.react-flow__edge-path").first().click({ button: "right", force: true });
    await menu(page).getByRole("menuitemcheckbox", { name: "Leave from the left" }).click();
    await expect(page.getByRole("status")).toContainText("from the left");
    await expect.poll(() => pathOf(page, edgeId)).not.toBe(before);
    const moved = await pathOf(page, edgeId);

    // It sticks: after a reload, and in the exported file.
    // Saved first (the status says "Saving…" from the change until it is written).
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.reload();
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await expect.poll(() => pathOf(page, edgeId)).toBe(moved);
    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Model file \(JSON\)/ }).click()]);
    const file = JSON.parse(await readFile((await download.path())!, "utf8"));
    expect(file.edges.find((e: { id: string }) => e.id === edgeId).ports).toEqual({ from: "left" });

    // The menu shows the choice; Automatic puts the line back where the layout puts it.
    await page.getByTestId(`rf__edge-${edgeId}`).locator("path").first().click({ button: "right", force: true });
    await expect(menu(page).getByRole("menuitemcheckbox", { name: "Leave from the left" })).toHaveAttribute("aria-checked", "true");
    await menu(page).getByRole("menuitem", { name: "Automatic connection points" }).click();
    await expect(page.getByRole("status")).toContainText("Connection points back to automatic.");
    await expect.poll(() => pathOf(page, edgeId)).toBe(before);
    // One undo step back to the chosen side.
    await page.keyboard.press("Control+z");
    await expect.poll(() => pathOf(page, edgeId)).toBe(moved);
  });

  test("dragging a relationship's end to another point on its element keeps it there", async ({ page }) => {
    await open(page);
    const edgeId = (await page.locator(".react-flow__edge").first().getAttribute("data-testid"))!.replace("rf__edge-", "");
    const before = await pathOf(page, edgeId);
    // The end at the target: React Flow's reconnect anchor sits on it.
    const target = await page.getByTestId(`rf__edge-${edgeId}`).evaluate((el) => {
      const anchor = el.querySelector(".react-flow__edgeupdater-target") as SVGCircleElement;
      const r = anchor.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    // Its element: the node whose box holds that point.
    const nodeId = await page.evaluate(({ x, y }) => {
      for (const n of document.querySelectorAll<HTMLElement>(".react-flow__node")) {
        const r = n.getBoundingClientRect();
        if (x >= r.x - 12 && x <= r.right + 12 && y >= r.y - 12 && y <= r.bottom + 12) return n.dataset.id;
      }
      return null;
    }, target);
    const node = page.locator(`.react-flow__node[data-id="${nodeId}"]`);
    await node.hover();
    const right = (await node.locator('.react-flow__handle[data-handleid="right"]').boundingBox())!;
    await page.mouse.move(target.x, target.y);
    await page.mouse.down();
    await page.mouse.move(target.x + 10, target.y + 10, { steps: 3 });
    await page.mouse.move(right.x + right.width / 2, right.y + right.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByRole("status")).toContainText("at the right");
    await expect.poll(() => pathOf(page, edgeId)).not.toBe(before);
    await page.keyboard.press("Control+z");
    await expect.poll(() => pathOf(page, edgeId)).toBe(before);
  });

  test("letting go of a moved end on empty canvas changes nothing and opens no menu", async ({ page }) => {
    await open(page);
    const edgeId = (await page.locator(".react-flow__edge").first().getAttribute("data-testid"))!.replace("rf__edge-", "");
    const before = await pathOf(page, edgeId);
    const end = await page.getByTestId(`rf__edge-${edgeId}`).evaluate((el) => {
      const r = (el.querySelector(".react-flow__edgeupdater-target") as SVGCircleElement).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    });
    const pane = (await page.locator(".react-flow__pane").boundingBox())!;
    await page.mouse.move(end.x, end.y);
    await page.mouse.down();
    // While moving an end, no other element is offered as a target.
    await page.mouse.move(end.x + 20, end.y + 20, { steps: 3 });
    await expect(page.locator("[data-connect-target]")).toHaveCount(0);
    // Empty canvas, far from any element (the bottom-right corner of the canvas).
    await page.mouse.move(pane.x + pane.width - 30, pane.y + pane.height - 30, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByRole("status")).not.toContainText("Drop the end");
    expect(await pathOf(page, edgeId)).toBe(before);
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the relationship menu with connection points passes WCAG 2.2 AA (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await open(page);
      await page.locator(".react-flow__edge").first().locator("path").first().click({ button: "right", force: true });
      await expect(menu(page).getByRole("menuitemcheckbox", { name: "Arrive at the top" })).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});
