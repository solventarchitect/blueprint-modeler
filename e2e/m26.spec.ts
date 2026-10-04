import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { contrastOf } from "./contrast";
import { openExample as chooseExample } from "./examples";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ hasText: name }).first();

const openExample = async (page: Page, label: string) => {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await chooseExample(page, label);
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
  await page.getByRole("button", { name: "Fit View" }).click();
};

test.describe("M26: ArchiMate notation, layer colors and the Read tab (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("the ArchiMate-only lens draws relationship notation with a legend; other lenses keep plain arrows", async ({ page }) => {
    await openExample(page, "Online Store Checkout");
    await page.getByRole("combobox", { name: "Framework lens" }).selectOption({ label: "ArchiMate 3.2 only" });

    // Every edge carries ArchiMate markers, and realizations are dashed with the hollow triangle.
    const paths = page.locator(".react-flow__edge-path");
    await expect(paths).toHaveCount(13);
    const ends = await paths.evaluateAll((els) => els.map((el) => `${el.getAttribute("marker-start") ?? ""} ${el.getAttribute("marker-end") ?? ""}`));
    expect(ends.every((m) => !m.includes("arrowclosed"))).toBe(true);
    const realization = page.locator(".react-flow__edge").filter({ has: page.locator(".react-flow__edge-text", { hasText: "Realization" }) }).first();
    await expect(realization.locator(".react-flow__edge-path")).toHaveAttribute("style", /stroke-dasharray: 6(px)?,? 4/);
    expect(`${await realization.locator(".react-flow__edge-path").getAttribute("marker-start")}${await realization.locator(".react-flow__edge-path").getAttribute("marker-end")}`).toContain("am-triangle-hollow-line");

    const legend = page.getByTestId("notation-legend");
    await expect(legend).toContainText("ArchiMate relationships");
    await expect(legend).toContainText("Realization");
    await expect(legend).toContainText("Serving");
    await expect(legend).not.toContainText("Influence"); // only the types the model uses

    // Elements take their ArchiMate layer's fill.
    await expect(node(page, "Checkout — production").locator("[data-archimate-layer]")).toHaveAttribute("data-archimate-layer", "Application");
    const fills = await page.locator("[data-archimate-layer]").evaluateAll((els) => new Set(els.map((el) => getComputedStyle(el).backgroundColor)).size);
    expect(fills).toBeGreaterThanOrEqual(3);

    await page.getByRole("combobox", { name: "Framework lens" }).selectOption({ label: "CSDM + ArchiMate 3.2" });
    await expect(legend).toHaveCount(0);
    await expect(page.locator("[data-archimate-layer]")).toHaveCount(0);
    const plain = await paths.evaluateAll((els) => els.every((el) => (el.getAttribute("marker-end") ?? "").includes("arrowclosed") && !el.getAttribute("marker-start")));
    expect(plain).toBe(true);
  });

  test("text on ArchiMate layer fills stays readable in both themes", async ({ page }) => {
    await openExample(page, "Claims Handling (ArchiMate View)");
    await expect(page.getByRole("combobox", { name: "Framework lens" })).toHaveValue("archimate-only");
    for (const scheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const el of await page.locator("[data-archimate-layer]").all()) {
        expect(await contrastOf(el.getByTestId("archimate-type")), scheme).toBeGreaterThanOrEqual(4.5);
        expect(await contrastOf(el.locator("p").nth(1)), scheme).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test("the Read tab reads every relationship, follows the lens and the selection, and highlights a choice", async ({ page }) => {
    await openExample(page, "Online Store Checkout");
    await page.getByRole("tab", { name: "Details" }).focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const readTab = page.getByRole("tab", { name: "Read" });
    await expect(readTab).toHaveAttribute("aria-selected", "true");
    await expect(readTab).toBeFocused();

    const panel = page.getByTestId("read-panel");
    const sentences = panel.getByRole("button");
    await expect(sentences).toHaveCount(13);
    await expect(panel).toContainText("Business Capability “Order management” is provided by Business Application “Checkout”.");

    // Choosing a sentence highlights its relationship and both ends; choosing it again clears it.
    const sentence = panel.getByRole("button", { name: /Business Application “Checkout” uses Application Service “Checkout — production”/ });
    await sentence.click();
    await expect(sentence).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".react-flow__edge.hinted")).toHaveCount(1);
    await expect(page.getByRole("status")).toContainText("uses Application Service “Checkout — production”");
    await sentence.click();
    await expect(page.locator(".react-flow__edge.hinted")).toHaveCount(0);

    // Selecting an element scopes the reading to it.
    await node(page, "Customer orders").click();
    await page.getByRole("tab", { name: "Read" }).click();
    await expect(sentences).toHaveCount(1);
    await page.getByRole("button", { name: "Fit View" }).click();
    await page.locator(".react-flow__pane").click({ position: { x: 5, y: 5 } });

    // The ArchiMate-only lens reads ArchiMate relationships from ArchiMate's source end.
    await page.getByRole("combobox", { name: "Framework lens" }).selectOption({ label: "ArchiMate 3.2 only" });
    await expect(panel).toContainText("Application Component “Checkout — production” realizes Application Component “Checkout”.");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`notation legend, layer fills and the Read tab have no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openExample(page, "Claims Handling (ArchiMate View)");
      await expect(page.getByTestId("notation-legend")).toBeVisible();
      await page.getByRole("tab", { name: "Read" }).click();
      await page.getByTestId("read-panel").getByRole("button").first().click();
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations).toEqual([]);
      expect(await contrastOf(page.getByTestId("notation-legend").locator("li").first()), scheme).toBeGreaterThanOrEqual(4.5);
    });
  }
});
