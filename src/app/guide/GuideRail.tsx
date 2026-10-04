"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Layer } from "@/metamodel";
import { itemMatches, type ClassKind, type GuideFilter } from "@/guide";

type Section = { id: string; label: string; total: number };

const LAYERS: { id: Layer; label: string }[] = [
  { id: "business", label: "Business" },
  { id: "design", label: "Design" },
  { id: "service", label: "Service" },
  { id: "functional", label: "Functional" },
  { id: "infrastructure", label: "Infrastructure" },
];
const KINDS: { id: ClassKind; label: string; note: string }[] = [
  { id: "core", label: "CSDM core", note: "Defined in the CSDM white paper" },
  { id: "cmdb", label: "CMDB", note: "From ServiceNow product documentation" },
  { id: "extended", label: "Extended", note: "Behind View › Extended classes in the editor" },
];

const toggle = <T,>(set: ReadonlySet<T>, v: T) => {
  const next = new Set(set);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
};

/**
 * The guide's tools: a filter box and layer/kind chips that narrow every section, and the section
 * list with how many entries each shows. Sticky beside the guide on wide screens, a bar at the top on
 * narrow ones. The guide itself is static HTML; this hides and shows its entries (`data-guide-item`).
 */
export function GuideRail({ sections }: { sections: Section[] }) {
  const [query, setQuery] = useState("");
  const [layers, setLayers] = useState<ReadonlySet<Layer>>(new Set());
  const [kinds, setKinds] = useState<ReadonlySet<ClassKind>>(new Set());
  const [shown, setShown] = useState<Record<string, number>>(() => Object.fromEntries(sections.map((s) => [s.id, s.total])));
  const [current, setCurrent] = useState(sections[0]?.id ?? "");
  const [chipsOpen, setChipsOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  /** A link to an entry the filter hides: the filter is cleared, then the link is followed. */
  const pendingHash = useRef<string | null>(null);
  const chipsId = useId();
  const active = query.trim() !== "" || layers.size > 0 || kinds.size > 0;

  const clear = useCallback(() => {
    setQuery("");
    setLayers(new Set());
    setKinds(new Set());
  }, []);

  // Apply the filter to the page.
  useEffect(() => {
    const f: GuideFilter = { query, layers, kinds };
    const counts: Record<string, number> = {};
    for (const section of document.querySelectorAll<HTMLElement>("[data-guide-section]")) {
      let n = 0;
      for (const el of section.querySelectorAll<HTMLElement>("[data-guide-item]")) {
        const match = itemMatches(
          {
            text: el.dataset.text ?? "",
            layers: (el.dataset.layers || "").split(" ").filter(Boolean) as Layer[],
            kinds: (el.dataset.kinds || "").split(" ").filter(Boolean) as ClassKind[],
          },
          f,
        );
        el.hidden = !match;
        if (match) n++;
      }
      // Groups (a layer's class cards, a table) disappear when nothing in them shows.
      for (const group of section.querySelectorAll<HTMLElement>("[data-guide-group]")) {
        group.hidden = !group.querySelector("[data-guide-item]:not([hidden])");
      }
      const empty = section.querySelector<HTMLElement>("[data-guide-empty]");
      if (empty) empty.hidden = n > 0;
      counts[section.dataset.guideSection ?? ""] = n;
    }
    setShown(counts);
    if (pendingHash.current) {
      const id = pendingHash.current;
      pendingHash.current = null;
      if (location.hash === `#${id}`) document.getElementById(id)?.scrollIntoView();
      else location.hash = id;
    }
  }, [query, layers, kinds]);

  // A link (or an address) to an entry the filter hides clears the filter first.
  useEffect(() => {
    const hiddenTarget = (id: string) => {
      const el = id ? document.getElementById(id) : null;
      return !!el && !!el.closest("[hidden]");
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href^='#']");
      const id = a?.getAttribute("href")?.slice(1) ?? "";
      if (!hiddenTarget(id)) return;
      e.preventDefault();
      pendingHash.current = id;
      clear();
    };
    const onHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!hiddenTarget(id)) return;
      pendingHash.current = id;
      clear();
    };
    document.addEventListener("click", onClick);
    window.addEventListener("hashchange", onHash);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("hashchange", onHash);
    };
  }, [clear]);

  // The section being read: the last one whose heading is in the top third of the view (below the
  // sticky bar on narrow screens, where headings land about 12rem down).
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = Math.max(200, window.innerHeight / 3);
      let at = sections[0]?.id ?? "";
      for (const s of sections) {
        const h = document.getElementById(s.id);
        if (h && h.getBoundingClientRect().top <= line) at = s.id;
      }
      // At the very bottom, the last section is the one being read even if its heading is low.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) at = sections[sections.length - 1]?.id ?? at;
      setCurrent(at);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("hashchange", update);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("hashchange", update);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  const total = Object.values(shown).reduce((a, b) => a + b, 0);
  const phrase = query.trim() ? ` “${query.trim()}”` : "";
  const status = !active ? "" : total === 0 ? `No entries match${phrase}.` : `${total} ${total === 1 ? "entry matches" : "entries match"}${phrase}.`;
  const chip = (pressed: boolean) =>
    `inline-flex min-h-8 items-center border px-2 text-xs ${pressed ? "border-accent bg-accent text-accent-ink" : "border-border-strong text-ink-soft hover:border-accent hover:text-accent"}`;

  return (
    <aside
      aria-label="Guide tools"
      className="sticky top-0 z-20 -mx-4 border-b border-border bg-surface px-4 py-3 sm:-mx-6 sm:px-6 lg:top-6 lg:mx-0 lg:max-h-[calc(100dvh-3rem)] lg:self-start lg:overflow-y-auto lg:border-b-0 lg:px-0 lg:py-0"
    >
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Filter the guide</span>
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter: class, table or type"
            className="w-full border border-border-strong bg-surface-raised px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-muted"
          />
        </label>
        <button
          type="button"
          className="inline-flex min-h-8 items-center border border-border-strong px-2 text-xs text-ink-soft lg:hidden"
          aria-expanded={chipsOpen}
          aria-controls={chipsId}
          onClick={() => setChipsOpen((o) => !o)}
        >
          Filters{layers.size + kinds.size ? ` (${layers.size + kinds.size})` : ""}
        </button>
      </div>
      {active && (
        <button
          type="button"
          className="mt-1 inline-flex min-h-6 items-center text-xs text-accent underline underline-offset-4"
          onClick={() => {
            clear();
            input.current?.focus();
          }}
        >
          Clear filter
        </button>
      )}
      <div id={chipsId} className={`${chipsOpen ? "" : "max-lg:hidden"} mt-3 flex flex-col gap-3`}>
        <div role="group" aria-label="Layer" className="flex flex-wrap gap-1.5">
          {LAYERS.map((l) => (
            <button key={l.id} type="button" aria-pressed={layers.has(l.id)} className={chip(layers.has(l.id))} onClick={() => setLayers((s) => toggle(s, l.id))}>
              {l.label}
            </button>
          ))}
        </div>
        <div role="group" aria-label="Kind" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => (
            <button key={k.id} type="button" title={k.note} aria-pressed={kinds.has(k.id)} className={chip(kinds.has(k.id))} onClick={() => setKinds((s) => toggle(s, k.id))}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <nav aria-label="On this page" className="mt-3 lg:mt-6">
        <ul className="flex gap-x-4 overflow-x-auto text-sm lg:flex-col lg:gap-y-1 lg:overflow-visible">
          {sections.map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                // On narrow screens, fold the chips away before the jump so the heading lands below the bar.
                onClick={() => chipsOpen && flushSync(() => setChipsOpen(false))}
                aria-current={current === s.id ? "location" : undefined}
                className="flex min-h-8 items-center gap-2 whitespace-nowrap text-ink-soft hover:text-accent aria-[current=location]:font-medium aria-[current=location]:text-accent lg:border-l-2 lg:border-transparent lg:pl-3 lg:aria-[current=location]:border-accent"
              >
                {s.label}
                <span className="font-mono text-xs text-ink-muted">{active ? `${shown[s.id] ?? 0} of ${s.total}` : s.total}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <p role="status" className="sr-only">
        {status}
      </p>
    </aside>
  );
}
