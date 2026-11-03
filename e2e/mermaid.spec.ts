import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

// M82: the model as Mermaid text, saved as .mmd or copied, following what's shown.
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");

test.describe("Mermaid export (M82, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the Export menu is on the desktop toolbar");

  test("saves the whole model as .mmd; copies what a focus keeps, and says so", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/editor?example=checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await saved(page);

    await page.getByRole("button", { name: "Export" }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /^Mermaid diagram \(\.mmd\)/ }).click()]);
    expect(download.suggestedFilename()).toBe("online-store-checkout.mmd");
    const text = await readFile((await download.path())!, "utf8");
    expect(text.split("\n").slice(0, 2)).toEqual(["%% Online Store Checkout · Blueprint Modeler (model.mikereams.com)", "flowchart TB"]);
    expect(text.match(/^\s+n\d+\["/gm)).toHaveLength(14);
    expect(text.match(/^\s+n\d+ -->\|/gm)).toHaveLength(13);
    await expect(page.getByRole("status").filter({ hasText: "Exported online-store-checkout.mmd (14 elements)" })).toHaveCount(1);

    // Focused: only what the focus keeps, and a comment says what that is.
    const node = page.locator(".react-flow__node-csdm").filter({ has: page.getByText("web-prod-01", { exact: true }) });
    await node.click({ button: "right" });
    await page.getByRole("menuitem", { name: "Focus on this element" }).click();
    const kept = Number((await page.getByTestId("focus-count").textContent())!.split(" ")[0]);
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("button", { name: /^Copy as Mermaid/ }).click();
    await expect(page.getByRole("status").filter({ hasText: `Copied the model as Mermaid (${kept} of 14 elements)` })).toHaveCount(1);
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied.split("\n")[1]).toBe(`%% Showing ${kept} of 14 elements: focused on web-prod-01, within 1 relationship`);
    expect(copied.match(/^\s+n\d+\["/gm)).toHaveLength(kept);
  });
});
