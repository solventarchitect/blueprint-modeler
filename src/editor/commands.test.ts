import { describe, expect, it } from "vitest";
import { filterCommands, type Command } from "./commands";

const cmd = (id: string, label: string, group = "Model", extra: Partial<Command> = {}): Command => ({ id, label, group, run: () => {}, ...extra });

const all = [
  cmd("new", "New model"),
  cmd("svg-dark", "Image, dark (SVG)", "Export"),
  cmd("png-dark", "Image, dark (PNG)", "Export"),
  cmd("add-ba", "Add Business Application", "Add"),
  cmd("add-as", "Add Application Service", "Add"),
  cmd("fit", "Fit view", "Zoom", { keywords: "zoom whole model" }),
];

describe("filterCommands", () => {
  it("returns every command, in order, for an empty or blank query", () => {
    expect(filterCommands(all, "").map((c) => c.id)).toEqual(all.map((c) => c.id));
    expect(filterCommands(all, "   ").map((c) => c.id)).toEqual(all.map((c) => c.id));
  });

  it("ignores case and needs every word to match somewhere", () => {
    expect(filterCommands(all, "IMAGE png").map((c) => c.id)).toEqual(["png-dark"]);
    expect(filterCommands(all, "image jpeg")).toEqual([]);
  });

  it("matches the group and the keywords as well as the label", () => {
    expect(filterCommands(all, "export").map((c) => c.id)).toEqual(["svg-dark", "png-dark"]);
    expect(filterCommands(all, "whole").map((c) => c.id)).toEqual(["fit"]);
  });

  it("puts labels that start with the query first, then labels with a word starting with it", () => {
    // "app" starts "Application Service" words in both Add commands; neither label starts with it.
    expect(filterCommands(all, "app").map((c) => c.id)).toEqual(["add-ba", "add-as"]);
    expect(filterCommands(all, "application").map((c) => c.id)).toEqual(["add-ba", "add-as"]);
    // "add app": only "Add Application Service" starts with the whole query.
    expect(filterCommands(all, "add app").map((c) => c.id)).toEqual(["add-as", "add-ba"]);
    // A label start beats a word start beats a match inside a word or in the group.
    const ranked = [cmd("a", "Show service details", "View"), cmd("b", "Services overview"), cmd("c", "Microservices")];
    expect(filterCommands(ranked, "serv").map((c) => c.id)).toEqual(["b", "a", "c"]);
  });

  it("matches typographic quotes in labels when the query has none", () => {
    const quoted = [cmd("go", "Go to “Order API”", "Go to")];
    expect(filterCommands(quoted, "order api").map((c) => c.id)).toEqual(["go"]);
  });
});
