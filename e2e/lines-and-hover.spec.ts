import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { examples } from "../src/examples";
import { impactEnds } from "../src/model";
import { openExample } from "./examples";
import { settled } from "./layout";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, "Online Store Checkout");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
  // The fit after an example opens pans the canvas; a pointer parked on an element would slide off it.
  await settled(page);
}

const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ hasText: name });
const edgePaths = (page: Page) => page.locator(".react-flow__edge-path");
/** The edge between two named elements (either direction), found by its accessible name. */
const edgeBetween = (page: Page, a: string, b: string) => page.locator(`.react-flow__edge[aria-label*="${a}"][aria-label*="${b}"]`).first();

async function chooseLines(page: Page, label: "Curved" | "Right angles") {
  await page.getByRole("button", { name: "View", exact: true }).click();
  const group = page.getByRole("group", { name: "Line style" });
  await group.getByRole("button", { name: label, exact: true }).click();
  await expect(group.getByRole("button", { name: label, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
}

const isCurved = (d: string) => /\sC/.test(d) && !/\sL/.test(d);
const isStepped = (d: string) => !/\sC/.test(d) && /\sL|\sQ/.test(d);

test.describe("line style (M46)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the View menu is desktop-only");

  test("View › Line style switches every relationship between curves and right angles, and the choice sticks", async ({ page }) => {
    await openCheckout(page);
    await expect(edgePaths(page)).toHaveCount(13);
    for (const d of await edgePaths(page).evaluateAll((ps) => ps.map((p) => p.getAttribute("d") ?? ""))) expect(isCurved(d), d).toBe(true);

    await chooseLines(page, "Right angles");
    await expect.poll(async () => (await edgePaths(page).evaluateAll((ps) => ps.map((p) => p.getAttribute("d") ?? ""))).every(isStepped)).toBe(true);
    // Labels stay on their lines: each label sits within a few pixels of some point of its path.
    const off = await page.evaluate(() => {
      const out: number[] = [];
      for (const edge of document.querySelectorAll<SVGGElement>(".react-flow__edge")) {
        const path = edge.querySelector<SVGPathElement>(".react-flow__edge-path");
        const label = edge.querySelector<HTMLElement>(".react-flow__edge-textwrapper, .react-flow__edge-text");
        if (!path || !label) continue;
        const lb = label.getBoundingClientRect();
        const cx = lb.x + lb.width / 2, cy = lb.y + lb.height / 2;
        const len = path.getTotalLength();
        const ctm = path.getScreenCTM()!;
        let best = Infinity;
        for (let i = 0; i <= 200; i++) {
          const p = path.getPointAtLength((len * i) / 200).matrixTransform(ctm);
          best = Math.min(best, Math.hypot(p.x - cx, p.y - cy));
        }
        out.push(best);
      }
      return out;
    });
    expect(off.length).toBe(13);
    for (const d of off) expect(d).toBeLessThan(12);

    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
    await expect.poll(async () => (await edgePaths(page).evaluateAll((ps) => ps.map((p) => p.getAttribute("d") ?? ""))).every(isStepped)).toBe(true);
    await chooseLines(page, "Curved");
    await expect.poll(async () => (await edgePaths(page).evaluateAll((ps) => ps.map((p) => p.getAttribute("d") ?? ""))).every(isCurved)).toBe(true);
  });

  test("the line drawn while connecting follows the style", async ({ page }) => {
    await openCheckout(page);
    await chooseLines(page, "Right angles");
    const from = (await node(page, "Checkout web app").boundingBox())!;
    await node(page, "Checkout web app").hover();
    const handle = node(page, "Checkout web app").locator(".react-flow__handle.source").first();
    const hb = (await handle.boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 300, from.y + 200, { steps: 8 });
    const d = await page.locator(".react-flow__connection-path").getAttribute("d");
    expect(isStepped(d ?? ""), d ?? "").toBe(true);
    await page.mouse.up();
  });

  test("the SVG image follows the style too", async ({ page }) => {
    await openCheckout(page);
    await chooseLines(page, "Right angles");
    await page.getByRole("button", { name: "Export" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Image, dark (SVG)" }).click();
    const file = await (await download).createReadStream();
    const text = await new Promise<string>((resolve) => {
      let s = "";
      file.on("data", (c) => (s += c));
      file.on("end", () => resolve(s));
    });
    const paths = [...text.matchAll(/<path d="(M[^"]+)" fill="none"/g)].map((m) => m[1]!);
    expect(paths).toHaveLength(13);
    for (const d of paths) expect(isStepped(d), d).toBe(true);
  });
});

test.describe("hover shows direct dependencies (M46)", () => {
  test.skip(({ isMobile }) => !!isMobile, "hover needs a pointer");

  test("hovering an element runs its own relationships, the way impact travels, and nothing else", async ({ page }) => {
    await openCheckout(page);
    await node(page, "Checkout web app").hover();
    const own = edgeBetween(page, "Checkout web app", "Checkout — production");
    await expect(own).toHaveClass(/\bhover\b/);
    const other = edgeBetween(page, "Online shopping", "North America");
    await expect(other).not.toHaveClass(/\bhover\b/);
    const hosted = edgeBetween(page, "Checkout web app", "web-prod-01");
    await expect(hosted).toHaveClass(/\bhover\b/);
    // The dashes run the way impact travels (from the dependency to the dependent), as in a blast radius.
    const m = examples.find((e) => e.id === "checkout")!.create();
    const byName = (n: string) => m.nodes.find((x) => x.name === n)!.id;
    const reverseFor = (a: string, b: string) => {
      const e = m.edges.find((x) => (x.from === byName(a) && x.to === byName(b)) || (x.from === byName(b) && x.to === byName(a)))!;
      const ends = impactEnds(m, e)!;
      return ends.dependency !== e.from;
    };
    const [ownAnim, otherAnim] = await Promise.all([
      own.locator(".react-flow__edge-path").evaluate((el) => getComputedStyle(el).animationName),
      other.locator(".react-flow__edge-path").evaluate((el) => getComputedStyle(el).animationName),
    ]);
    expect(ownAnim).toMatch(/flow/);
    expect(otherAnim).toBe("none");
    const forward = await own.evaluate((el) => el.classList.contains("hover-reverse"));
    const hostedReverse = await hosted.evaluate((el) => el.classList.contains("hover-reverse"));
    expect(forward).toBe(reverseFor("Checkout web app", "Checkout — production"));
    expect(hostedReverse).toBe(reverseFor("Checkout web app", "web-prod-01"));

    await page.mouse.move(5, 5);
    await expect(own).not.toHaveClass(/\bhover\b/);
  });

  test("with reduced motion the lines are highlighted but nothing moves; a blast radius takes over", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openCheckout(page);
    await node(page, "Checkout web app").hover();
    const own = edgeBetween(page, "Checkout web app", "Checkout — production");
    await expect(own).toHaveClass(/\bhover\b/);
    expect(await own.locator(".react-flow__edge-path").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");

    await node(page, "Checkout web app").click({ button: "right" });
    await page.getByRole("menu", { name: "Checkout web app menu" }).getByRole("menuitem", { name: "Show blast radius" }).click();
    await settled(page);
    await node(page, "Checkout web app").hover();
    await expect(own).not.toHaveClass(/\bhover\b/);
  });

  test("a tap on a touch screen does not start the animation, and drawing a relationship stops it", async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (q === "(hover: hover)" ? ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} } as unknown as MediaQueryList) : mm(q));
    });
    await page.goto(`${baseURL}/editor`);
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    await openExample(page, "Online Store Checkout");
    await node(page, "Checkout web app").tap();
    await page.waitForTimeout(400);
    await expect(edgeBetween(page, "Checkout web app", "Checkout — production")).not.toHaveClass(/\bhover\b/);
    await ctx.close();
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`right angles and a hovered element have no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openCheckout(page);
      await chooseLines(page, "Right angles");
      await node(page, "Checkout web app").hover();
      await expect(edgeBetween(page, "Checkout web app", "Checkout — production")).toHaveClass(/\bhover\b/);
      expect((await new AxeBuilder({ page }).withTags(tags).analyze()).violations).toEqual([]);
    });
  }
});
