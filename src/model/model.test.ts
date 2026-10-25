import { describe, expect, it } from "vitest";
import { createModel, formatModelDate, localDay, migrate, modelDate, modelSchema, parseModel, serializeModel, UNTITLED_MODEL, type Model } from "./index";

const NOW = new Date("2026-09-27T12:00:00.000Z");

function sample(): Model {
  const m = createModel("Checkout", NOW, "m-1");
  m.nodes = [
    { id: "cap", class: "business_capability", name: "Order management" },
    { id: "ba", class: "business_application", name: "Checkout" },
    { id: "svc", class: "application_service", name: "Checkout — prod", attrs: { environment: "production" } },
    { id: "host", class: "host", name: "web-01" },
  ];
  m.edges = [
    { id: "e1", from: "cap", to: "ba", type: "Provided by::Provides" },
    { id: "e2", from: "ba", to: "svc", type: "Uses::Used by" },
    { id: "e3", from: "svc", to: "host", type: "Depends on::Used by" },
  ];
  m.layout = { cap: { x: 0, y: 0 }, ba: { x: 0, y: 160 }, svc: { x: 0, y: 320 }, host: { x: 0, y: 480 } };
  return m;
}

const roundTrip = (m: Model) => parseModel(JSON.parse(serializeModel(m)));

describe("parseModel", () => {
  it("round-trips a valid model exactly, with no issues", () => {
    const m = sample();
    const r = roundTrip(m);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.model).toEqual(m);
    expect(r.issues).toEqual([]);
  });

  it("keeps an optional description and Artifact ID, and still opens files without them", () => {
    const m = { ...sample(), description: "Order flow for the web store.", artifactId: "EA-0042" };
    const r = roundTrip(m);
    expect(r.ok && r.model).toMatchObject({ description: "Order flow for the web store.", artifactId: "EA-0042" });
    const plain = roundTrip(sample());
    expect(plain.ok && "description" in plain.model).toBe(false);
    expect(plain.ok && "artifactId" in plain.model).toBe(false);
    expect(parseModel({ ...JSON.parse(serializeModel(sample())), artifactId: "x".repeat(65) }).ok).toBe(false);
    expect(parseModel({ ...JSON.parse(serializeModel(sample())), description: "x".repeat(1001) }).ok).toBe(false);
  });

  it("drops details that are only spaces, and trims the rest, when a file is read", () => {
    const base = JSON.parse(serializeModel(sample()));
    const r = parseModel({ ...base, description: "   ", artifactId: "  EA-1  " });
    expect(r.ok && "description" in r.model).toBe(false);
    expect(r.ok && r.model.artifactId).toBe("EA-1");
  });

  it("gives a new model today's date, keeps a date from a file, and falls back to the creation day", () => {
    const m = createModel("A", NOW, "a");
    expect(m.date).toBe(localDay(NOW));
    // The day where the person is, not the UTC day: late evening west of Greenwich is still today.
    const evening = new Date(2026, 9, 4, 23, 30);
    expect(localDay(evening)).toBe("2026-10-04");
    expect(createModel("B", evening, "b").date).toBe("2026-10-04");
    expect(modelDate({ created: evening.toISOString() })).toBe("2026-10-04");
    expect(Object.keys(m).slice(0, 4)).toEqual(["schema", "id", "name", "date"]);
    const base = JSON.parse(serializeModel(sample()));
    delete base.date;
    const r = parseModel(base);
    expect(r.ok && "date" in r.model).toBe(false);
    expect(r.ok && modelDate(r.model)).toBe(localDay(NOW));
    const dated = parseModel({ ...base, date: "2026-10-04" });
    expect(dated.ok && modelDate(dated.model)).toBe("2026-10-04");
    expect(parseModel({ ...base, date: "yesterday" }).ok).toBe(false);
    expect(formatModelDate("2026-10-04")).toBe("Oct 4, 2026");
  });

  it("names new models in Title Case", () => {
    expect(UNTITLED_MODEL).toBe("Untitled Model");
  });

  it("serializes stably", () => {
    expect(serializeModel(sample())).toBe(serializeModel(sample()));
    expect(serializeModel(sample()).endsWith("\n")).toBe(true);
  });

  it("rejects things that are not models, with a readable message", () => {
    for (const bad of [null, [], "x", 42, {}, { schema: "1" }]) {
      const r = parseModel(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/not a Blueprint Modeler file/);
    }
  });

  it("rejects files from a newer version", () => {
    const r = parseModel({ ...sample(), schema: 99 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/newer version/);
  });

  it("rejects unknown element types, duplicate ids, dangling edges, duplicate edges and orphan layout", () => {
    const cases: [string, (m: Model) => void, RegExp][] = [
      ["unknown class", (m) => (m.nodes[0]!.class = "cmdb_ci_mystery"), /Unknown element type/],
      ["duplicate node", (m) => m.nodes.push({ ...m.nodes[0]! }), /share the id/],
      ["dangling edge", (m) => (m.edges[0]!.to = "nope"), /does not exist/],
      ["duplicate edge", (m) => m.edges.push({ ...m.edges[0]!, id: "e9" }), /appears twice/],
      ["orphan layout", (m) => (m.layout.ghost = { x: 1, y: 1 }), /Layout refers/],
      ["bad shape", (m) => ((m as unknown as { nodes: unknown }).nodes = "x"), /not a valid model at nodes/],
    ];
    for (const [label, mutate, expected] of cases) {
      const m = sample();
      mutate(m);
      const r = roundTrip(m);
      expect(r.ok, label).toBe(false);
      if (!r.ok) expect(r.error, label).toMatch(expected);
    }
  });

  it("loads rule-breaking relationships with a warning instead of refusing them", () => {
    const m = sample();
    m.edges.push({ id: "e4", from: "ba", to: "host", type: "Depends on::Used by" });
    const r = roundTrip(m);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.issues).toEqual([expect.objectContaining({ code: "disallowed-relationship", edgeId: "e4" })]);
  });

  it("flags the CSDM 4 business application → application service type as legacy", () => {
    const m = sample();
    m.edges[1]!.type = "Consumes::Consumed by";
    const r = roundTrip(m);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.issues).toEqual([expect.objectContaining({ code: "legacy-type", edgeId: "e2" })]);
  });
});

