import { describe, expect, it } from "vitest";
import { examples } from "@/examples";
import { serializeModel, type Model } from "@/model";
import { MAX_FILE_CHARS } from "./file";
import { decodeShare, encodeShare, SHARE_MAX_CHARS, SHARE_WARN_CHARS, shareSize, shareUrl } from "./shareLink";

const model = () => examples.find((e) => e.id === "checkout")!.create(new Date("2026-10-09T00:00:00Z"), "m1");

/** Raw deflate of `text`, base64url, behind a version: what a link carries after `#model=`. */
async function pack(text: string | Uint8Array, version = "1") {
  const bytes = typeof text === "string" ? new TextEncoder().encode(text) : text;
  const stream = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return `${version}.${Buffer.from(await new Response(stream).arrayBuffer()).toString("base64url")}`;
}

/**
 * Made with Node's zlib, not the app's encoder: the link format is a public contract (shared links
 * live in chats, posts and documents), so a link made today must open in every later version.
 */
const PINNED =
  "1.hZBNasMwEEavImYtF9mFQGfbC3TRbFJKUKRJI2JLwmOHGiPoIVroFXqO3iQnKVL_DF0UtJkPvU9vNAObA3UasJbgLCBE5z3Zig-6p6oGCV53BAg3JRclF63zR3F-ehZG79_fxPn1BSSYnvRAuaNRzaqqVaWubpXCci6UUhuQMEb7_yUfLDHg3fyptNO5vdXMeRjZeWLe6hhbZ_Tggv-1vD6QOYZxgCS_YD6ZBb2Atkz9yRn6C5fNYh_saEp7updA9mGpRPln9n3ovvWG8PPWMMXctmZixDWTFbupdLR6ymo4ZwRneARUEibAeqWSLPQyvWxUSukD";

describe("share links: encode and decode", () => {
  it("round-trips every example exactly, as the JSON file does", async () => {
    for (const ex of examples) {
      const m = ex.create(new Date("2026-10-09T00:00:00Z"), `share-${ex.id}`);
      const payload = await encodeShare(m);
      expect(payload).toMatch(/^1\.[A-Za-z0-9_-]+$/);
      const r = await decodeShare(payload, new Set());
      expect(r.ok, ex.id).toBe(true);
      if (r.ok) expect(serializeModel(r.model)).toBe(serializeModel(m));
    }
  });

  it("keeps non-Latin and emoji names, descriptions and attributes", async () => {
    const m: Model = {
      ...model(),
      name: "Ödeme — 決済 ☕ 👩🏽‍💻",
      description: "Привет, мир. مرحبا",
      nodes: model().nodes.map((n, i) => (i === 0 ? { ...n, name: "Ünïcödé 🚀", attrs: { note: "日本語 ✓" } } : n)),
    };
    const r = await decodeShare(await encodeShare(m), new Set());
    expect(r.ok && serializeModel(r.model)).toBe(serializeModel(m));
  });

  it("opens the pinned version-1 link (made by another encoder)", async () => {
    const r = await decodeShare(PINNED, new Set());
    expect(r).toMatchObject({ ok: true, copied: false, issues: [] });
    if (!r.ok) return;
    expect(r.model.id).toBe("pinned-share-1");
    expect(r.model.name).toBe("Pinned share link — café ☕");
    expect(r.model.nodes.map((n) => n.class)).toEqual(["business_application", "application_service"]);
    expect(r.model.edges).toEqual([{ id: "e1", from: "ba", to: "svc", type: "Uses::Used by" }]);
    expect(r.model.layout).toEqual({ ba: { x: 0, y: 160 }, svc: { x: 0, y: 320 } });
  });

  it("opens a model whose id is already here as a copy with a new id, as file import does", async () => {
    const m = model();
    const r = await decodeShare(await encodeShare(m), new Set([m.id]), () => "m2");
    expect(r).toMatchObject({ ok: true, copied: true });
    expect(r.ok && r.model.id).toBe("m2");
    expect(r.ok && r.model.nodes).toEqual(m.nodes);
  });

  it("loads a model that breaks the CSDM rules, with the same warnings as an import", async () => {
    const m = model();
    const [a, b] = m.nodes;
    const broken = { ...m, edges: [...m.edges, { id: "bad", from: a!.id, to: b!.id, type: "Not a type" }] };
    const r = await decodeShare(await pack(JSON.stringify(broken)), new Set());
    expect(r.ok && r.issues.map((i) => i.code)).toEqual(["disallowed-relationship"]);
  });
});

