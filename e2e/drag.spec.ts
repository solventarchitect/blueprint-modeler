import { expect, test } from "@playwright/test";

test.describe("dragging (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("elements stay visible while a node is being dragged", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Online store checkout" });
    const node = page.locator(".react-flow__node").filter({ hasText: "Checkout web app" });
    await expect(node).toBeVisible();
    const box = (await node.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(box.x + box.width / 2 + i * 12, box.y + box.height / 2 + i * 6);
      const hidden = await page.locator(".react-flow__node").evaluateAll((els) => els.filter((e) => getComputedStyle(e).visibility === "hidden").length);
      expect(hidden, `step ${i}`).toBe(0);
    }
    await page.mouse.up();
    await expect(node).toBeVisible();
  });
});
