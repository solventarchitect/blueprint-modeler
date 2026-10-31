import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { initialHistory, reduce } from "@/editor/state";
import { blastView } from "@/editor/blast";
import { modelSchema, MAX_FLOWS, MAX_FLOW_STEPS, type Flow } from "./schema";
import { flowRadius, flowStepText, nextSteps } from "./flows";

const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");
// Online shopping — North America → Checkout — production → Checkout web app → web-prod-01
const order: Flow = { id: "f1", name: "Customer places an order", steps: [{ edge: "e6" }, { edge: "e9" }, { edge: "e12" }] };

describe("saved flows in the model file (M70)", () => {
  it("are optional; a flow keeps its name and steps in order; a step may run against its relationship", () => {
    const json = JSON.parse(JSON.stringify(checkout()));
    json.flows = [{ ...order, steps: [...order.steps, { edge: "e13", back: true }] }];
    const parsed = modelSchema.parse(json);
    expect(parsed.flows).toEqual([{ ...order, steps: [...order.steps, { edge: "e13", back: true }] }]);
    expect(MAX_FLOWS).toBe(20);
    expect(MAX_FLOW_STEPS).toBe(50);
  });

  it("what this version can't read is dropped, not the file: a bad flow, a bad step, too many", () => {
    const json = JSON.parse(JSON.stringify(checkout()));
    json.flows = [
      { id: "f1", name: "Good", steps: [{ edge: "e6" }, { nope: 1 }, { edge: "e9", back: "yes" }], extra: true },
      { id: "", name: "No id", steps: [] },
      "not a flow",
      { id: "f1", name: "Same id", steps: [] },
      ...Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, name: `F${i}`, steps: [] })),
    ];
    const parsed = modelSchema.parse(json);
    expect(parsed.flows![0]).toEqual({ id: "f1", name: "Good", steps: [{ edge: "e6" }, { edge: "e9" }] });
    expect(parsed.flows).toHaveLength(MAX_FLOWS);
    expect(new Set(parsed.flows!.map((f) => f.id)).size).toBe(MAX_FLOWS);
    json.flows = "nope";
    expect(JSON.stringify(modelSchema.parse(json))).not.toContain('"flows"');
  });
});

describe("save-flow and delete-flow (M70)", () => {
  it("add, change and delete a flow, one undo step each; the last one gone removes the key", () => {
    const m = checkout();
    let h = reduce(initialHistory(m), { type: "save-flow", flow: { id: "f1", name: "Order", steps: [] } });
    h = reduce(h, { type: "save-flow", flow: { id: "f1", name: "Order", steps: [{ edge: "e6" }] } });
    expect(h.present.flows).toEqual([{ id: "f1", name: "Order", steps: [{ edge: "e6" }] }]);
    expect(reduce(h, { type: "save-flow", flow: { id: "f1", name: "Order", steps: [{ edge: "e6" }] } })).toBe(h);
    expect(reduce(h, { type: "save-flow", flow: { id: "f2", name: "  ", steps: [] } })).toBe(h);
    h = reduce(h, { type: "delete-flow", id: "f1" });
    expect("flows" in h.present).toBe(false);
    expect(h.past).toHaveLength(3);
  });

  it("deleting a relationship (or an element) cuts every flow where its walk breaks, in the same undo step", () => {
    const m = checkout();
    let h = reduce(initialHistory(m), { type: "save-flow", flow: order });
    h = reduce(h, { type: "delete-edge", id: "e12" });
    expect(h.present.flows![0]!.steps).toEqual([{ edge: "e6" }, { edge: "e9" }]);
    h = reduce(h, { type: "undo" });
    // A step gone from the middle: the walk can't jump on, so it stops there.
    h = reduce(h, { type: "delete-edge", id: "e9" });
    expect(h.present.flows![0]!.steps).toEqual([{ edge: "e6" }]);
    h = reduce(h, { type: "undo" });
    expect(h.present.flows![0]!.steps).toEqual(order.steps);
    const web = m.nodes.find((n) => n.name === "Checkout web app")!.id;
    h = reduce(h, { type: "delete-node", id: web });
    expect(h.present.flows![0]!.steps).toEqual([{ edge: "e6" }]);
  });

  it("a relationship turned round (Update to CSDM 5) turns its steps too, so the walk still goes the same way", () => {
    const m = checkout();
    const e12 = m.edges.find((e) => e.id === "e12")!;
    // Pretend e12 was drawn the legacy way round, then put back.
    const legacy = { ...m, edges: m.edges.map((e) => (e.id === "e12" ? { ...e, from: e12.to, to: e12.from } : e)), flows: [{ ...order, steps: [{ edge: "e6" }, { edge: "e9" }, { edge: "e12", back: true as const }] }] };
    const h = reduce(initialHistory(legacy), { type: "update-edge", id: "e12", from: e12.from, to: e12.to, edgeType: e12.type });
    expect(h.present.flows![0]!.steps).toEqual(order.steps);
  });
});

