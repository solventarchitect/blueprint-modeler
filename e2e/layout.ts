import { expect, type Page } from "@playwright/test";

/** The Layout menu: its toolbar button and its panel. */
export const layoutButton = (page: Page) => page.getByRole("button", { name: /^Layout/ });
export const layoutMenu = (page: Page) => page.getByTestId("layout-menu");

export type LayoutChoice = "Auto-layout" | "Top to bottom" | "Left to right" | "Symmetric" | "Fill space";

/** Picks an arrangement from the toolbar's Layout menu and waits for the canvas to settle. */
export async function chooseLayout(page: Page, choice: LayoutChoice) {
  await layoutButton(page).click();
  await layoutMenu(page).getByRole("button", { name: choice, exact: true }).click();
  await expect(layoutMenu(page)).toBeHidden();
  await expect(page.getByRole("status")).toContainText(choice === "Fill space" ? /fill|already/i : "Laid out by CSDM layer", { timeout: 20_000 });
}

/** Auto-layout, as the old toolbar button did it. */
export const autoLayout = (page: Page) => chooseLayout(page, "Auto-layout");

/** The layer boxes' on-screen rectangles, in layer order. */
export const layerBoxRects = (page: Page) =>
  page.getByTestId("layer-box").evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    }),
  );

/** The on-screen rectangle round every element. */
export const diagramRect = (page: Page) =>
  page.locator(".react-flow__node").evaluateAll((els) => {
    const rs = els.map((e) => e.getBoundingClientRect());
    const left = Math.min(...rs.map((r) => r.left)), top = Math.min(...rs.map((r) => r.top));
    return { left, top, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top };
  });