describe("files from earlier Blueprint versions", () => {
  it("still load pairs drawn the old way, flagged as legacy", () => {
    const m = sample();
    m.edges[0] = { id: "e1", from: "ba", to: "cap", type: "Provides::Provided by" };
    const r = roundTrip(m);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.issues).toEqual([expect.objectContaining({ code: "legacy-type", edgeId: "e1" })]);
  });
});

describe("migrate", () => {
  it("passes the current version through unchanged", () => {
    const m = sample();
    expect(migrate(m)).toEqual({ ok: true, value: m });
  });
});

describe("saved views in the model file (M54, still format 1)", () => {
  const withViews = (): Model => ({
    ...sample(),
    views: [
      { id: "v1", name: "Production only", filter: { environment: ["production"] }, colorBy: "lifecycle" },
      { id: "v2", name: "Business layer", filter: { layers: ["business"] }, colorBy: "layer" },
    ],
  });

  it("round-trips views exactly, written after the layout", () => {
    const m = withViews();
    const r = roundTrip(m);
    expect(r.ok && r.model).toEqual(m);
    const keys = Object.keys(JSON.parse(serializeModel(r.ok ? r.model : m)));
    expect(keys.slice(-2)).toEqual(["layout", "views"]);
  });

  it("leaves views out of the file when there are none, so older files stay byte-identical", () => {
    const m = { ...sample(), views: [] };
    const r = roundTrip(m);
    expect(r.ok && "views" in r.model).toBe(false);
    expect(serializeModel(r.ok ? r.model : m)).toBe(serializeModel(sample()));
  });

  it("opens a file without views as before", () => {
    const r = roundTrip(sample());
    expect(r.ok && r.model.views).toBeUndefined();
  });

  it("is ignored, not refused, by 1.8.0's reader: the same format with views stripped", () => {
    // 1.8.0's schema is today's without `views`; zod drops keys it does not know.
    const older = modelSchema.omit({ views: true });
    const parsed = older.safeParse(JSON.parse(serializeModel(withViews())));
    expect(parsed.success).toBe(true);
    expect(parsed.success && "views" in parsed.data).toBe(false);
  });

  it("refuses a view with an unknown coloring, an empty name, or too many views", () => {
    const bad = (views: unknown) => parseModel({ ...JSON.parse(serializeModel(sample())), views });
    expect(bad([{ id: "v", name: "x", filter: {}, colorBy: "price" }]).ok).toBe(false);
    expect(bad([{ id: "v", name: "", filter: {}, colorBy: "layer" }]).ok).toBe(false);
    expect(bad(Array.from({ length: 21 }, (_, i) => ({ id: `v${i}`, name: `V${i}`, filter: {}, colorBy: "layer" }))).ok).toBe(false);
    expect(bad([{ id: "v", name: "x", filter: {}, colorBy: "layer" }, { id: "v", name: "y", filter: {}, colorBy: "layer" }]).ok).toBe(false);
  });

  it("keeps a view's grouping (M56); one this version does not know drops the grouping, not the file", () => {
    const m: Model = { ...withViews(), views: [{ id: "v", name: "By app", filter: {}, colorBy: "layer", groupBy: "business_application" }] };
    const r = roundTrip(m);
    expect(r.ok && r.model.views?.[0]?.groupBy).toBe("business_application");
    const later = parseModel({ ...JSON.parse(serializeModel(m)), views: [{ id: "v", name: "By team", filter: {}, colorBy: "layer", groupBy: "team" }] });
    expect(later.ok).toBe(true);
    expect(later.ok && later.model.views?.[0]?.groupBy).toBeUndefined();
  });
});

