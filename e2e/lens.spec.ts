import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Online store checkout" });
  await expect(page.locator(".react-flow__node")).not.toHaveCount(0);
}

test.describe("framework lens (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the ArchiMate lens adds mapped names to nodes and the inspector, and survives a reload", async ({ page }) => {
    await openCheckout(page);
    await expect(page.getByTestId("lens-label")).toHaveCount(0);
    await page.getByRole("combobox", { name: "Framework lens" }).selectOption({ label: "CSDM + ArchiMate 3.2" });
    const labels = page.getByTestId("lens-label");
    await expect(labels).toHaveCount(await page.locator(".react-flow__node").count());
    await expect(page.locator(".react-flow__node").filter({ hasText: "Checkout — production" }).getByTestId("lens-label")).toHaveText(
      "Application Component",
    );

    await page.locator(".react-flow__node").filter({ hasText: "Checkout — production" }).click();
    const panel = page.getByTestId("lens-panel");
    await expect(panel).toContainText("Application Component");
    await expect(panel).toContainText("not an ArchiMate Application Service");
    await expect(panel.getByRole("link", { name: /Source: ArchiMate 3.2, Application Layer/ })).toHaveAttribute("href", /pubs\.opengroup\.org/);
    await expect(page.getByRole("complementary", { name: "Inspector" })).toContainText("ArchiMate: Serving");

    await page.reload();
    await expect(page.getByRole("combobox", { name: "Framework lens" })).toHaveValue("archimate");
    await expect(page.getByTestId("lens-label").first()).toBeVisible();
    await page.getByRole("combobox", { name: "Framework lens" }).selectOption({ label: "CSDM" });
    await expect(page.getByTestId("lens-label")).toHaveCount(0);
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the ArchiMate lens has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openCheckout(page);
      await page.getByRole("combobox", { name: "Framework lens" }).selectOption({ label: "CSDM + ArchiMate 3.2" });
      await page.locator(".react-flow__node").filter({ hasText: "Checkout — production" }).click();
      await expect(page.getByTestId("lens-panel")).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});
