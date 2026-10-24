import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExampleFitted } from "./examples";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const mod = process.platform === "darwin" ? "Meta" : "Control";

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExampleFitted(page, "Online Store Checkout");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
}

const palette = (page: Page) => page.getByRole("dialog", { name: "Commands" });
const search = (page: Page) => palette(page).getByRole("combobox", { name: "Search commands" });
const options = (page: Page) => palette(page).getByRole("option");
const active = (page: Page) => palette(page).locator('[role="option"][aria-selected="true"]');

async function openPalette(page: Page) {
  await page.keyboard.press(`${mod}+k`);
  await expect(palette(page)).toBeVisible();
  await expect(search(page)).toBeFocused();
}

/** Types a query and runs the first match with Enter. */
async function run(page: Page, query: string, expectFirst: string | RegExp) {
  await openPalette(page);
  await search(page).fill(query);
  await expect(options(page).first()).toContainText(expectFirst);
  await page.keyboard.press("Enter");
  await expect(palette(page)).toHaveCount(0);
}

test.describe("command palette and shortcut map (M52, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "keyboard editing is desktop-only");

  test("Ctrl/⌘K opens it with focus in the search box; Escape closes it and focus returns", async ({ page }) => {
    await openCheckout(page);
    const button = page.getByRole("button", { name: "Commands", exact: true });
    await expect(button).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    await button.focus();
    await openPalette(page);
    await expect(search(page)).toHaveAttribute("aria-expanded", "true");
    // Everything is listed before typing: toolbar commands, then every element.
    await expect(options(page).first()).toHaveText(/New model/);
    await expect(palette(page).getByRole("option", { name: /^Orders database/ })).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);
    await expect(button).toBeFocused();
    // The button opens it too.
    await button.click();
    await expect(search(page)).toBeFocused();
  });

  test("typing narrows the list; arrows move the highlight and wrap; Enter runs it", async ({ page }) => {
    await openCheckout(page);
    await openPalette(page);
    await search(page).fill("image png");
    await expect(options(page)).toHaveCount(2);
    await expect(active(page)).toContainText("Export Image, dark (PNG)");
    const activeId = async () => search(page).getAttribute("aria-activedescendant");
    expect(await activeId()).toBe(await active(page).getAttribute("id"));
    await page.keyboard.press("ArrowDown");
    await expect(active(page)).toContainText("Export Image, light (PNG)");
    expect(await activeId()).toBe(await active(page).getAttribute("id"));
    await page.keyboard.press("ArrowDown");
    await expect(active(page)).toContainText("Export Image, dark (PNG)");
    await page.keyboard.press("ArrowUp");
    await expect(active(page)).toContainText("Export Image, light (PNG)");

    await search(page).fill("no such command at all");
    await expect(options(page)).toHaveCount(0);
    await expect(palette(page)).toContainText("No commands match “no such command at all”.");

    await search(page).fill("model file");
    await expect(active(page)).toContainText("Export Model file (JSON)");
    const download = page.waitForEvent("download");
    await page.keyboard.press("Enter");
    expect((await download).suggestedFilename()).toMatch(/\.json$/);
    await expect(palette(page)).toHaveCount(0);
  });

  test("Add commands add an element and hand focus to its name, in one undo step", async ({ page }) => {
    await openCheckout(page);
    await run(page, "add business app", "Add Business Application");
    await expect(page.locator(".react-flow__node")).toHaveCount(15);
    await expect(page.getByRole("complementary", { name: "Inspector" }).getByLabel("Name", { exact: true })).toBeFocused();
    await page.locator(".react-flow__pane").click({ position: { x: 20, y: 20 } });
    await run(page, "undo", "Undo");
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
  });

  test("an element's name finds it: selected, zoomed to and announced", async ({ page }) => {
    await openCheckout(page);
    await run(page, "orders data", "Orders database");
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
    await expect(page.locator(".react-flow__node.selected")).toContainText("Orders database");
    await expect(page.getByRole("status")).toContainText("“Orders database”");
    // Centered once the zoom animation settles.
    const offCenter = async () => {
      const node = (await page.locator(".react-flow__node.selected").boundingBox())!;
      const canvas = (await page.getByRole("region", { name: "Model canvas" }).boundingBox())!;
      return Math.hypot(node.x + node.width / 2 - (canvas.x + canvas.width / 2), node.y + node.height / 2 - (canvas.y + canvas.height / 2));
    };
    await expect.poll(offCenter).toBeLessThan(40);
  });

  test("a command that cannot run now stays listed with its reason, and Enter leaves the palette open", async ({ page }) => {
    await openCheckout(page);
    await openPalette(page);
    await search(page).fill("zoom to selection");
    await expect(active(page)).toHaveAttribute("aria-disabled", "true");
    await expect(active(page)).toContainText("Select an element first");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toBeVisible();
    await expect(palette(page).locator("[aria-live]")).toHaveText("Zoom to selection: Select an element first");
  });

  test("View commands say what they will do and follow the current state", async ({ page }) => {
    await openCheckout(page);
    const minimap = page.getByRole("img", { name: /^Model overview/ });
    await expect(minimap).toBeVisible();
    await run(page, "minimap", "Hide minimap");
    await expect(minimap).toHaveCount(0);
    // By mouse this time.
    await openPalette(page);
    await search(page).fill("minimap");
    await palette(page).getByRole("option", { name: /^Show minimap/ }).click();
    await expect(palette(page)).toHaveCount(0);
    await expect(minimap).toBeVisible();
    // Snapping is turned on, not shown.
    await openPalette(page);
    await search(page).fill("snap");
    await expect(options(page).first()).toHaveText(/^Turn on snap to grid/);
  });

  test("Escape in the palette or the shortcut map leaves an open blast radius open", async ({ page }) => {
    await openCheckout(page);
    await page.locator(".react-flow__node").filter({ hasText: "Orders database" }).click({ button: "right" });
    await page.getByRole("menuitem", { name: /blast radius/i }).click();
    const region = page.getByRole("region", { name: "Blast radius" });
    await expect(region).toBeVisible();
    await openPalette(page);
    await page.keyboard.press("Escape");
    await expect(palette(page)).toHaveCount(0);
    await expect(region).toBeVisible();
    // The shortcut map has no text field to hold the key: its own guard is what keeps the view open.
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toHaveCount(0);
    await expect(region).toBeVisible();
  });

  test("editing keys do nothing to the canvas behind an open palette or shortcut map", async ({ page }) => {
    await openCheckout(page);
    await page.locator(".react-flow__node").filter({ hasText: "Orders database" }).click();
    await expect(page.locator(".react-flow__node.selected")).toHaveCount(1);
    const zoom = async () => Number(/scale\(([\d.]+)\)/.exec(await page.locator(".react-flow__viewport").evaluate((el) => (el as HTMLElement).style.transform))![1]);
    const before = await zoom();
    expect(before).toBeLessThan(0.9);
    await page.keyboard.press("?");
    const map = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(map).toBeVisible();
    await page.keyboard.press("Delete");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(200);
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
    await page.keyboard.press("Shift+0");
    await page.waitForTimeout(400); // a zoom would animate for 300 ms
    expect(await zoom()).toBeCloseTo(before, 2);
    await page.keyboard.press("Escape");

    // A click on an entry keeps focus in the search box, so typing goes on working.
    await openPalette(page);
    await search(page).fill("redo");
    await palette(page).getByRole("option", { name: /^Redo/ }).click({ force: true }); // aria-disabled: Playwright would wait for it to enable
    await expect(search(page)).toBeFocused();
    await expect(palette(page).locator("[aria-live]")).toHaveText("Redo: Nothing to redo");
    // With focus off the box anyway, editing keys still stay away from the canvas.
    await search(page).evaluate((el) => (el as HTMLElement).blur());
    await expect(search(page)).not.toBeFocused();
    await page.keyboard.press("Delete");
    await page.keyboard.press(`${mod}+z`);
    await expect(palette(page)).toBeVisible();
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
    // Ctrl/⌘K inside the open palette is kept from the browser (its own search-bar shortcut).
    const prevented = await page.evaluate(() => {
      const ev = new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, metaKey: navigator.platform.includes("Mac"), bubbles: true, cancelable: true });
      document.querySelector("[role=combobox]")!.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });

  test("Ctrl/⌘K works from a text field; ? does not; neither works while presenting", async ({ page }) => {
    await openCheckout(page);
    await page.locator(".react-flow__node").filter({ hasText: "Orders database" }).click();
    const name = page.getByRole("complementary", { name: "Inspector" }).getByLabel("Name", { exact: true });
    await name.focus();
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toHaveCount(0);
    await expect(name).toHaveValue("Orders database?");
    await page.keyboard.press("Escape");
    await expect(name).toHaveValue("Orders database");
    await openPalette(page);
    await page.keyboard.press("Escape");
    await expect(name).toBeFocused();

    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.getByRole("region", { name: "Presentation" })).toBeVisible();
    await page.keyboard.press(`${mod}+k`);
    await page.keyboard.press("?");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("? opens the shortcut map, also from the palette; Close and Escape return focus", async ({ page }) => {
    await openCheckout(page);
    const map = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    const button = page.getByRole("button", { name: "Commands", exact: true });
    await button.focus();
    await page.keyboard.press("?");
    await expect(map).toBeVisible();
    for (const area of ["Anywhere in the editor", "Canvas", "Side panel", "Presenting"]) await expect(map.getByRole("heading", { name: area })).toBeVisible();
    await expect(map).toContainText("Zoom to selection");
    await page.keyboard.press("Escape");
    await expect(map).toHaveCount(0);
    await expect(button).toBeFocused();

    await run(page, "shortcuts", "Keyboard shortcuts");
    await expect(map).toBeVisible();
    await map.getByRole("button", { name: "Close" }).click();
    await expect(map).toHaveCount(0);
    await expect(button).toBeFocused();
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`the palette and the shortcut map have no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openCheckout(page);
      await openPalette(page);
      await search(page).fill("zoom");
      await page.keyboard.press("ArrowDown");
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
      await search(page).fill("selection");
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
      await page.keyboard.press("Escape");
      await page.keyboard.press("?");
      await expect(page.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});

test.describe("command palette on a small screen (M52)", () => {
  test.skip(({ isMobile }) => !isMobile, "small screens only");

  test("the Commands button opens it, without the editing commands", async ({ page }) => {
    await openCheckout(page);
    await page.getByRole("button", { name: "Commands", exact: true }).click();
    await expect(palette(page)).toBeVisible();
    await expect(palette(page).getByRole("option", { name: /^Fit view/ })).toHaveCount(1);
    await expect(palette(page).getByRole("option", { name: /^Add / })).toHaveCount(0);
    await expect(palette(page).getByRole("option", { name: /^Layout/ })).toHaveCount(0);
    await search(page).fill("orders data");
    await page.keyboard.press("Enter");
    await expect(palette(page)).toHaveCount(0);
    await expect(page.locator(".react-flow__node.selected")).toContainText("Orders database");
  });
});
