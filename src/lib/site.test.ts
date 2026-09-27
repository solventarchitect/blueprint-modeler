import { describe, expect, it } from "vitest";
import { site } from "./site";

describe("site", () => {
  it("serves from the model subdomain over https", () => {
    expect(site.url).toBe("https://model.mikereams.com");
  });

  it("keeps CSDM out of the product name and carries the not-affiliated notice", () => {
    expect(site.name).not.toMatch(/csdm|servicenow/i);
    expect(site.notAffiliated).toMatch(/Not affiliated/);
  });
});
