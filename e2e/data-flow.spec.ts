import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ has: page.getByText(name, { exact: true }) });
const strip = (page: Page) => page.getByRole("region", { name: "Data flow" });

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, "Online Store Checkout");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
  await page.getByRole("button", { name: "Fit View" }).click();
}

async function freeze(page: Page) {
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
}

async function showFlowFrom(page: Page, name: string) {
  await node(page, name).click({ button: "right" });
  await page.getByRole("menu", { name: `${name} menu` }).getByRole("menuitem", { name: "Show data flow" }).click();
  await expect(strip(page)).toBeVisible();
}

test.describe("data flow (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("only a Business Capability or Business Process offers Show data flow", async ({ page }) => {
    await openCheckout(page);
    await node(page, "db-prod-01").click({ button: "right" });
    const hostMenu = page.getByRole("menu", { name: "db-prod-01 menu" });
    await expect(hostMenu.getByRole("menuitem", { name: "Show blast radius" })).toBeVisible();
    await expect(hostMenu.getByRole("menuitem", { name: "Show data flow" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await node(page, "Order management").click({ button: "right" });
    await expect(page.getByRole("menu", { name: "Order management menu" }).getByRole("menuitem")).toContainText([/Show blast radius/, /Show data flow/]);
    await page.keyboard.press("Escape");
    // The Inspector offers it too, with a line on what it does.
    await node(page, "Order management").click();
    const inspector = page.getByRole("complementary", { name: "Inspector" });
    const button = inspector.getByRole("button", { name: "Show data flow" });
    await button.click();
    await expect(strip(page)).toBeVisible();
    await expect(strip(page).getByRole("button", { name: "Pause" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(strip(page)).toHaveCount(0);
    await expect(button).toBeFocused();
    await node(page, "db-prod-01").click();
    await expect(inspector.getByRole("button", { name: "Show data flow" })).toHaveCount(0);
    // From the keyboard: Shift+F10 opens the element's menu with the item.
    await node(page, "Order management").focus();
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menu", { name: "Order management menu" }).getByRole("menuitem", { name: "Show data flow" }).click();
    await expect(strip(page)).toBeVisible();
  });

  test("steps data from the capability down through everything it relies on, in its own color", async ({ page }) => {
    await page.clock.install();
    await openCheckout(page);
    await freeze(page);
    await showFlowFrom(page, "Order management");
    const s = strip(page);
    await expect(s.getByRole("heading", { name: "Data flow from Order management" })).toBeVisible();
    await expect(s.getByRole("group", { name: "Direction" })).toHaveCount(0);
    await expect(s.getByTestId("blast-progress")).toHaveText("Source · 0 of 9 reached");
    await expect(page.getByRole("status")).toHaveText("Data flow: from Order management, data reaches 9 elements in 4 steps.");
    const source = node(page, "Order management").locator("[data-blast]");
    await expect(source).toHaveAttribute("data-blast", "start");
    await expect(source).toHaveAttribute("data-flow", "true");
    await expect(node(page, "Order management")).toHaveAttribute("aria-label", /source of the data flow/);

    await s.getByRole("button", { name: "Pause" }).click();
    await s.getByRole("button", { name: "Next step" }).click();
    await s.getByRole("button", { name: "Next step" }).click();
    await expect(s.getByTestId("blast-progress")).toHaveText("Step 2 of 4 · 4 of 9 reached");
    await expect(page.getByRole("status")).toHaveText("Step 2: data reaches Customer orders, Checkout — production, Checkout — test.");
    await expect(page.locator(".react-flow__node [data-blast]")).toHaveCount(5);
    const prod = node(page, "Checkout — production").locator("[data-blast]");
    await expect(prod).toHaveAttribute("data-blast-hop", "2");
    await expect(prod).toHaveAttribute("data-blast-current", "true");
    await expect(prod.getByTestId("blast-badge")).toHaveText("2");
    await expect(node(page, "Checkout — production")).toHaveAttribute("aria-label", /data reaches it at step 2/);
    // Carried lines take the flow color and, at the current step, run along the line (with it, not against).
    await expect(page.locator(".react-flow__edge.blast.flow")).toHaveCount(4);
    await expect(page.locator(".react-flow__edge.blast-now")).toHaveCount(3);
    await expect(page.locator(".react-flow__edge.blast-now.blast-reverse")).toHaveCount(0);
    const ai = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ai").trim());
    const probe = await page.evaluate((c) => {
      const el = document.createElement("div");
      el.style.color = c;
      document.body.append(el);
      const out = getComputedStyle(el).color;
      el.remove();
      return out;
    }, ai);
    await expect(page.locator(".react-flow__edge.blast.flow .react-flow__edge-path").first()).toHaveCSS("stroke", probe);

    // The step list, then Escape closes it and says so.
    await s.getByText("Steps (5)").click();
    const items = s.getByRole("list", { name: "Steps" }).getByRole("listitem");
    await expect(items.first()).toHaveText("Source: Order management");
    await expect(items.last()).toHaveText("Step 4: web-prod-01, db-prod-01");
    await page.keyboard.press("Escape");
    await expect(strip(page)).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Data flow closed.");
    await expect(page.locator(".react-flow__node [data-blast]")).toHaveCount(0);
  });

  test("Play runs the flow to its end on its own", async ({ page }) => {
    await page.clock.install();
    await openCheckout(page);
    await freeze(page);
    await showFlowFrom(page, "Order management");
    const s = strip(page);
    await expect(s.getByRole("button", { name: "Pause" })).toBeVisible();
    await page.clock.runFor(1500 * 4 + 200);
    await expect(s.getByTestId("blast-progress")).toHaveText("Step 4 of 4 · 9 of 9 reached");
    await expect(s.getByRole("button", { name: "Play" })).toBeVisible();
  });

  test("exports its own GIF, one frame a step, and the blast-radius GIF stays for blast radii", async ({ page }) => {
    await openCheckout(page);
    await page.getByRole("button", { name: "Export" }).click();
    const flowItem = page.getByRole("button", { name: /^Data flow animation \(GIF\)/ });
    await expect(flowItem).toBeDisabled();
    await expect(flowItem).toContainText("Show a data flow first");
    await page.keyboard.press("Escape");

    await showFlowFrom(page, "Order management");
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByRole("button", { name: /^Blast radius animation \(GIF\)/ })).toBeDisabled();
    await expect(flowItem).toBeEnabled();
    await expect(flowItem).toContainText("5 frames");
    const download = page.waitForEvent("download");
    await flowItem.click();
    const d = await download;
    expect(d.suggestedFilename()).toBe("online-store-checkout-data-flow.gif");
    const bytes = await readFile((await d.path())!);
    expect(bytes.subarray(0, 6).toString("latin1")).toBe("GIF89a");
    expect(bytes.toString("latin1")).toContain("Data flow: from Order management");
    await expect(page.getByRole("status")).toContainText("Exported online-store-checkout-data-flow.gif: 5 frames");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`an open data flow has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openCheckout(page);
      await showFlowFrom(page, "Order management");
      await strip(page).getByRole("button", { name: "Pause" }).click();
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});

test("the guide says how to show a data flow and export it", async ({ page }) => {
  await page.goto("/guide");
  const how = page.getByTestId("blast-how");
  await expect(how).toContainText("Show data flow");
  await expect(how).toContainText("Export › Data flow animation (GIF)");
});
