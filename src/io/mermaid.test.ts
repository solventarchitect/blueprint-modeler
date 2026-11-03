import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import type { Model } from "@/model";
import { mermaidLabel, modelToMermaid } from "./mermaid";

// M82: the model as a Mermaid flowchart, for Markdown that GitHub, GitLab, Confluence and Notion draw.
const checkout = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-09-27T00:00:00Z"), "m1");

describe("Mermaid export (M82)", () => {
  it("a top-down flowchart with a header comment, one subgraph per layer in order, every element and relationship", () => {
    const m = checkout();
    const text = modelToMermaid(m);
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toBe("%% Online Store Checkout · Blueprint Modeler (model.mikereams.com)");
    expect(lines[1]).toBe("flowchart TB");
    const subgraphs = lines.filter((l) => l.trim().startsWith("subgraph ")).map((l) => l.trim());
    expect(subgraphs).toEqual(['subgraph business["Business"]', 'subgraph design["Design"]', 'subgraph service["Service"]', 'subgraph functional["Functional"]', 'subgraph infrastructure["Infrastructure"]']);
    expect(lines.filter((l) => /^\s+n\d+\["/.test(l))).toHaveLength(m.nodes.length);
    expect(lines.filter((l) => /^\s+n\d+ -->\|/.test(l))).toHaveLength(m.edges.length);
    expect(text).toContain('["Checkout<br/>Business Application"]');
    expect(text.endsWith("\n")).toBe(true);
  });

  it("labels each relationship with its forward word, and marks plan status", () => {
    const m: Model = checkout();
    m.nodes = m.nodes.map((n) => (n.id === "db" ? { ...n, plan: "planned" as const } : n));
    m.edges = m.edges.map((e, i) => (i === 0 ? { ...e, plan: "retiring" as const } : e));
    const text = modelToMermaid(m);
    const id = (nodeId: string) => `n${m.nodes.findIndex((n) => n.id === nodeId)}`;
    expect(text).toContain(`${id("db")}["Orders database<br/>Application · Planned"]`);
    const first = m.edges[0]!;
    expect(text).toContain(`${id(first.from)} -.->|"${first.type.split("::")[0]} (retiring)"| ${id(first.to)}`);
    // Planned and retiring elements get a dashed style too, so it doesn't rest on words alone.
    expect(text).toMatch(/classDef planned stroke-dasharray/);
  });

  it("keeps names as text: quotes, angle brackets, hashes and line breaks can't break out of a label", () => {
    expect(mermaidLabel('A "quoted" <b>name</b> #1 100%\nnext')).toBe("A #quot;quoted#quot; #lt;b#gt;name#lt;/b#gt; #35;1 100#37; next");
    const m = checkout();
    m.nodes[0]!.name = 'x"]; click n0 "javascript:alert(1)"; y["';
    const text = modelToMermaid(m);
    expect(text).not.toContain('"]; click');
    expect(text).not.toMatch(/^\s*click /m);
  });

  it("says when it is a part, and the model's name stays out of directives", () => {
    const m = checkout();
    const text = modelToMermaid({ ...m, name: "Line one\n%%{init: {}}%%" }, "Showing 3 of 14 elements: view “Prod”");
    const head = text.split("\n").slice(0, 3);
    // Mermaid reads %%{…}%% as a directive anywhere in the text, so a name's percent signs are changed.
    expect(head[0]).toBe("%% Line one ％％{init: {}}％％ · Blueprint Modeler (model.mikereams.com)");
    expect(text).not.toContain("%%{");
    expect(head[1]).toBe("%% Showing 3 of 14 elements: view “Prod”");
    expect(head[2]).toBe("flowchart TB");
  });
});
