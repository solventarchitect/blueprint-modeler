import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { currentModel } from "./model-menu";

// M65: links and a record number on an element.
const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const links = (page: Page) => inspector(page).getByRole("region", { name: "Links" });
const node = (page: Page, name: string) => page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) });

async function start(page: Page) {
  await page.goto("/editor");
  await saved(page);
  await openExample(page, "Online Store Checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await saved(page);
  await node(page, "Checkout").click();
  await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue("Checkout");
}

async function addLink(page: Page, title: string, url: string) {
  await links(page).getByLabel("Link title").fill(title);
  await links(page).getByLabel("Web address").fill(url);
  await links(page).getByRole("button", { name: "Add link" }).click();
}

test.describe("links and a record number (M65, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("a record number and links are saved with the element, open in a new tab, and come off again", async ({ page }) => {
    await start(page);
    const record = inspector(page).getByRole("textbox", { name: /^Record number/ });
    await record.fill("APM0001234");
    await record.press("Tab");
    // No scheme: taken as https.
    await addLink(page, "Runbook", "example.com/runbook");
    const link = links(page).getByRole("link", { name: "Runbook (opens in a new tab)" });
    await expect(link).toHaveAttribute("href", "https://example.com/runbook");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    // Where it goes is shown; focus goes back to the title for the next one.
    await expect(links(page).getByRole("listitem")).toContainText("example.com");
    await expect(links(page).getByLabel("Link title")).toBeFocused();
    // Not a web address: said on that field, and nothing added.
    await addLink(page, "Script", "javascript:alert(1)");
    await expect(links(page).getByRole("alert")).toHaveText("Enter a web address, such as https://example.com/page.");
    await expect(links(page).getByLabel("Web address")).toHaveAttribute("aria-invalid", "true");
    await expect(links(page).getByLabel("Link title")).not.toHaveAttribute("aria-invalid", "true");
    await expect(links(page).getByRole("link")).toHaveCount(1);
    await saved(page);
    await page.reload();
    await node(page, "Checkout").click();
    await expect(inspector(page).getByRole("textbox", { name: /^Record number/ })).toHaveValue("APM0001234");
    await expect(links(page).getByRole("link", { name: /^Runbook/ })).toHaveAttribute("href", "https://example.com/runbook");
    await links(page).getByRole("button", { name: "Remove link 1, Runbook" }).click();
    await expect(links(page).getByRole("link")).toHaveCount(0);
    // The last one gone: focus goes to the title field.
    await expect(links(page).getByLabel("Link title")).toBeFocused();
    // One undo brings it back.
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(links(page).getByRole("link")).toHaveCount(1);
  });

  test("up to five links; the form says so; another element starts its own; axe passes", async ({ page }) => {
    await start(page);
    for (let i = 1; i <= 5; i++) await addLink(page, `Page ${i}`, `https://example.com/${i}`);
    await expect(links(page).getByRole("link")).toHaveCount(5);
    await expect(links(page)).toContainText("An element holds up to 5 links: remove one to add another.");
    await expect(links(page).getByRole("button", { name: "Add link" })).toHaveCount(0);
    // The form closed under focus: it moves to the Links heading.
    await expect(links(page).getByRole("heading", { name: "Links" })).toBeFocused();
    expect(await new AxeBuilder({ page }).withTags(tags).include('[aria-label="Inspector"]').analyze().then((r) => r.violations)).toEqual([]);
    await links(page).getByRole("button", { name: "Remove link 3, Page 3" }).click();
    await expect(links(page).getByLabel("Link title")).toBeVisible();
    // Focus stays in the list, on the Remove button that took its place.
    await expect(links(page).getByRole("button", { name: "Remove link 3, Page 4" })).toBeFocused();
    await links(page).getByLabel("Link title").fill("half typed");
    await node(page, "Orders database").click();
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue("Orders database");
    await expect(links(page).getByRole("link")).toHaveCount(0);
    await expect(links(page).getByLabel("Link title")).toHaveValue("");
  });
});
