import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { currentModel } from "./model-menu";

// M79: the Export menu as a mega menu: five labeled groups in one panel, kept inside the window.
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

test.describe("the Export mega menu (M79, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the Export menu is on the desktop toolbar");

  for (const width of [1440, 1024, 800]) {
    test(`five groups, inside the window at ${width}px; Escape closes it and returns focus; axe passes`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/editor?example=checkout");
      await expect(currentModel(page)).toHaveText("Online Store Checkout");
      const button = page.getByRole("button", { name: "Export" });
      await button.click();
      const panel = page.getByTestId("export-panel");
      await expect(panel.getByRole("group")).toHaveCount(5);
      await expect(panel.getByRole("heading", { level: 3 })).toHaveText(["Share", "Images", "Documents", "Animations", "Other tools"]);
      await expect(panel.getByRole("group", { name: "Documents" }).getByRole("button")).toHaveCount(2);
      const box = (await panel.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await new AxeBuilder({ page }).withTags(tags).include('[data-testid="export-panel"]').analyze().then((r) => r.violations)).toEqual([]);
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
      await expect(button).toBeFocused();
    });
  }
});
