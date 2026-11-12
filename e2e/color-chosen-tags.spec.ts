import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M86: coloring by tag, the tags you tick count; none ticked colors by each element's first tag.
const axeTags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const dialog = (page: Page) => page.getByTestId("view-dialog");
const legend = (page: Page) => page.getByTestId("view-legend");
const viewsButton = (page: Page) => page.getByRole("button", { name: /^Views/ });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });
const chosen = (page: Page) => dialog(page).getByRole("group", { name: "Tags to color by" });
async function openFilter(page: Page) {
  await viewsButton(page).click();
  await page.getByTestId("views-menu").getByRole("button", { name: "Filter and color…" }).click();
}

const model = {
  schema: 1,
  id: "e2e-chosen-tags",
  name: "Teams",
  created: "2026-11-12T00:00:00.000Z",
  updated: "2026-11-12T00:00:00.000Z",
  nodes: [
    { id: "a", class: "business_application", name: "Payroll", tags: ["Payments", "Team A"] },
    { id: "b", class: "business_application", name: "Ledger", tags: ["Team B"] },
    { id: "c", class: "business_application", name: "Archive", tags: ["Cost Center 7"] },
  ],
  edges: [],
  layout: { a: { x: 0, y: 160 }, b: { x: 300, y: 160 }, c: { x: 600, y: 160 } },
};

test.describe("color by chosen tags (M86, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is on the desktop");

  test("tick the tags that count; the legend and markers follow; kept in a saved view", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await page.getByTestId("import-file").setInputFiles({ name: "teams.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(model)) });
    await expect(currentModel(page)).toHaveText("Teams");

    await openFilter(page);
    await expect(chosen(page)).toHaveCount(0);
    await dialog(page).getByRole("group", { name: "Color by" }).getByLabel("Tag", { exact: true }).check();
    // None ticked: each element's first tag, as before.
    await expect(chosen(page).getByRole("checkbox")).toHaveCount(4);
    await expect(legend(page).getByRole("listitem")).toHaveText([/Cost Center 7\s*1/, /Payments\s*1/, /Team B\s*1/]);

    await chosen(page).getByLabel("Team A", { exact: true }).check();
    await chosen(page).getByLabel("Team B", { exact: true }).check();
    await expect(legend(page).getByRole("listitem")).toHaveText([/Team A\s*1/, /Team B\s*1/, /None of these tags\s*1/]);
    expect(await new AxeBuilder({ page }).withTags(axeTags).include("[data-testid=view-dialog]").analyze().then((r) => r.violations)).toEqual([]);
    await dialog(page).getByLabel("View name").fill("By team");
    await dialog(page).getByRole("button", { name: "Save as new view" }).click();
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(node(page, "Payroll").locator("[data-slot]")).toHaveAttribute("data-slot", "0");
    await expect(node(page, "Ledger").locator("[data-slot]")).toHaveAttribute("data-slot", "1");
    await expect(node(page, "Archive").locator("[data-slot]")).toHaveAttribute("data-slot", "none");
    await expect(node(page, "Archive")).toHaveAttribute("aria-label", /None of these tags/);
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");

    // Kept over a reload, with the view.
    await page.reload();
    await expect(currentModel(page)).toHaveText("Teams");
    await viewsButton(page).click();
    await page.getByTestId("views-menu").getByRole("button", { name: /By team/ }).click();
    await expect(legend(page).getByRole("listitem")).toHaveText([/Team A\s*1/, /Team B\s*1/, /None of these tags\s*1/]);
    await expect(viewsButton(page)).toHaveAccessibleName("Views: By team");

    // Unticking every tag goes back to each element's first tag, and the view says it was changed.
    await openFilter(page);
    await chosen(page).getByLabel("Team A", { exact: true }).uncheck();
    await chosen(page).getByLabel("Team B", { exact: true }).uncheck();
    await expect(legend(page).getByRole("listitem")).toHaveText([/Cost Center 7\s*1/, /Payments\s*1/, /Team B\s*1/]);
    await dialog(page).getByRole("button", { name: "Close" }).click();
    await expect(viewsButton(page)).toHaveAccessibleName(/By team \(edited\)/);
  });
});
