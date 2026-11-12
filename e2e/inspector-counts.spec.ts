import { expect, test, type Page } from "@playwright/test";

// The Inspector's model summary says one element and one relationship in the singular.
const inspector = (page: Page) => page.getByRole("complementary", { name: "Inspector" });
const model = (nodes: { id: string; class: string; name: string }[], edges: { id: string; from: string; to: string; type: string }[]) => ({
  schema: 1,
  id: `e2e-counts-${nodes.length}-${edges.length}`,
  name: "Counts",
  created: "2026-11-12T00:00:00.000Z",
  updated: "2026-11-12T00:00:00.000Z",
  nodes,
  edges,
  layout: Object.fromEntries(nodes.map((n, i) => [n.id, { x: i * 300, y: 160 }])),
});

test.describe("model summary counts (desktop)", () => {
  test.skip(({ isMobile }) => !!isMobile, "the Inspector is on the desktop");

  test("one element and one relationship read in the singular, others in the plural", async ({ page }) => {
    await page.goto("/editor");
    await expect(page.getByTestId("save-status")).toHaveText("Saved in this browser");
    const one = model([{ id: "ba", class: "business_application", name: "Payroll" }, { id: "svc", class: "application_service", name: "Payroll — prod" }], [{ id: "e1", from: "ba", to: "svc", type: "Depends on::Used by" }]);
    await page.getByTestId("import-file").setInputFiles({ name: "one.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(one)) });
    await expect(inspector(page)).toContainText("2 elements · 1 relationship. Add an element");
    const single = model([{ id: "ba", class: "business_application", name: "Payroll" }], []);
    await page.getByTestId("import-file").setInputFiles({ name: "single.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(single)) });
    await expect(inspector(page)).toContainText("1 element · 0 relationships. Add an element");
  });
});
