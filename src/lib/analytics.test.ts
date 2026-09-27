import { expect, it } from "vitest";
import { analyticsEnabled } from "./analytics";

it("reports only from Vercel production builds", () => {
  expect(analyticsEnabled("production")).toBe(true);
  expect(analyticsEnabled("preview")).toBe(false);
  expect(analyticsEnabled("development")).toBe(false);
  expect(analyticsEnabled(undefined)).toBe(false);
});
