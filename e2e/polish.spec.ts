import { expect, test, type Page } from "@playwright/test";
import { contrastOf } from "./contrast";
import { exampleNames, openExample } from "./examples";
import { autoLayout, settled } from "./layout";
import { currentModel } from "./model-menu";

const openCheckout = async (page: Page) => {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, "Online Store Checkout");
  await expect(page.locator(".react-flow__node").first()).toBeVisible();
};

/**
 * The title's box and the top-left of everything drawn for the diagram (nodes and layer boxes with
 * their tabs), read in one go so a fit landing between two reads cannot skew the comparison.
 */
const titleAndCorner = (page: Page) =>
  page.evaluate(() => {
    const t = document.querySelector("[data-testid=canvas-title]")!.getBoundingClientRect();
    const rects = [...document.querySelectorAll(".react-flow__node, [data-testid=layer-box], [data-testid=layer-handle]")].map((e) => e.getBoundingClientRect());
    return { t: { x: t.left, y: t.top, width: t.width, height: t.height }, c: { top: Math.min(...rects.map((r) => r.top)), left: Math.min(...rects.map((r) => r.left)) } };
  });

test.describe("canvas title (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("sits at the top-left of the diagram, follows the highest element and the model name", async ({ page }) => {
    await openCheckout(page);
    const title = page.getByRole("heading", { level: 1, name: "Online Store Checkout" });
    await expect(title).toBeVisible();

    const check = async () => {
      const { t, c } = await titleAndCorner(page);
      const canvas = (await page.locator(".react-flow").boundingBox())!;
      expect(t.y + t.height, "above the highest element or tab").toBeLessThanOrEqual(c.top);
      expect(Math.abs(t.x - c.left), "left-aligned with the diagram").toBeLessThanOrEqual(2);
      return { t, canvas };
    };
    const { t: before, canvas } = await check();
    expect(before.y, "not cut off after the fit").toBeGreaterThanOrEqual(canvas.y);

    // Drag the highest element up: the title moves up with it.
    const node = page.locator(".react-flow__node").filter({ hasText: "Order management" });
    const box = (await node.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 4 });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 80, { steps: 4 });
    await page.mouse.up();
    const { t: after } = await check();
    expect(after.y).toBeLessThan(before.y - 40);

    // Renaming the model renames the title.
    await page.getByRole("region", { name: "Model canvas" }).click({ position: { x: 20, y: 20 } });
    const name = page.getByLabel("Model name");
    await name.fill("Checkout platform");
    await name.press("Enter");
    await expect(page.getByTestId("canvas-title")).toHaveText("Checkout platform");
  });

  test("keeps a readable size when zoomed out", async ({ page }) => {
    await openCheckout(page);
    const zoomOut = page.getByRole("button", { name: "Zoom Out" });
    while (await zoomOut.isEnabled()) await zoomOut.click();
    const size = await page.getByTestId("canvas-title").evaluate((e) => e.getBoundingClientRect().height);
    expect(size).toBeGreaterThanOrEqual(18);
  });
});

test.describe("edge labels (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("never sit on a layer name, in every example, fitted or zoomed in, and while presenting", async ({ page }) => {
    const overlaps = () =>
      page.evaluate(() => {
        const rects = (sel: string) => [...document.querySelectorAll(sel)].map((e) => [e.textContent, e.getBoundingClientRect()] as const);
        const tabs = rects("[data-testid=layer-handle], [data-testid=layer-box-label] span");
        return rects(".react-flow__edge-text").flatMap(([label, a]) =>
          tabs.filter(([, t]) => a.left < t.right && t.left < a.right && a.top < t.bottom && t.top < a.bottom).map(([tab]) => `${label} × ${tab}`),
        );
      });
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    for (const [i, name] of (await exampleNames(page)).entries()) {
      await openExample(page, name);
      await expect(page.locator(".react-flow__edge-text").first()).toBeVisible();
      await expect.poll(overlaps, { message: `example ${i}` }).toEqual([]);
      // Let the example's fit land before zooming: a Zoom In during the fit's animation stops it
      // part way, far out, where the constant-size tabs cover whole short edges.
      await settled(page);
      await page.getByRole("button", { name: "Zoom In" }).click();
      await expect.poll(overlaps, { message: `example ${i}, zoomed in` }).toEqual([]);
      // Zoomed far out, a tab (constant on-screen size) can cover a whole short edge; labels are
      // unreadably small there anyway, so the check covers the fitted view and closer.
      await page.getByRole("button", { name: "Zoom Out" }).click();
    }
    await page.getByRole("button", { name: "Present" }).click();
    await expect(page.getByTestId("present-step")).toBeVisible();
    await expect.poll(overlaps, { message: "presenting" }).toEqual([]);
  });
});

