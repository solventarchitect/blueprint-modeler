import { expect, type Page } from "@playwright/test";

/**
 * The toolbar's Model menu: a button showing the open model's name (`data-count` holds how many models
 * are stored, `data-current` the open model's id) and a panel listing every stored model.
 */
export const modelButton = (page: Page) => page.getByTestId("model-menu-button");
export const currentModel = (page: Page) => page.getByTestId("current-model");
export const modelMenu = (page: Page) => page.getByTestId("model-menu");

/** Opens a stored model through the Model menu, by its name. */
export async function openStoredModel(page: Page, name: string) {
  await modelButton(page).click();
  await modelMenu(page).getByRole("button", { name, exact: true }).first().click();
  await expect(modelMenu(page)).toBeHidden();
}

/** The stored models' names, in the order the Model menu lists them. */
export async function storedModelNames(page: Page): Promise<string[]> {
  if ((await modelButton(page).getAttribute("aria-expanded")) !== "true") await modelButton(page).click();
  const names = await modelMenu(page)
    .locator("[data-model-name]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-model-name") ?? ""));
  await page.keyboard.press("Escape");
  return names;
}
