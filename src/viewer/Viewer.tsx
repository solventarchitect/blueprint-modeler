"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { formatModelDate, modelDate, UNTITLED_MODEL, type Model } from "@/model";
import { decodeShare, editUrlFor, SHARE_KEY, shareSupported } from "@/io/shareLink";
import { modelToSvg } from "@/io/svg";
import { isoToSvg } from "@/iso/svg";
import { useViewedTheme } from "@/editor/IsoView";
import { outlineModel } from "@/editor/reading";

type State = { status: "loading" } | { status: "none" } | { status: "error"; message: string } | { status: "ok"; model: Model; payload: string };

const button =
  "inline-flex min-h-9 cursor-pointer items-center border border-border-strong bg-surface-raised px-3 text-sm text-ink hover:border-accent hover:text-accent aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink aria-pressed:hover:text-accent-ink";
const prefix = `#${SHARE_KEY}=`;
const never = () => () => {};

/**
 * A model opened read only from a view-only link (M75): the picture (plan or isometric), the model in
 * words, and Save a copy, which opens the editor's own link and so saves a copy as any model link does.
 * Nothing is stored here, so it works in a frame (a wiki page, mikereams.com), where a browser may
 * keep a page's storage apart or refuse it.
 */
export function Viewer() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [projection, setProjection] = useState<"plan" | "iso">("plan");
  // Marked by the head script before the page drew (see framedScript); read after hydration.
  const framed = useSyncExternalStore(
    never,
    () => document.documentElement.hasAttribute("data-framed"),
    () => false,
  );
  const theme = useViewedTheme();

  useEffect(() => {
    let current = 0;
    const read = () => {
      const run = ++current;
      const hash = window.location.hash;
      if (!hash.startsWith(prefix)) return setState({ status: "none" });
      if (!shareSupported()) return setState({ status: "error", message: "This browser cannot open model links; update it, or ask for the model file instead." });
      const payload = hash.slice(prefix.length);
      setState({ status: "loading" });
      decodeShare(payload, new Set())
        .then((r) => run === current && setState(r.ok ? { status: "ok", model: r.model, payload } : { status: "error", message: r.error }))
        .catch(() => run === current && setState({ status: "error", message: "This browser could not read the link." }));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  const model = state.status === "ok" ? state.model : null;
  const svg = useMemo(() => (model ? (projection === "plan" ? modelToSvg(model, theme) : isoToSvg(model, theme, { mode: "iso" })).replace(/^<\?xml[^>]*>\n/, "") : ""), [model, projection, theme]);
  const outline = useMemo(() => (model ? outlineModel(model, "csdm") : []), [model]);

  if (state.status === "loading")
    return (
      <>
        <p role="status" className="px-4 py-6 text-sm text-ink-muted sm:px-6">
          Opening the model…
        </p>
        <noscript>
          <p className="px-4 pb-6 text-sm text-ink-soft sm:px-6">This page needs JavaScript to open the model in the link (it never leaves your browser).</p>
        </noscript>
      </>
    );
  if (state.status !== "ok")
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <p className="font-mono text-xs tracking-[0.14em] text-accent uppercase">View only</p>
        <h1 className="mt-2 text-xl font-semibold">{state.status === "none" ? "No model in this link" : "This link can't be opened"}</h1>
        <p role={state.status === "error" ? "alert" : undefined} className="mt-2 text-sm text-ink-soft">
          {state.status === "none" ? "A view-only link ends in #model=… and holds the whole model. Ask for the link again, or open the editor." : state.message}
        </p>
        <Link href="/editor" className={`${button} mt-4`} target={framed ? "_blank" : undefined} rel={framed ? "noopener" : undefined}>
          Open the editor{framed ? <span className="sr-only"> (opens in a new tab)</span> : null}
        </Link>
      </div>
    );

  const m = state.model;
  return (
    <div className="flex flex-col">
      <div role="region" aria-labelledby="view-title" className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-border px-4 py-3 sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs tracking-[0.14em] text-accent uppercase">View only</p>
          <h1 id="view-title" className="mt-1 text-lg font-semibold break-words">
            {m.name || UNTITLED_MODEL}
          </h1>
          {/* Said once it opens (and when the link changes to another model). */}
          <p role="status" className="sr-only">{`Showing “${m.name || UNTITLED_MODEL}”, read only.`}</p>
          <p className="text-xs text-ink-muted">
            {m.artifactId ? `${m.artifactId} · ` : ""}
            {formatModelDate(modelDate(m))} · {m.nodes.length} element{m.nodes.length === 1 ? "" : "s"}, {m.edges.length} relationship{m.edges.length === 1 ? "" : "s"}
          </p>
          {m.description && <p className="mt-1 max-w-3xl text-sm text-ink-soft">{m.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span role="group" aria-label="Projection" className="inline-flex">
            {(["plan", "iso"] as const).map((p, i) => (
              <button key={p} type="button" aria-pressed={projection === p} className={`${button} ${i ? "-ml-px" : ""}`} onClick={() => setProjection(p)}>
                {p === "plan" ? "Plan" : "Isometric"}
              </button>
            ))}
          </span>
          {/* Opens the editor's own link: it saves a copy in this browser, as any model link does. In a frame, in a new tab. */}
          <a href={editUrlFor(state.payload)} className={button} target={framed ? "_blank" : undefined} rel={framed ? "noopener" : undefined}>
            Save a copy{framed ? <span className="sr-only"> (opens in a new tab)</span> : null}
          </a>
        </div>
      </div>
      <p className="px-4 pt-2 text-xs text-ink-muted sm:px-6">Read only: nothing is saved in this browser until you choose Save a copy.</p>
      {/* Wide screens fit the picture to the page; small ones keep it legible and scroll it (a focusable region). */}
      <div
        data-testid="view-picture"
        role="region"
        aria-label="Picture"
        tabIndex={0}
        className="overflow-auto px-4 py-3 focus-visible:outline-2 focus-visible:outline-accent sm:px-6 [&_svg]:h-auto [&_svg]:max-w-none md:[&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <details className="border-t border-border px-4 py-3 text-sm sm:px-6">
        <summary className="inline-flex min-h-6 cursor-pointer items-center text-ink-soft hover:text-ink">The model in words</summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {outline.map((l) => (
            <section key={l.layer} aria-labelledby={`view-layer-${l.layer}`}>
              <h2 id={`view-layer-${l.layer}`} className="text-xs font-medium text-ink-muted">
                {l.name}
              </h2>
              <ul className="mt-1 flex flex-col gap-0.5">
                {l.items.map((it) => (
                  <li key={it.id}>
                    {it.name} <span className="text-ink-muted">({it.kind})</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
    </div>
  );
}