describe("connection points in the file (M61)", () => {
  const withPorts = (ports: unknown) => {
    const m = JSON.parse(serializeModel(sample()));
    m.edges[0].ports = ports;
    return m;
  };

  it("round-trips chosen sides, and refuses a side that is not one", () => {
    const r = parseModel(withPorts({ from: "left", to: "top" }));
    expect(r.ok && r.model.edges[0]!.ports).toEqual({ from: "left", to: "top" });
    expect(r.ok && serializeModel(r.model)).toContain('"ports"');
    expect(parseModel(withPorts({ from: "middle" })).ok).toBe(false);
  });

  it("is ignored, not refused, by 1.10.0's reader: the same format without ports", () => {
    // 1.10.0's edge schema is today's without `ports`; zod drops keys it does not know.
    const older = modelSchema.extend({ edges: modelSchema.shape.edges.element.omit({ ports: true }).array() });
    const parsed = older.safeParse(withPorts({ from: "left" }));
    expect(parsed.success).toBe(true);
    expect(parsed.success && "ports" in parsed.data.edges[0]!).toBe(false);
  });
});

describe("links and a record number in the file (M65)", () => {
  const withLinks = (links: unknown, ref?: string) => {
    const m = JSON.parse(serializeModel(sample()));
    m.nodes[0].links = links;
    if (ref !== undefined) m.nodes[0].attrs = { ...(m.nodes[0].attrs ?? {}), ref };
    return m;
  };

  it("round-trips links and a record number", () => {
    const links = [{ title: "Runbook", url: "https://example.com/runbook" }, { title: "Status page", url: "http://status.example.com/" }];
    const r = parseModel(withLinks(links, "APM0001234"));
    expect(r.ok && r.model.nodes[0]!.links).toEqual(links);
    expect(r.ok && r.model.nodes[0]!.attrs?.ref).toBe("APM0001234");
    expect(r.ok && serializeModel(r.model)).toContain('"links"');
  });

  it("keeps a model with a bad link, dropping only that link: never a script or another scheme", () => {
    const r = parseModel(
      withLinks([
        { title: "Fine", url: "https://example.com/a" },
        { title: "Script", url: "javascript:alert(1)" },
        { title: "Data", url: "data:text/html,hi" },
        { title: "", url: "https://example.com/untitled" },
        { title: "Not a URL", url: "example dot com" },
        "nonsense",
      ]),
    );
    expect(r.ok).toBe(true);
    expect(r.ok && r.model.nodes[0]!.links).toEqual([{ title: "Fine", url: "https://example.com/a" }]);
  });

  it("keeps at most five links", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ title: `L${i}`, url: `https://example.com/${i}` }));
    const r = parseModel(withLinks(many));
    expect(r.ok && r.model.nodes[0]!.links?.map((l) => l.title)).toEqual(["L0", "L1", "L2", "L3", "L4"]);
  });

  it("is ignored, not refused, by 1.12.0's reader: the same format without links", () => {
    const older = modelSchema.extend({ nodes: modelSchema.shape.nodes.element.omit({ links: true }).array() });
    const parsed = older.safeParse(withLinks([{ title: "Runbook", url: "https://example.com/" }]));
    expect(parsed.success).toBe(true);
    expect(parsed.success && "links" in parsed.data.nodes[0]!).toBe(false);
  });
});