describe("share links: what a link cannot be", () => {
  it("refuses an empty link, characters outside base64url, and a missing version", async () => {
    for (const bad of ["", "1.", "1.abc$def", "1.abc def", "hZBNasMw", ".abc"]) {
      expect(await decodeShare(bad, new Set()), JSON.stringify(bad)).toMatchObject({ ok: false, error: expect.stringContaining("incomplete or damaged") });
    }
  });

  it("refuses a version it does not know, naming it", async () => {
    const r = await decodeShare(await pack(JSON.stringify(model()), "2"), new Set());
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("version 2") });
    // A version that is not a number is just damaged; nothing from the link is echoed back.
    expect(await decodeShare(await pack("{}", "<b>x</b>"), new Set())).toMatchObject({ ok: false, error: expect.stringContaining("incomplete or damaged") });
  });

  it("refuses a link cut short (a truncated deflate stream)", async () => {
    const payload = await encodeShare(model());
    const r = await decodeShare(payload.slice(0, Math.floor(payload.length / 2)), new Set());
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("incomplete or damaged") });
  });

  it("refuses bytes that are not a deflate stream, and a stream that is not JSON", async () => {
    expect(await decodeShare(`1.${Buffer.from("plain text, not deflated").toString("base64url")}`, new Set())).toMatchObject({
      ok: false,
      error: expect.stringContaining("incomplete or damaged"),
    });
    expect(await decodeShare(await pack("not json at all"), new Set())).toMatchObject({ ok: false, error: expect.stringContaining("incomplete or damaged") });
  });

  it("refuses a payload over the length cap before decoding it", async () => {
    const r = await decodeShare(`1.${"A".repeat(SHARE_MAX_CHARS)}`, new Set());
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("too long") });
  });

  it("stops decompressing past 5 MB (a small link that expands into a huge one)", async () => {
    const payload = await pack(new Uint8Array(MAX_FILE_CHARS + 1_000_000));
    expect(payload.length).toBeLessThan(SHARE_MAX_CHARS);
    const r = await decodeShare(payload, new Set());
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("too large") });
  });

  it("refuses a model that fails validation, with the reason, worded for a link", async () => {
    const r = await decodeShare(await pack(JSON.stringify({ schema: 1, id: "x" })), new Set());
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining("does not hold a valid model") });
    expect(r.ok || r.error).not.toContain("file");
    const notOurs = await decodeShare(await pack(JSON.stringify({ hello: "world" })), new Set());
    expect(notOurs.ok || notOurs.error).not.toContain("file");
    const unknown = { ...model(), nodes: [{ id: "n", class: "flux_capacitor", name: "Doc's car" }], edges: [], layout: {} };
    expect(await decodeShare(await pack(JSON.stringify(unknown)), new Set())).toMatchObject({ ok: false, error: expect.stringContaining("flux_capacitor") });
  });
});

describe("share links: size", () => {
  it("builds the link on /editor with the model in the fragment", () => {
    expect(shareUrl("https://model.mikereams.com", "1.abc")).toBe("https://model.mikereams.com/editor#model=1.abc");
  });

  it("is fine up to the warning length, long past it, and too large past the cap", () => {
    expect(shareSize("x".repeat(SHARE_WARN_CHARS), "1.x")).toBe("ok");
    expect(shareSize("x".repeat(SHARE_WARN_CHARS + 1), "1.x")).toBe("long");
    expect(shareSize("x".repeat(SHARE_MAX_CHARS + 50), "x".repeat(SHARE_MAX_CHARS))).toBe("long");
    expect(shareSize("x".repeat(SHARE_MAX_CHARS + 50), "x".repeat(SHARE_MAX_CHARS + 1))).toBe("too-large");
  });

  it("keeps every shipped example well under the warning length", async () => {
    for (const ex of examples) {
      const url = shareUrl("https://model.mikereams.com", await encodeShare(ex.create()));
      expect(url.length, ex.id).toBeLessThan(SHARE_WARN_CHARS / 2);
    }
  });
});
