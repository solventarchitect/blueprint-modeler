import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";

const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ has: page.getByText(name, { exact: true }) });
const opacity = (page: Page, name: string, side: "top" | "bottom" | "left" | "right") =>
  node(page, name).locator(`.react-flow__handle-${side}`).evaluate((h) => getComputedStyle(h).opacity);

test.describe("canvas elements and arrows (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test.beforeEach(async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await openExample(page, "Online store checkout");
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
    // Opening an example fits the canvas a moment later; fit now so elements stop moving before measuring.
    await page.getByRole("button", { name: "Fit View" }).click();
    await page.mouse.move(2, 2);
  });

  test("connection points stay hidden until an element is hovered or selected", async ({ page }) => {
    for (const side of ["top", "bottom", "left", "right"] as const) expect(await opacity(page, "Checkout", side), side).toBe("0");
    await node(page, "Checkout").hover();
    await expect.poll(() => opacity(page, "Checkout", "bottom")).toBe("1");
    expect(await opacity(page, "Orders database", "top")).toBe("0");

    await node(page, "Orders database").click();
    await page.mouse.move(2, 2);
    await expect.poll(() => opacity(page, "Orders database", "top")).toBe("1");
    expect(await opacity(page, "Checkout", "bottom")).toBe("0");
  });

  test("while drawing a relationship, the start and every element it can join show their connection points", async ({ page }) => {
    const from = node(page, "Checkout — production").locator(".react-flow__handle-bottom");
    const box = (await from.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 120, { steps: 5 });
    // web-test-01 (Host) can join Checkout — production (Application Service); they are not related yet.
    await expect(node(page, "web-test-01").locator("[data-connect-target]")).toHaveCount(1);
    await expect.poll(() => opacity(page, "web-test-01", "top")).toBe("1");
    expect(await opacity(page, "Checkout — production", "bottom")).toBe("1");
    // An element the relationship cannot join keeps its points hidden.
    expect(await opacity(page, "Order management", "top")).toBe("0");
    await page.mouse.up();
  });

  test("arrowheads have a fixed, readable on-screen size", async ({ page }) => {
    const marker = page.locator(".react-flow__marker marker").first();
    await expect(marker).toHaveAttribute("markerUnits", "userSpaceOnUse");
    // React Flow draws its closed arrow in the middle of a 20-unit box; at 32 px the head is about 8 × 13 px.
    expect(Number(await marker.getAttribute("markerWidth"))).toBeGreaterThanOrEqual(32);
  });
});
