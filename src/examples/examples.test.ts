import { describe, expect, it } from "vitest";
import { evaluateHints, parseModel, serializeModel } from "@/model";
import { examples } from "./index";

describe("examples", () => {
  it("are valid models that load without relationship warnings", () => {
    for (const ex of examples) {
      const r = parseModel(JSON.parse(serializeModel(ex.create(new Date("2026-09-27T00:00:00Z"), ex.id))));
      expect(r.ok, ex.id).toBe(true);
      if (r.ok) expect(r.issues, ex.id).toEqual([]);
    }
  });

  it("teach what their summaries say", () => {
    const hintIds = (id: string) => evaluateHints(examples.find((e) => e.id === id)!.create()).map((h) => h.hint.id);
    expect(hintIds("checkout")).toEqual([]);
    expect(hintIds("hr-portal")).toEqual(["ba-without-service-instance"]);
    expect(hintIds("db-platform")).toEqual(["ba-without-capability", "ba-without-capability", "service-not-exposed"]);
  });
});
