import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { openExample as chooseExample } from "./examples";
import { currentModel, modelButton } from "./model-menu";

// M87: an ArchiMate exchange file opened as a new model, from our own export or from another tool.
const saved = (page: Page) => expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");

async function exportFile(page: Page, item: RegExp) {
  await page.getByRole("button", { name: "Export" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: item }).click()]);
  return { name: download.suggestedFilename(), text: await readFile((await download.path())!, "utf8") };
}
const importXml = (page: Page, name: string, text: string) => page.getByTestId("import-file").setInputFiles({ name, mimeType: "application/xml", buffer: Buffer.from(text) });

/** A file as another ArchiMate tool might write it: no CSDM properties, a nested box, an actor and a junction. */
const ARCHI = `<?xml version="1.0" encoding="UTF-8"?>
<model xmlns="http://www.opengroup.org/xsd/archimate/3.0/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" identifier="id-m">
  <name xml:lang="fr">Commandes</name>
  <name xml:lang="en">Order Handling</name>
  <documentation xml:lang="en">How orders are taken.</documentation>
  <elements>
    <element identifier="id-app" xsi:type="ApplicationComponent"><name xml:lang="en">Order app</name><documentation xml:lang="en">Takes orders.</documentation></element>
    <element identifier="id-proc" xsi:type="BusinessProcess"><name xml:lang="en">Take orders</name></element>
    <element identifier="id-dev" xsi:type="Device"><name xml:lang="en">Rack server</name></element>
    <element identifier="id-who" xsi:type="BusinessActor"><name xml:lang="en">Customer</name></element>
    <element identifier="id-j" xsi:type="OrJunction" />
  </elements>
  <relationships>
    <relationship identifier="id-r1" source="id-app" target="id-proc" xsi:type="Serving" />
    <relationship identifier="id-r2" source="id-who" target="id-proc" xsi:type="Serving" />
    <relationship identifier="id-r3" source="id-proc" target="id-j" xsi:type="Flow" />
  </relationships>
  <views>
    <diagrams>
      <view identifier="id-v" xsi:type="Diagram">
        <name xml:lang="en">Main</name>
        <node identifier="id-n1" xsi:type="Container" x="10" y="10" w="400" h="200">
          <node identifier="id-n2" elementRef="id-app" xsi:type="Element" x="30" y="40" w="120" h="55" />
        </node>
        <node identifier="id-n3" elementRef="id-proc" xsi:type="Element" x="200" y="40" w="120" h="55" />
      </view>
    </diagrams>
  </views>
</model>`;

test.describe("ArchiMate exchange import (M87, desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "Import is on the desktop toolbar");

  test("our own ArchiMate export opens back as the same model, as a new one", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    await chooseExample(page, "Online Store Checkout");
    await expect(currentModel(page)).toHaveText("Online Store Checkout");
    await saved(page);
    const original = JSON.parse((await exportFile(page, /Model file \(JSON\)/)).text);
    const xml = await exportFile(page, /ArchiMate model \(XML\)/);
    const before = Number(await modelButton(page).getAttribute("data-count"));

    await importXml(page, xml.name, xml.text);
    await expect(page.getByRole("status").filter({ hasText: "Imported “Online Store Checkout” from an ArchiMate file: 14 elements, 13 relationships." })).toHaveCount(1);
    await expect(modelButton(page)).toHaveAttribute("data-count", String(before + 1));
    await saved(page);

    const again = JSON.parse((await exportFile(page, /Model file \(JSON\)/)).text);
    expect(again.id).not.toBe(original.id);
    const byName = (m: { nodes: { id: string; name: string; class: string }[] }) => new Map(m.nodes.map((n) => [n.id, n.name]));
    const was = byName(original);
    const now = byName(again);
    expect(again.nodes.map((n: { class: string; name: string }) => [n.class, n.name]).sort()).toEqual(original.nodes.map((n: { class: string; name: string }) => [n.class, n.name]).sort());
    const edges = (m: { edges: { from: string; to: string; type: string }[] }, names: Map<string, string>) => m.edges.map((e) => `${names.get(e.from)} ${e.type} ${names.get(e.to)}`).sort();
    expect(edges(again, now)).toEqual(edges(original, was));
  });

  test("another tool's file: classes guessed, what doesn't map listed, the picture kept", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    await importXml(page, "orders.xml", ARCHI);
    const status = page.getByRole("status").filter({ hasText: "Imported “Order Handling” from an ArchiMate file" });
    await expect(status).toContainText("3 elements, 1 relationship.");
    await expect(status).toContainText("Guessed the CSDM class of 3 elements from their ArchiMate type: Application Component as Business Application (1), Business Process as Business Process (1), Device as Host (1).");
    await expect(status).toContainText("Not imported: 2 elements with no CSDM class here: Business Actor “Customer”, Or Junction.");
    await expect(status).toContainText("Not imported: 2 relationships: Serving “Customer” → “Take orders” (an end not imported), Flow “Take orders” → Or Junction (an end not imported).");
    await expect(status).toContainText("1 element not on the diagram “Main” is placed below it.");
    await expect(currentModel(page)).toHaveText("Order Handling");
    await expect(page.locator(".react-flow__node-csdm")).toHaveCount(3);
    await expect(page.locator(".react-flow__edge")).toHaveCount(1);

    // The nested box keeps its place left of the process; the device sits below both.
    const box = async (name: string) => (await page.locator(".react-flow__node-csdm").filter({ has: page.getByText(name, { exact: true }) }).boundingBox())!;
    const [app, proc, dev] = [await box("Order app"), await box("Take orders"), await box("Rack server")];
    expect(app.x).toBeLessThan(proc.x);
    expect(app.x + app.width).toBeLessThanOrEqual(proc.x);
    expect(dev.y).toBeGreaterThan(Math.max(app.y + app.height, proc.y + proc.height));
  });

  test("a file that isn't an exchange file, or declares a document type, is refused and changes nothing", async ({ page }) => {
    await page.goto("/editor");
    await saved(page);
    const before = Number(await modelButton(page).getAttribute("data-count"));
    for (const [name, text, why] of [
      ["page.xml", "<html><body>Hi</body></html>", "It is not an ArchiMate exchange file"],
      ["broken.xml", "<model><elements>", "It is not an ArchiMate exchange file"],
      ["entities.xml", `<?xml version="1.0"?><!DOCTYPE model [<!ENTITY a "aaaa">]><model>&a;</model>`, "It declares a document type"],
      ["people.xml", ARCHI.replace(/<element identifier="id-(app|proc|dev)"[^]*?<\/element>/g, ""), "None of its 2 elements has a CSDM class here"],
    ] as const) {
      await importXml(page, name, text);
      const alert = page.getByRole("alert").filter({ hasText: "Could not import" });
      await expect(alert).toContainText(`Could not import “${name}”. ${why}`);
      await expect(alert).toContainText("Nothing was changed");
      await page.getByRole("button", { name: "Dismiss" }).click();
    }
    await expect(modelButton(page)).toHaveAttribute("data-count", String(before));
  });
});
