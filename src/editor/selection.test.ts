import { describe, expect, it } from "vitest";
import { LIFE_CYCLE } from "@/metamodel";
import { sharedStages } from "./SelectionPanel";

describe("sharedStages (M63)", () => {
  const n = (id: string, cls: string) => ({ id, class: cls, name: id });
  it("offers the stages every selected class has, and counts the classes without a CSDM life cycle", () => {
    expect(sharedStages([n("a", "business_application"), n("b", "host")])).toEqual({ stages: [...LIFE_CYCLE.logical.stages], skipped: 0 });
    // A Business Process follows the document life cycle; with a Host they share Operational and End of Life.
    expect(sharedStages([n("p", "business_process"), n("h", "host")]).stages).toEqual(["Operational", "End of Life"]);
    // A value stream (cmn_ table) has none: left alone, and counted.
    expect(sharedStages([n("v", "value_stream"), n("h", "host"), n("h2", "host")]).skipped).toBe(1);
    expect(sharedStages([n("v", "value_stream")])).toEqual({ stages: [], skipped: 1 });
  });
});