test.describe("stacked layers (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("leave room for each layer's name: its tab clears the box above, in every example and after auto-layout", async ({ page }) => {
    const clashes = () =>
      page.evaluate(() => {
        const boxes = [...document.querySelectorAll("[data-testid=layer-box]")].map((e) => e.getBoundingClientRect());
        return [...document.querySelectorAll("[data-testid=layer-handle]")].flatMap((tab, i) => {
          const t = tab.getBoundingClientRect();
          return boxes.filter((b, j) => j !== i && t.left < b.right && b.left < t.right && t.top < b.bottom - 1 && b.top < t.bottom).map(() => tab.textContent);
        });
      });
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    for (const [i, name] of (await exampleNames(page)).entries()) {
      await openExample(page, name);
      await expect(page.getByTestId("layer-handle").first()).toBeVisible();
      await expect.poll(clashes, { message: `example ${i}` }).toEqual([]);
    }
    // Auto-layout the application models (the metamodel poster is laid out by hand: auto-laid out,
    // its 61 relationships make it wide enough that a fit zooms below where tabs can clear).
    for (const label of ["Online Store Checkout", "Storefront on Kubernetes", "Enterprise AI Assistant"]) {
      await openExample(page, label);
      // Wait until the example is open (else Auto-layout lays out the previous model), then for the
      // layout itself: the button reads "Laying out…" while ELK runs, which can outlast 5 s under load.
      await expect(currentModel(page)).toHaveText(label);
      await autoLayout(page);
      await page.getByRole("button", { name: "Fit View" }).click();
      await expect.poll(clashes, { message: `${label} after auto-layout` }).toEqual([]);
    }
  });
});

test.describe("editor status bar", () => {
  for (const scheme of ["dark", "light"] as const) {
    test(`carries the site footer's links, and the page does not scroll (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/editor");
      await expect(page.getByRole("contentinfo")).toHaveCount(0);
      const site = page.getByRole("navigation", { name: "Site" });
      for (const name of ["Mike Reams", "MIT · GitHub", "About", "Privacy"]) {
        const link = site.getByRole("link", { name, exact: true });
        await expect(link).toBeVisible();
        expect(await contrastOf(link), `${name} (${scheme})`).toBeGreaterThanOrEqual(4.5);
      }
      expect(await contrastOf(page.getByText("Not affiliated with ServiceNow.")), scheme).toBeGreaterThanOrEqual(4.5);
      const overflow = await page.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight);
      expect(overflow).toBeLessThanOrEqual(0);
      await site.getByRole("link", { name: "About", exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: "About Blueprint Modeler" })).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();
    });
  }
});

test.describe("landing page", () => {
  test("hero figure is described, and each layer card names its CMDB table", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("img", { name: "Figure 1: the realization chain" })).toBeVisible();
    const cards = page.locator(".layer-card");
    await expect(cards).toHaveCount(4);
    for (const table of ["cmdb_ci_business_capability", "cmdb_ci_business_app", "cmdb_ci_service_discovered", "cmdb_ci_appl"]) {
      await expect(page.getByText(table, { exact: true })).toHaveCount(1);
    }
  });

  test("a card types its table name in on hover", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "hover effect; touch screens show the table name without it");
    await page.goto("/");
    const table = page.locator(".layer-card-table").first();
    expect(await table.evaluate((e) => e.getBoundingClientRect().width)).toBe(0);
    await page.locator(".layer-card").first().hover();
    await expect.poll(() => table.evaluate((e) => e.scrollWidth - e.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
  });

  test("with reduced motion the hero signal is off and card names show at once", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "hover effect");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".hero-signal")).toBeHidden();
    await page.locator(".layer-card").nth(2).hover();
    const table = page.locator(".layer-card-table").nth(2);
    // "At once" is a style fact (no delay, a 0.01 ms typing animation), checked as such rather than
    // as a 500 ms deadline, which a loaded machine can miss on the hover alone.
    const timing = await table.evaluate((e) => {
      const s = getComputedStyle(e);
      return { name: s.animationName, delay: parseFloat(s.animationDelay), duration: parseFloat(s.animationDuration) };
    });
    expect(timing.name).toBe("card-type"); // the hover rule is the one measured
    expect(timing.delay).toBe(0);
    expect(timing.duration).toBeLessThan(0.001);
    await expect.poll(() => table.evaluate((e) => e.scrollWidth - e.getBoundingClientRect().width)).toBeLessThanOrEqual(1);
  });
});

test.describe("editor toolbar (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the full toolbar is desktop-only");

  for (const scheme of ["dark", "light"] as const) {
    test(`groups its buttons, makes Present the one filled button, and has no separate Hints button (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/editor");
      await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
      for (const name of ["Model", "Edit", "Arrange", "Lens"]) await expect(page.getByRole("group", { name, exact: true })).toBeVisible();
      await expect(page.getByRole("group", { name: "Edit" }).getByRole("button")).toHaveText(["Undo", "Redo"]);
      await expect(page.locator("main").getByRole("button", { name: /^Hints/ })).toHaveCount(0);
      await expect(page.getByRole("tab", { name: "Hints (0)" })).toBeVisible();
      await openExample(page, "Online Store Checkout");
      const present = page.getByRole("button", { name: "Present" });
      await expect(present).toBeEnabled();
      expect(await contrastOf(present), scheme).toBeGreaterThanOrEqual(4.5);
      // Toolbar icons are decorative: every button keeps its text label.
      expect(await page.locator("[role=group] button svg:not([aria-hidden=true])").count()).toBe(0);
    });
  }
});
