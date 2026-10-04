import { expect, type Page } from "@playwright/test";

/** The Examples mega menu: its toolbar button and its panel. */
export const examplesButton = (page: Page) => page.getByRole("button", { name: "Examples", exact: true });
export const examplesMenu = (page: Page) => page.getByTestId("examples-menu");

/** Opens an example (or "Blank model") from the toolbar's Examples menu. */
export async function openExample(page: Page, name: string) {
  await examplesButton(page).click();
  await examplesMenu(page).getByRole("button", { name, exact: true }).click();
  await expect(examplesMenu(page)).toBeHidden();
}

/** Every example's name, in menu order (Blank model left out). */
export async function exampleNames(page: Page): Promise<string[]> {
  if ((await examplesButton(page).getAttribute("aria-expanded")) !== "true") await examplesButton(page).click();
  const names = await examplesMenu(page).getByRole("listitem").getByRole("button").evaluateAll((bs) => bs.map((b) => b.getAttribute("data-name") ?? ""));
  await page.keyboard.press("Escape");
  return names;
}