describe("playing a flow (M70)", () => {
  it("starts at the first step's source and reaches one element per step, numbered", () => {
    const m = { ...checkout(), flows: [order] };
    const id = (name: string) => m.nodes.find((n) => n.name === name)!.id;
    const r = flowRadius(m, order);
    expect(r.start).toBe(id("Online shopping — North America"));
    expect(r.steps.map((s) => s.nodeIds)).toEqual([[id("Online shopping — North America")], [id("Checkout — production")], [id("Checkout web app")], [id("web-prod-01")]]);
    expect(r.steps.map((s) => s.edgeIds)).toEqual([[], ["e6"], ["e9"], ["e12"]]);
    expect(r.reached).toBe(3);
    // The line runs the way the flow walks.
    const v = blastView(m, r, 3, "scenario");
    expect([...v.edges.values()].every((e) => e.forward)).toBe(true);
    expect(v.nodes.get(id("web-prod-01"))).toEqual({ hop: 3, current: true });
  });

  it("a step against its relationship walks from its To end; the line runs backward", () => {
    const m = checkout();
    const back: Flow = { id: "f2", name: "Back", steps: [{ edge: "e12", back: true }, { edge: "e9", back: true }] };
    const r = flowRadius(m, back);
    const id = (name: string) => m.nodes.find((n) => n.name === name)!.id;
    expect(r.start).toBe(id("web-prod-01"));
    expect(r.steps.map((s) => s.nodeIds)).toEqual([[id("web-prod-01")], [id("Checkout web app")], [id("Checkout — production")]]);
    expect([...blastView(m, r, 2, "scenario").edges.values()].every((e) => !e.forward)).toBe(true);
  });

  it("it stops where the walk breaks: a relationship gone, or one that doesn't leave where the flow is; no steps plays nothing", () => {
    const m = checkout();
    expect(flowRadius(m, { id: "f", name: "x", steps: [{ edge: "gone" }, { edge: "e12" }] }).steps).toEqual([]);
    expect(flowRadius(m, { id: "f", name: "x", steps: [{ edge: "e6" }, { edge: "e12" }] }).steps).toHaveLength(2);
    expect(flowRadius(m, { id: "f", name: "x", steps: [] }).steps).toEqual([]);
  });

  it("an element the flow comes back to keeps the number of the step that first reached it", () => {
    const m = checkout();
    const there: Flow = { id: "f", name: "There and back", steps: [{ edge: "e12" }, { edge: "e12", back: true }] };
    const r = flowRadius(m, there);
    const web = m.nodes.find((n) => n.name === "Checkout web app")!.id;
    expect(blastView(m, r, 2, "scenario").nodes.get(web)).toEqual({ hop: 0, current: true });
  });

  it("loading a file cuts a flow where its walk breaks, and says so", async () => {
    const { parseModel } = await import("./model");
    const json = JSON.parse(JSON.stringify(checkout()));
    json.flows = [{ id: "f", name: "Broken", steps: [{ edge: "e6" }, { edge: "gone" }, { edge: "e9" }] }];
    const r = parseModel(json);
    expect(r.ok && r.model.flows![0]!.steps).toEqual([{ edge: "e6" }]);
    expect(r.ok && r.notes).toEqual(["Flow “Broken” was cut after step 1: its next relationship isn't in the model, or doesn't leave where the flow had reached."]);
  });

  it("what can come next: the relationships at the flow's end, either way; and each step in words", () => {
    const m = checkout();
    const id = (name: string) => m.nodes.find((n) => n.name === name)!.id;
    const next = nextSteps(m, id("Checkout web app"));
    expect(next.map((s) => s.edge).sort()).toEqual(["e12", "e9"]);
    expect(next.find((s) => s.edge === "e9")).toEqual({ edge: "e9", back: true, to: id("Checkout — production") });
    expect(flowStepText(m, { edge: "e12" })).toBe("Checkout web app → web-prod-01 (Runs on)");
    expect(flowStepText(m, { edge: "e9", back: true })).toBe("Checkout web app → Checkout — production (Used by)");
  });
});

describe("flows survive what rebuilds a model (M70)", () => {
  it("setting the model's details keeps its flows", async () => {
    const { withDetails } = await import("./model");
    const m = { ...checkout(), flows: [order] };
    expect(withDetails(m, { description: "x" }).flows).toEqual([order]);
  });
});
