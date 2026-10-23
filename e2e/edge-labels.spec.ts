import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { exampleNames, openExample } from "./examples";
import { settled } from "./layout";

async function openEditor(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
}

async function exportSvg(page: Page) {
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Image, dark/ }).click()]);
  return readFile((await download.path())!, "utf8");
}

async function toggleLabels(page: Page) {
  await page.getByRole("button", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: /^Relationship labels/ }).click();
  await page.keyboard.press("Escape");
}

/**
 * Pairs of labels whose boxes overlap on screen (never allowed), and labels over an element whose
 * line does not run through or end at that element (a clear spot exists, so the label must take it).
 * A line ends a pixel or two short of its element (the arrowhead), so the element is widened by 2px
 * for that test; a label wider than a short line between two elements is allowed to touch them.
 */
const overlaps = (page: Page) =>
  page.evaluate(() => {
    const hit = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const labels = [...document.querySelectorAll(".react-flow__edge")].flatMap((e) => {
      const t = e.querySelector(".react-flow__edge-text");
      return t ? [{ text: t.textContent ?? "", box: t.getBoundingClientRect(), line: e.querySelector("path.react-flow__edge-path")!.getBoundingClientRect() }] : [];
    });
    const nodes = [...document.querySelectorAll(".react-flow__node")].map((n) => ({ text: (n.textContent ?? "").slice(0, 24), box: n.getBoundingClientRect() }));
    const show = (r: DOMRect) => `[${[r.left, r.top, r.right, r.bottom].map((v) => v.toFixed(1)).join(" ")}]`;
    const out: string[] = [];
    labels.forEach((a, i) => {
      labels.slice(i + 1).forEach((b) => hit(a.box, b.box) && out.push(`${a.text}${show(a.box)} line${show(a.line)} × ${b.text}${show(b.box)} line${show(b.line)}`));
      nodes.forEach((n) => {
        const near = new DOMRect(n.box.left - 2, n.box.top - 2, n.box.width + 4, n.box.height + 4);
        if (hit(a.box, n.box) && !hit(a.line, near)) out.push(`${a.text}${show(a.box)} line${show(a.line)} × element ${n.text}${show(n.box)}`);
      });
    });
    return out;
  });

test.describe("relationship labels (M50, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("show by default, hide from the View menu on the canvas and in the image, and persist", async ({ page }) => {
    await openEditor(page);
    await openExample(page, "Online Store Checkout");
    await expect(page.locator(".react-flow__edge-text").first()).toBeVisible();
    expect(await exportSvg(page)).toContain(">Uses<");

    await toggleLabels(page);
    await expect(page.locator(".react-flow__edge-text")).toHaveCount(0);
    expect(await page.locator(".react-flow__edge").count()).toBeGreaterThan(0);
    expect(await exportSvg(page)).not.toContain(">Uses<");

    await page.reload();
    await expect(page.locator(".react-flow__node")).toHaveCount(14);
    await expect(page.locator(".react-flow__edge-text")).toHaveCount(0);
    await toggleLabels(page);
    await expect(page.locator(".react-flow__edge-text").first()).toBeVisible();
  });

  test("the canvas context menu toggles them too", async ({ page }) => {
    await openEditor(page);
    await openExample(page, "Online Store Checkout");
    const pane = page.locator(".react-flow__pane");
    await pane.click({ button: "right", position: { x: 30, y: 30 } });
    const item = page.getByRole("menuitemcheckbox", { name: "Relationship labels" });
    await expect(item).toHaveAttribute("aria-checked", "true");
    await item.click();
    await expect(page.locator(".react-flow__edge-text")).toHaveCount(0);
  });

  test("never sit on another label, nor on an element their line stays clear of, in every example, fitted and zoomed in", async ({ page }) => {
    await openEditor(page);
    for (const [i, name] of (await exampleNames(page)).entries()) {
      await openExample(page, name);
      await expect(page.locator(".react-flow__edge-text").first()).toBeVisible();
      await settled(page);
      await expect.poll(() => overlaps(page), { message: `example ${i}: ${name}` }).toEqual([]);
      await page.getByRole("button", { name: "Zoom In" }).click();
      await expect.poll(() => overlaps(page), { message: `example ${i}: ${name}, zoomed in` }).toEqual([]);
      await page.getByRole("button", { name: "Zoom Out" }).click();
    }
  });
});
