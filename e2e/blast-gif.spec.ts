import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { watchForeignRequests } from "./network";

const node = (page: Page, name: string) => page.locator(".react-flow__node").filter({ has: page.getByText(name, { exact: true }) });
const gifItem = (page: Page) => page.getByRole("button", { name: /^Blast radius animation \(GIF\)/ });

async function openCheckout(page: Page) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: "Online store checkout" });
  await expect(page.locator(".react-flow__node")).toHaveCount(14);
  await page.getByRole("button", { name: "Fit View" }).click();
}

async function showFrom(page: Page, name: string) {
  await node(page, name).click({ button: "right" });
  await page.getByRole("menu", { name: `${name} menu` }).getByRole("menuitem", { name: "Show blast radius" }).click();
  await expect(page.getByRole("region", { name: "Blast radius" })).toBeVisible();
}

/** The global color table of a GIF, as 0xRRGGBB numbers. */
function globalPalette(bytes: Buffer): number[] {
  const size = 2 << (bytes[10]! & 7);
  return Array.from({ length: size }, (_, i) => (bytes[13 + i * 3]! << 16) | (bytes[14 + i * 3]! << 8) | bytes[15 + i * 3]!);
}

async function exportGif(page: Page) {
  await page.getByRole("button", { name: "Export" }).click();
  const download = page.waitForEvent("download");
  await gifItem(page).click();
  const d = await download;
  return { name: d.suggestedFilename(), bytes: await readFile((await d.path())!) };
}

test.describe("blast radius GIF export (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("is unavailable until a blast radius is open, and says how to open one", async ({ page }) => {
    await openCheckout(page);
    await page.getByRole("button", { name: "Export" }).click();
    await expect(gifItem(page)).toBeDisabled();
    await expect(gifItem(page)).toContainText("Show a blast radius first");
  });

  test("saves a looping GIF89a with one frame per hop, made in the browser", async ({ page, baseURL }) => {
    const foreign = watchForeignRequests(page, baseURL);
    await page.emulateMedia({ colorScheme: "dark" });
    await openCheckout(page);
    await showFrom(page, "db-prod-01");
    await page.getByRole("button", { name: "Export" }).click();
    await expect(gifItem(page)).toBeEnabled();
    await expect(gifItem(page)).toContainText("5 frames");
    await page.keyboard.press("Escape");

    const { name, bytes } = await exportGif(page);
    expect(name).toBe("online-store-checkout-blast-radius.gif");
    expect(bytes.subarray(0, 6).toString("ascii")).toBe("GIF89a");
    expect(bytes.length).toBeLessThan(1_500_000);
    const width = bytes.readUInt16LE(6);
    expect(width).toBeGreaterThan(200);
    expect(Math.max(width, bytes.readUInt16LE(8))).toBeLessThanOrEqual(1600);
    // Palette from the dark theme's tokens; the text summary rides in the file as a comment.
    expect(globalPalette(bytes)).toEqual(expect.arrayContaining([0x121e2b, 0xdeb163, 0xe99696]));
    expect(bytes.toString("latin1")).toContain("Blast radius: if db-prod-01 fails, 6 elements are affected within 4 hops. Hop 1: Orders database.");
    await expect(page.getByRole("status")).toContainText("Exported online-store-checkout-blast-radius.gif: 5 frames");

    // The browser's own decoder reads it: five frames, each decodable.
    const decoded = await page.evaluate(async (data) => {
      const dec = new ImageDecoder({ data: new Uint8Array(data), type: "image/gif" });
      await dec.tracks.ready;
      const count = dec.tracks.selectedTrack!.frameCount;
      const sizes: string[] = [];
      for (let i = 0; i < count; i++) {
        const { image } = await dec.decode({ frameIndex: i });
        sizes.push(`${image.displayWidth}x${image.displayHeight}`);
        image.close();
      }
      return { count, sizes, repetition: dec.tracks.selectedTrack!.repetitionCount };
    }, [...bytes]);
    expect(decoded.count).toBe(5);
    expect(new Set(decoded.sizes).size).toBe(1);
    expect(decoded.repetition).toBe(Infinity);
    expect(foreign).toEqual([]);
  });

  test("follows the theme being viewed, and the Dependencies direction", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await openCheckout(page);
    await showFrom(page, "Checkout");
    await page.getByRole("region", { name: "Blast radius" }).getByRole("button", { name: "Dependencies" }).click();
    const { bytes } = await exportGif(page);
    expect(globalPalette(bytes)).toEqual(expect.arrayContaining([0xf6f7f9, 0x6d4e17, 0x005785]));
    expect(bytes.toString("latin1")).toContain("Dependencies: Checkout needs 8 elements within 3 hops.");
    await expect(page.getByRole("status")).toContainText(": 4 frames");
  });

  test("an element nothing depends on exports one still frame", async ({ page }) => {
    await openCheckout(page);
    await showFrom(page, "Online shopping");
    const { bytes } = await exportGif(page);
    expect(bytes.subarray(0, 6).toString("ascii")).toBe("GIF89a");
    await expect(page.getByRole("status")).toContainText(": 1 frame,");
  });
});
