import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { watchForeignRequests } from "./network";

const tags = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

async function openExample(page: Page, name: string) {
  await page.goto("/editor");
  await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
  await page.getByRole("combobox", { name: "Start from an example" }).selectOption({ label: name });
  // Wait until the example is stored and open, not just the placeholder model (a race made counts flaky).
  await expect(page.getByRole("combobox", { name: "Open model" }).locator("option:checked")).toHaveText(name);
  await expect(page.locator(".react-flow__node")).not.toHaveCount(0);
}

async function exportFile(page: Page, item: RegExp) {
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: item }).click()]);
  return { name: download.suggestedFilename(), text: await readFile((await download.path())!, "utf8") };
}

const positions = (page: Page) =>
  page.locator(".react-flow__node").evaluateAll((els) => els.map((e) => `${e.getAttribute("data-id")}:${(e as HTMLElement).style.transform}`).sort());

test.describe("import, export and layout (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "editing is desktop-only");

  test("export JSON, import it back as a copy, and get the same model", async ({ page }) => {
    await openExample(page, "Online store checkout");
    const file = await exportFile(page, /Model file \(JSON\)/);
    expect(file.name).toBe("online-store-checkout.json");
    const exported = JSON.parse(file.text);

    await page.getByTestId("import-file").setInputFiles({ name: file.name, mimeType: "application/json", buffer: Buffer.from(file.text) });
    await expect(page.getByRole("status")).toContainText("as a copy");
    const again = JSON.parse((await exportFile(page, /Model file \(JSON\)/)).text);
    expect(again.id).not.toBe(exported.id);
    expect({ ...again, id: undefined, updated: undefined }).toEqual({ ...exported, id: undefined, updated: undefined });
  });

  test("an invalid file is refused with a readable error and changes nothing", async ({ page }) => {
    await openExample(page, "HR self-service portal");
    const before = await page.getByRole("combobox", { name: "Open model" }).locator("option").count();
    await page.getByTestId("import-file").setInputFiles({ name: "notes.json", mimeType: "application/json", buffer: Buffer.from('{"hello":1}') });
    const alert = page.getByRole("alert").filter({ hasText: "Could not import" });
    await expect(alert).toContainText("Could not import “notes.json”");
    await expect(alert).toContainText("Nothing was changed");
    await expect(page.getByRole("combobox", { name: "Open model" }).locator("option")).toHaveCount(before);
    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(alert).toHaveCount(0);
  });

  for (const theme of ["dark", "light"] as const) {
    test(`exports a standalone SVG (${theme})`, async ({ page }) => {
      await openExample(page, "Shared database platform");
      const file = await exportFile(page, new RegExp(`Image, ${theme}`));
      expect(file.name).toBe(`shared-database-platform-${theme}.svg`);
      expect(file.text).toContain("<svg");
      expect(file.text).toContain("PostgreSQL cluster");
      expect(file.text).not.toMatch(/<script|href=/);
    });
  }

  test("exports an ArchiMate exchange file that parses and matches the model", async ({ page }) => {
    await openExample(page, "Online store checkout");
    const file = await exportFile(page, /ArchiMate model \(XML\)/);
    expect(file.name).toBe("online-store-checkout-archimate.xml");
    await expect(page.getByRole("status")).toContainText("Open Exchange XML Model");
    const counts = await page.evaluate((xml) => {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const ns = "http://www.opengroup.org/xsd/archimate/3.0/";
      return {
        error: doc.getElementsByTagName("parsererror").length,
        root: doc.documentElement.namespaceURI,
        elements: doc.getElementsByTagNameNS(ns, "element").length,
        relationships: doc.getElementsByTagNameNS(ns, "relationship").length,
        nodes: doc.getElementsByTagNameNS(ns, "node").length,
      };
    }, file.text);
    const nodes = await page.locator(".react-flow__node").count();
    const edges = await page.locator(".react-flow__edge").count();
    expect(counts).toEqual({ error: 0, root: "http://www.opengroup.org/xsd/archimate/3.0/", elements: nodes, relationships: edges, nodes });
  });

  test("exports a draw.io file that parses, matches the model and states the Lucid Free fit", async ({ page }) => {
    await openExample(page, "Online store checkout");
    const nodes = await page.locator(".react-flow__node").count();
    const edges = await page.locator(".react-flow__edge").count();
    await page.getByRole("button", { name: "Export" }).click();
    await expect(page.getByTestId("export-note-drawio")).toHaveText(`${nodes + edges} Lucid objects · within Free's 60`);
    await page.getByRole("button", { name: "Export" }).click();
    const file = await exportFile(page, /draw\.io \/ Lucidchart/);
    expect(file.name).toBe("online-store-checkout.drawio");
    await expect(page.getByRole("status")).toContainText("Import › draw.io");
    await expect(page.getByRole("status")).toContainText("needs a paid Lucid plan");
    const counts = await page.evaluate((xml) => {
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const cells = [...doc.getElementsByTagName("mxCell")];
      return {
        error: doc.getElementsByTagName("parsererror").length,
        root: doc.documentElement.tagName,
        vertices: cells.filter((c) => c.getAttribute("vertex") === "1").length,
        edges: cells.filter((c) => c.getAttribute("edge") === "1").length,
      };
    }, file.text);
    expect(counts).toEqual({ error: 0, root: "mxfile", vertices: nodes, edges });
  });

  test("the export menu works from the keyboard and closes on Escape", async ({ page }) => {
    await openExample(page, "Online store checkout");
    const button = page.getByRole("button", { name: "Export" });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /Model file \(JSON\)/ })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toBeFocused();
  });

  test("auto-layout runs in a worker, stays same-origin, and undo restores positions", async ({ page, baseURL }) => {
    const foreign = watchForeignRequests(page, baseURL);
    const workers: string[] = [];
    page.on("worker", (w) => workers.push(w.url()));

    await openExample(page, "Shared database platform");
    const before = await positions(page);
    await page.getByRole("button", { name: "Auto-layout" }).click();
    await expect(page.getByRole("status")).toContainText("Laid out by CSDM layer");
    expect(workers.length).toBe(1);
    const after = await positions(page);
    expect(after).not.toEqual(before);

    await page.getByRole("button", { name: "Undo" }).click();
    await expect.poll(() => positions(page)).toEqual(before);
    expect(foreign).toEqual([]);
  });

  for (const scheme of ["dark", "light"] as const) {
    test(`toolbar with the export menu open has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await openExample(page, "Online store checkout");
      await page.getByRole("button", { name: "Export" }).click();
      const results = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test("mobile can still export the model", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile only");
  await page.goto("/editor");
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Import…" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Auto-layout" })).toHaveCount(0);
});
