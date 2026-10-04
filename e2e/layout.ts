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
  await expect(page.getByRole("status")).toContainText(choice === "Fill space" ? /fill|already|spread/i : "Laid out by CSDM layer", { timeout: 20_000 });
  await settled(page);
}

/** Waits until the fit animation that follows a layout has stopped moving the picture. */
export async function settled(page: Page) {
  let last = "";
  await expect
    .poll(async () => {
      const now = JSON.stringify(await diagramRect(page));
      const same = now === last;
      last = now;
      return same;
    })
    .toBe(true);
}

/** Auto-layout, as the old toolbar button did it. */
export const autoLayout = (page: Page) => chooseLayout(page, "Auto-layout");

/**
 * The layer boxes' on-screen rectangles, in layer order, each with the top-left corners of the
 * elements whose center lies in it — read in one go so no animation frame can come between.
 */
export const layerBoxRects = (page: Page) =>
  page.evaluate(() => {
    const nodes = [...document.querySelectorAll(".react-flow__node")].map((e) => e.getBoundingClientRect());
    return [...document.querySelectorAll("[data-testid=layer-box]")].map((e) => {
      const r = e.getBoundingClientRect();
      const inside = nodes.filter((n) => n.left + n.width / 2 > r.left && n.left + n.width / 2 < r.right && n.top + n.height / 2 > r.top && n.top + n.height / 2 < r.bottom);
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, nodes: inside.map((n) => ({ left: n.left, top: n.top })) };
    });
  });

/** The on-screen rectangle round every element. */
export const diagramRect = (page: Page) =>
  page.locator(".react-flow__node").evaluateAll((els) => {
    const rs = els.map((e) => e.getBoundingClientRect());
    const left = Math.min(...rs.map((r) => r.left)), top = Math.min(...rs.map((r) => r.top));
    return { left, top, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top };
  });
