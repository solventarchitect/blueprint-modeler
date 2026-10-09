import { parseModel, type Issue, type Model } from "@/model";
import { MAX_FILE_CHARS } from "./file";

/**
 * Share a model as a link (M45): `/editor#model=1.<payload>`, the payload being the compact model
 * JSON, raw-deflated by the browser's own CompressionStream and base64url-encoded. The model sits
 * in the fragment, which browsers never send to a server. The format is a public contract: links
 * live on in chats, posts and documents, so version 1 must open in every later release.
 */
export const SHARE_KEY = "model";
export const SHARE_VERSION = "1";
/** Links longer than this still copy, with a warning: some chat and email apps cut long links. */
export const SHARE_WARN_CHARS = 8_000;
/** Payloads longer than this are not made, and not read: a model file travels better. */
export const SHARE_MAX_CHARS = 100_000;

export type ShareResult = { ok: true; model: Model; issues: Issue[]; copied: boolean } | { ok: false; error: string };

const DAMAGED = "The link is incomplete or damaged; it may have been cut short when it was copied.";
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Whether this browser can make and read model links (CompressionStream: Chrome 80, Firefox 113, Safari 16.4). */
export const shareSupported = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array | null {
  if (!BASE64URL.test(text) || text.length % 4 === 1) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** The part of a link after `#model=`, for this model. */
export async function encodeShare(model: Model): Promise<string> {
  const stream = new Blob([JSON.stringify(model)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return `${SHARE_VERSION}.${toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
}

/** The link itself: always on /editor, the model in the fragment. */
export const shareUrl = (origin: string, payload: string) => `${origin}/editor#${SHARE_KEY}=${payload}`;

/** Whether a link can be shared as is, should come with a warning, or is too large to make. */
export function shareSize(url: string, payload: string): "ok" | "long" | "too-large" {
  if (payload.length > SHARE_MAX_CHARS) return "too-large";
  return url.length > SHARE_WARN_CHARS ? "long" : "ok";
}

/** Inflate, stopping as soon as the output passes the model-file cap (a small link can expand enormously). */
async function inflate(bytes: Uint8Array): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const reader = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("deflate-raw")).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_FILE_CHARS) {
        void reader.cancel().catch(() => {});
        return { ok: false, error: "The model in the link is too large (over 5 MB)." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, error: DAMAGED };
  }
  const all = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.length;
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(all) };
  } catch {
    return { ok: false, error: DAMAGED };
  }
}

/** The model checks speak of files; say "link" instead. */
const forLink = (error: string) =>
  error
    .replace(/^The file is not a valid model/, "The link does not hold a valid model")
    .replace(/^This is not a Blueprint Modeler file/, "The link does not hold a Blueprint Modeler model")
    .replace(/^This file was made/, "The model in the link was made");

/**
 * Read the part of a link after `#model=`. The model passes the same checks as an imported file
 * (`parseModel`), and a model whose id is already in this browser arrives as a copy with a new id,
 * so a link never overwrites existing work. Nothing is saved here.
 */
export async function decodeShare(payload: string, existingIds: ReadonlySet<string>, newId: () => string = () => crypto.randomUUID()): Promise<ShareResult> {
  if (payload.length > SHARE_MAX_CHARS) {
    return { ok: false, error: `The link is too long to hold a model (over ${SHARE_MAX_CHARS.toLocaleString("en-US")} characters).` };
  }
  const dot = payload.indexOf(".");
  const version = dot > 0 ? payload.slice(0, dot) : "";
  if (!/^\d{1,4}$/.test(version)) return { ok: false, error: DAMAGED };
  if (version !== SHARE_VERSION) {
    if (Number(version) <= Number(SHARE_VERSION)) return { ok: false, error: DAMAGED };
    return { ok: false, error: `The link was made by a newer version of Blueprint Modeler (link format version ${Number(version)}). Reload the page to get the latest version.` };
  }
  const bytes = fromBase64Url(payload.slice(dot + 1));
  if (!bytes) return { ok: false, error: DAMAGED };
  const inflated = await inflate(bytes);
  if (!inflated.ok) return inflated;
  let data: unknown;
  try {
    data = JSON.parse(inflated.text);
  } catch {
    return { ok: false, error: DAMAGED };
  }
  const r = parseModel(data);
  if (!r.ok) return { ok: false, error: forLink(r.error) };
  const copied = existingIds.has(r.model.id);
  return { ok: true, model: copied ? { ...r.model, id: newId() } : r.model, issues: r.issues, copied };
}

declare global {
  interface Window {
    /** The model link's payload, taken off the address by `shareCaptureScript` before the page's scripts run. */
    __bmShared?: string;
  }
}

const prefix = `#${SHARE_KEY}=`;

/**
 * Runs while the editor page is still being parsed (an inline script): takes the model off the
 * address at once, so nothing that loads later ever sees it, and leaves it for the editor.
 */
export const shareCaptureScript = `try{var h=location.hash;if(h.indexOf(${JSON.stringify(prefix)})===0){window.__bmShared=h.slice(${prefix.length});history.replaceState(null,"",location.pathname+location.search)}}catch(e){}`;

/**
 * The model link's payload, once: from the capture script, or (after a client-side navigation or a
 * link pasted into an open editor) from the address, which is cleaned. Null when there is none.
 */
export function takeSharedPayload(): string | null {
  const early = window.__bmShared;
  if (early !== undefined) {
    delete window.__bmShared;
    return early;
  }
  const hash = window.location.hash;
  if (!hash.startsWith(prefix)) return null;
  // `null` state, so Next.js's router adopts the clean address (as for ?example=, M42).
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  return hash.slice(prefix.length);
}
