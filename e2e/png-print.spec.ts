import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { openExample } from "./examples";
import { watchForeignRequests } from "./network";

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await openExample(page, "Online Store Checkout");
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
}

async function exportFile(page: Page, item: RegExp) {
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: item }).click()]);
  return { name: download.suggestedFilename(), bytes: await readFile((await download.path())!) };
}

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (b: Buffer) => ({ width: b.readUInt32BE(16), height: b.readUInt32BE(20) });

test.describe("PNG export and print (M51, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  for (const theme of ["dark", "light"] as const) {
    test(`exports a ${theme} PNG at twice the SVG's size, made in the browser`, async ({ page, baseURL }) => {
      await openCheckout(page);
      const foreign = watchForeignRequests(page, baseURL);
      const svg = await exportFile(page, new RegExp(`Image, ${theme} \\(SVG\\)`));
      const m = /<svg[^>]* width="([\d.]+)" height="([\d.]+)"/.exec(svg.bytes.toString("utf8"))!;
      const png = await exportFile(page, new RegExp(`Image, ${theme} \\(PNG\\)`));
      expect(png.name).toBe(`online-store-checkout-${theme}.png`);
      expect(png.bytes.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      expect(pngSize(png.bytes)).toEqual({ width: Math.round(Number(m[1]) * 2), height: Math.round(Number(m[2]) * 2) });
      expect(png.bytes.length).toBeGreaterThan(20_000); // A drawn picture, not a blank canvas.
      await expect(page.getByRole("status")).toContainText(`Exported online-store-checkout-${theme}.png (${pngSize(png.bytes).width} × ${pngSize(png.bytes).height} px).`);
      expect(foreign).toEqual([]);
    });
  }

  test("Print… puts the light image in a print-only sheet, prints, and tidies up", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
    await openCheckout(page);
    const title = await page.title();
    await page.getByRole("button", { name: "Export" }).click();
    await page.getByRole("button", { name: /^Print…/ }).click();
    const sheet = page.locator("#bm-print");
    await expect(sheet).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);
    await expect(sheet).toBeHidden(); // On screen the sheet never shows.
    await expect(page).toHaveTitle("online-store-checkout");
    await page.emulateMedia({ media: "print" });
    await expect(sheet.locator("svg")).toBeVisible();
    await expect(page.getByRole("button", { name: "Export" })).toBeHidden();
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveTitle(title);
  });
});
