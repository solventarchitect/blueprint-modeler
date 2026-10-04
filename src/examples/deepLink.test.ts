import { describe, expect, it } from "vitest";
import { examples } from "./index";
import { exampleFromSearch, EXAMPLE_PARAM, SHOWN_ID_MAX } from "./deepLink";

describe("exampleFromSearch", () => {
  it("finds a shipped example by its exact id", () => {
    const r = exampleFromSearch("?example=checkout");
    expect(r?.id).toBe("checkout");
    expect(r?.example?.name).toBe("Online Store Checkout");
    expect(r?.example).toBe(examples.find((e) => e.id === "checkout"));
  });

  it("keeps the ids the site already links to", () => {
    for (const id of ["checkout", "hr-portal", "db-platform", "enterprise-ai"]) expect(exampleFromSearch(`?${EXAMPLE_PARAM}=${id}`)?.example?.id).toBe(id);
  });

  it("reads the parameter among others, with or without the leading ?", () => {
    expect(exampleFromSearch("utm_source=site&example=hr-portal")?.example?.id).toBe("hr-portal");
  });

  it("returns the id without an example when nothing matches", () => {
    expect(exampleFromSearch("?example=nope")).toEqual({ id: "nope", shown: "nope" });
  });

  it("matches case-sensitively, without guessing", () => {
    expect(exampleFromSearch("?example=Checkout")?.example).toBeUndefined();
    expect(exampleFromSearch("?example=checkout%20")?.example).toBeUndefined();
  });

  it("decodes URL-encoded ids", () => {
    expect(exampleFromSearch("?example=hr%2Dportal")?.example?.id).toBe("hr-portal");
    expect(exampleFromSearch("?example=%E2%80%9Cx%E2%80%9D")).toEqual({ id: "“x”", shown: "“x”" });
  });

  it("is null when the parameter is missing or empty", () => {
    expect(exampleFromSearch("")).toBeNull();
    expect(exampleFromSearch("?")).toBeNull();
    expect(exampleFromSearch("?lens=archimate")).toBeNull();
    expect(exampleFromSearch("?example=")).toBeNull();
    expect(exampleFromSearch("?example")).toBeNull();
  });

  it("caps the id shown in a message at 64 characters, matching on the whole id", () => {
    const long = "x".repeat(200);
    const r = exampleFromSearch(`?example=${long}`)!;
    expect(r.id).toBe(long);
    expect(r.example).toBeUndefined();
    expect(SHOWN_ID_MAX).toBe(64);
    expect(r.shown).toHaveLength(64);
    expect(r.shown.endsWith("…")).toBe(true);
    expect(exampleFromSearch(`?example=${"y".repeat(64)}`)!.shown).toBe("y".repeat(64));
  });
});

describe("example ids", () => {
  it("are the public list the README documents, in Artifact ID order (change only on purpose: other sites link to them)", () => {
    expect(examples.map((e) => e.id)).toEqual([
      "checkout", "hr-portal", "db-platform", "kubernetes", "enterprise-ai", "dmz-edge", "directory", "remote-access",
      "servicenow-itsm", "servicenow-instances", "servicenow-integrations", "server-virtualization", "vdi", "archimate-claims", "csdm5-metamodel",
    ]);
  });
});
