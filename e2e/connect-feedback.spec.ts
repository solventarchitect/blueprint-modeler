import { expect, test, type Locator, type Page } from "@playwright/test";
import { openExample } from "./examples";

const center = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

async function hoverConnection(page: Page, fromName: string, toName: string) {
  const from = page.locator(".react-flow__node").filter({ hasText: fromName }).locator(".react-flow__handle-bottom");
  const to = page.locator(".react-flow__node").filter({ hasText: toName }).locator(".react-flow__handle-top");
  const a = await center(from);
  const b = await center(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 5 });
  await page.mouse.move(b.x, b.y, { steps: 5 });
}

test.describe("connection feedback (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the line turns green with the relationship type over a valid target, red with the reason over an invalid one", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await openExample(page, "HR Self-Service Portal");
    await expect(page.locator(".react-flow__node")).not.toHaveCount(0);
    // Opening an example fits the canvas a moment later; fit now so handles stop moving before measuring.
    await page.getByRole("button", { name: "Fit View" }).click();

    // Payroll (Business Application) → HR portal — production (Application Service): valid, "Uses::Used by".
    await hoverConnection(page, "Payroll (planned)", "HR portal — production");
    const line = page.locator(".bm-connection");
    await expect(line).toHaveAttribute("data-status", "valid");
    await expect(page.getByTestId("connection-verdict")).toContainText("✓ Uses::Used by");
    await page.mouse.up();
    await expect(page.locator(".react-flow__edge")).toHaveCount(8);

    // Payroll API (API) → Onboard a new hire (Business Process): invalid, with the reason, and nothing is created.
    await hoverConnection(page, "Payroll API", "Onboard a new hire");
    await expect(line).toHaveAttribute("data-status", "invalid");
    await expect(page.getByTestId("connection-verdict")).toContainText("✕");
    await page.mouse.up();
    await expect(page.locator(".react-flow__edge")).toHaveCount(8);
    await expect(page.getByRole("status")).toContainText("in CSDM");
  });
});
