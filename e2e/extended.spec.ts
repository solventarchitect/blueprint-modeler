import { expect, test } from "@playwright/test";

test.describe("extended classes (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("are off by default, appear from the View menu, and connect with their own suggestions", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    const palette = page.getByRole("navigation", { name: "Element palette" });
    await expect(palette.getByRole("button", { name: "Goal", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "View", exact: true }).click();
    await page.getByRole("button", { name: /^Extended classes/ }).click();
    await page.keyboard.press("Escape");
    for (const name of ["Strategic Priority", "Goal", "Target", "Value Stream", "SDLC Component", "Product Model", "AI Application", "AI Function"]) {
      await expect(palette.getByRole("button", { name, exact: true }), name).toBeVisible();
    }

    await palette.getByRole("button", { name: "Target", exact: true }).click();
    await page.keyboard.press("Enter");
    const card = page.getByTestId("suggestions");
    await expect(card.getByRole("button", { name: /New Goal/ })).toBeVisible();
    await card.getByRole("button", { name: /New Goal/ }).click();
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);
    await expect(page.locator(".react-flow__edge").first()).toContainText("Measures");

    // The choice persists; the core palette stays uncluttered for everyone else.
    await page.reload();
    await expect(palette.getByRole("button", { name: "Goal", exact: true })).toBeVisible();
  });

  test("core elements do not suggest extended classes", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.getByRole("navigation", { name: "Element palette" }).getByRole("button", { name: "Business Application", exact: true }).click();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("suggestions")).toBeVisible();
    await expect(page.getByTestId("suggestions").getByRole("button", { name: /SDLC Component|Product Model/ })).toHaveCount(0);
  });
});
