import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { currentModel } from "./model-menu";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];
const projection = (page: Page) => page.getByRole("group", { name: "Projection" });
const choose = (page: Page, name: "Plan" | "Iso" | "Exploded") => projection(page).getByRole("button", { name, exact: true }).click();
const isoView = (page: Page) => page.getByTestId("iso-view");
const picture = (page: Page) => page.getByTestId("iso-picture");
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const mod = process.platform === "darwin" ? "Meta" : "Control";

async function open(page: Page) {
  await page.goto("/editor?example=checkout");
  await expect(currentModel(page)).toHaveText("Online Store Checkout");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
}

async function exportFile(page: Page, item: RegExp) {
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: item }).click()]);
  return { name: download.suggestedFilename(), text: await readFile((await download.path())!, "utf8") };
}

test.describe("isometric view (M59)", () => {
  test("Plan, Iso and Exploded switch the canvas; the isometric picture is read only and the plan beneath is out of reach", async ({ page }) => {
    await open(page);
    await expect(projection(page).getByRole("button", { name: "Plan" })).toHaveAttribute("aria-pressed", "true");
    await expect(isoView(page)).toHaveCount(0);

    await choose(page, "Iso");
    await expect(projection(page).getByRole("button", { name: "Iso" })).toHaveAttribute("aria-pressed", "true");
    await expect(isoView(page)).toHaveAttribute("data-iso-mode", "iso");
    await expect(page.getByRole("status")).toContainText("Isometric view, read only");
    // One block and one label per element, one line per relationship.
    await expect(picture(page).locator("[data-iso-el]")).toHaveCount(14);
    await expect(picture(page).locator("[data-iso-rel]")).toHaveCount(13);
    await expect(picture(page).locator("[data-iso-layer]")).toHaveCount(5);
    // The plan canvas stays underneath, inert: nothing in it can take focus.
    expect(await page.locator(".react-flow").evaluate((el) => !!el.closest("[inert]"))).toBe(true);

    await choose(page, "Exploded");
    await expect(isoView(page)).toHaveAttribute("data-iso-mode", "exploded");
    await choose(page, "Plan");
    await expect(isoView(page)).toHaveCount(0);
    expect(await page.locator(".react-flow").evaluate((el) => !!el.closest("[inert]"))).toBe(false);
  });

  test("a click on a block selects its element; the keyboard pans and zooms; the Zoom menu drives the picture", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "desktop pointer and keyboard");
    await open(page);
    await choose(page, "Iso");
    await picture(page).locator('[data-iso-label]').filter({ hasText: "db-prod-01" }).locator("rect").click({ force: true });
    // The label sits over its block; a click on the block itself selects it.
    const block = picture(page).locator("[data-iso-el]").filter({ has: page.locator("polygon") });
    await block.first().click({ force: true });
    await expect(inspector(page).getByLabel("Name", { exact: true })).toBeVisible();
    await expect(picture(page).locator("[data-selected]")).toHaveCount(1);

    const transform = () => picture(page).evaluate((el) => (el as HTMLElement).style.transform);
    await isoView(page).focus();
    const before = await transform();
    await page.keyboard.press("ArrowLeft");
    await expect.poll(transform).not.toBe(before);
    const fitted = await page.getByTestId("zoom-menu").getAttribute("aria-label");
    await page.keyboard.press("+");
    await expect(page.getByTestId("zoom-menu")).not.toHaveAccessibleName(fitted!);
    await page.getByTestId("zoom-menu").click();
    await page.getByRole("button", { name: "100%" }).click();
    await expect(page.getByTestId("zoom-menu")).toHaveAccessibleName("Zoom, 100%");
  });

  test("read only: Delete, Backspace and Shift+A change nothing; Go to selects an element in the picture", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "keyboard");
    await open(page);
    await choose(page, "Iso");
    // Select through the palette's Go to (the keyboard route to an element), then try to edit it.
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("db-prod-01");
    await page.keyboard.press("Enter");
    await expect(picture(page).locator("[data-selected]")).toHaveCount(1);
    await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue("db-prod-01");
    await isoView(page).focus();
    for (const key of ["Delete", "Backspace", "Shift+A", "Shift+F10"]) await page.keyboard.press(key);
    await expect(picture(page).locator("[data-iso-el]")).toHaveCount(14);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await choose(page, "Plan");
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
  });

  test("the command palette switches projections", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "keyboard");
    await open(page);
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Exploded view");
    await page.keyboard.press("Enter");
    await expect(isoView(page)).toHaveAttribute("data-iso-mode", "exploded");
    await page.keyboard.press(`${mod}+k`);
    await page.getByRole("combobox", { name: "Search commands" }).fill("Plan view");
    await page.keyboard.press("Enter");
    await expect(isoView(page)).toHaveCount(0);
  });

  test("image exports follow the projection, and the view's legend comes along", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "export menu");
    await open(page);
    await choose(page, "Exploded");
    const dark = await exportFile(page, /Image, dark \(SVG\)/);
    expect(dark.name).toBe("online-store-checkout-exploded-dark.svg");
    expect(dark.text).toContain('data-iso="exploded"');
    expect(dark.text.match(/data-iso-el=/g)).toHaveLength(14);
    expect(dark.text).not.toMatch(/data-iso-packet|<script|var\(--/);
    await choose(page, "Plan");
    const plan = await exportFile(page, /Image, light \(SVG\)/);
    expect(plan.name).toBe("online-store-checkout-light.svg");
    expect(plan.text).not.toContain("data-iso");
  });

  test("Present steps lift each layer in turn", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "present is desktop-only");
    await open(page);
    await choose(page, "Iso");
    await page.getByRole("button", { name: "Present" }).click();
    await expect(picture(page).locator("[data-lifted]")).toHaveCount(0); // the overview
    await page.keyboard.press("ArrowRight");
    await expect(picture(page).locator("[data-lifted]")).toHaveAttribute("data-iso-layer", "business");
    await page.keyboard.press("ArrowRight");
    await expect(picture(page).locator("[data-lifted]")).toHaveAttribute("data-iso-layer", "design");
    await page.keyboard.press("Escape");
    await expect(picture(page).locator("[data-lifted]")).toHaveCount(0);
  });

  test("a blast radius is marked on the blocks, with packets on the relationships it travels", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "blast radius is desktop-only");
    await open(page);
    await page.locator(".react-flow__node").filter({ has: page.getByText("db-prod-01", { exact: true }) }).click();
    await inspector(page).getByRole("button", { name: "Show blast radius" }).click();
    await choose(page, "Iso");
    await expect(picture(page).locator('[data-blast="start"]')).toHaveCount(1);
    await page.getByRole("button", { name: /^Next/ }).click();
    await expect(picture(page).locator('[data-blast="reached"]').first()).toBeAttached();
    await expect(picture(page).locator("[data-iso-packet]").first()).toBeAttached();
  });

  test("moves only by transform and stroke, settles, and with reduced motion holds still", async ({ page }) => {
    await open(page);
    await choose(page, "Iso");
    await expect(isoView(page)).toHaveClass(/iso-entering/);
    await expect(isoView(page)).not.toHaveClass(/iso-entering/, { timeout: 3000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await choose(page, "Exploded");
    // The app's reduced-motion rule turns every change into a 0.01 ms transition: count only real motion.
    const running = await page.evaluate(
      () =>
        document.getAnimations().filter((a) => {
          const fx = a.effect as KeyframeEffect;
          const ms = Number(fx.getComputedTiming().duration);
          return a.playState === "running" && ms > 1 && fx.target instanceof Element && fx.target.closest("[data-testid=iso-view]");
        }).length,
    );
    expect(running).toBe(0);
  });

  test("follows the theme", async ({ page }) => {
    await open(page);
    await choose(page, "Iso");
    const bg = () => picture(page).locator("svg > rect").first().getAttribute("fill");
    await page.evaluate(() => (document.documentElement.dataset.theme = "light"));
    await expect.poll(bg).toBe("#f6f7f9");
    await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
    await expect.poll(bg).toBe("#121e2b");
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`passes WCAG 2.2 AA in Iso and Exploded (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
      await open(page);
      for (const p of ["Iso", "Exploded"] as const) {
        await choose(page, p);
        expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations, p).toEqual([]);
      }
    });
  }
});
