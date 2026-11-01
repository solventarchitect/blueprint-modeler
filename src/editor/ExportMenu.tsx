"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ToolbarIcon } from "./ToolbarIcon";

export type ExportKind = "json" | "link" | "view-link" | "svg-dark" | "svg-light" | "png-dark" | "png-light" | "print" | "report" | "book" | "blast-gif" | "flow-gif" | "scenario-gif" | "archimate" | "drawio" | "servicenow";

export const exportItems: { kind: ExportKind; label: string; note: string }[] = [
  { kind: "json", label: "Model file (JSON)", note: "Back up, move or version it" },
  { kind: "link", label: "Copy link to this model", note: "Anyone with the link can open a copy" },
  { kind: "view-link", label: "Copy view-only link", note: "Opens read only, saving nothing; works in a web page's frame" },
  { kind: "svg-dark", label: "Image, dark (SVG)", note: "For docs and slides" },
  { kind: "svg-light", label: "Image, light (SVG)", note: "For docs and slides" },
  { kind: "png-dark", label: "Image, dark (PNG)", note: "Where SVG is not accepted; 2× size" },
  { kind: "png-light", label: "Image, light (PNG)", note: "Where SVG is not accepted; 2× size" },
  { kind: "print", label: "Print…", note: "The light image on paper, or saved as a PDF" },
  { kind: "report", label: "Health report…", note: "Hints, layers and missing details on one page, printed or saved as a PDF" },
  { kind: "book", label: "Model book…", note: "One document for a review: picture, the model by layer, tables, saved flows and health; printed or saved as a PDF" },
  { kind: "blast-gif", label: "Blast radius animation (GIF)", note: "The open blast radius, one frame a hop" },
  { kind: "flow-gif", label: "Data flow animation (GIF)", note: "The open data flow, one frame a step" },
  { kind: "scenario-gif", label: "Saved flow animation (GIF)", note: "The saved flow playing, one frame a step" },
  { kind: "archimate", label: "ArchiMate model (XML)", note: "Open in Archi or another ArchiMate tool" },
  { kind: "drawio", label: "draw.io / Lucidchart (.drawio)", note: "Open in draw.io, or import into Lucidchart" },
  { kind: "servicenow", label: "ServiceNow import (Excel)", note: "One sheet per CMDB table, plus relationships" },
];

/**
 * M79: the menu's groups, as columns in one wide panel (one scrolling column on small screens). Every
 * item is in exactly one; the palette keeps the flat list above.
 */
const GROUPS: { label: string; kinds: ExportKind[] }[] = [
  { label: "Share", kinds: ["link", "view-link", "json"] },
  { label: "Images", kinds: ["svg-dark", "svg-light", "png-dark", "png-light", "print"] },
  { label: "Documents", kinds: ["book", "report"] },
  { label: "Animations", kinds: ["blast-gif", "flow-gif", "scenario-gif"] },
  { label: "Other tools", kinds: ["archimate", "drawio", "servicenow"] },
];
export const EXPORT_GROUPS = GROUPS.map((g) => ({ label: g.label, items: g.kinds.map((k) => exportItems.find((i) => i.kind === k)!) }));

/** Disclosure menu (M79: a mega menu): a button that shows the export actions in labeled groups. Escape or a click outside closes it. */
export function ExportMenu({
  onExport,
  onOpen,
  buttonClass,
  notes = {},
  disabled = {},
}: {
  onExport: (k: ExportKind) => void;
  /** Called as the menu opens, to get notes ready (the share link's size). */
  onOpen?: () => void;
  buttonClass: string;
  /** Extra line under an item, e.g. the Lucid plan fit for the draw.io export. */
  notes?: Partial<Record<ExportKind, string>>;
  /** Items that cannot run now; their note says why. */
  disabled?: Partial<Record<ExportKind, boolean>>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const panel = useRef<HTMLDivElement>(null);
  // The panel opens under the button and is kept inside the window: shifted left when it would run off the right edge.
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    if (!open || !panel.current || !root.current) return;
    const left = root.current.getBoundingClientRect().left;
    const width = panel.current.offsetWidth;
    setShift(Math.min(0, window.innerWidth - 16 - (left + width)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button ref={button} type="button" className={buttonClass} aria-expanded={open} aria-controls={listId} onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}>
        <ToolbarIcon name="export" />
        Export <span aria-hidden="true">▾</span>
      </button>
      <div
        ref={panel}
        id={listId}
        hidden={!open}
        style={{ left: shift }}
        data-testid="export-panel"
        className="absolute z-20 mt-1 max-h-[calc(100dvh-8rem)] w-[min(60rem,calc(100vw-2rem))] overflow-y-auto border border-border-strong bg-surface-raised p-2 md:grid md:grid-cols-3 md:gap-x-2"
      >
        {EXPORT_GROUPS.map((g) => (
          <div key={g.label} role="group" aria-labelledby={`${listId}-${g.label}`} className="py-1">
            <h3 id={`${listId}-${g.label}`} className="px-3 pt-1 pb-0.5 font-mono text-xs tracking-[0.14em] text-accent uppercase">
              {g.label}
            </h3>
            <ul>
              {g.items.map((it) => (
                <li key={it.kind}>
                  <button
                    type="button"
                    // aria-disabled, not disabled: the item stays reachable by keyboard, so its note can say why.
                    aria-disabled={disabled[it.kind] || undefined}
                    className="flex w-full cursor-pointer flex-col px-3 py-2 text-left hover:bg-surface hover:text-accent focus-visible:bg-surface aria-disabled:cursor-not-allowed aria-disabled:hover:bg-transparent"
                    onClick={() => {
                      if (disabled[it.kind]) return;
                      setOpen(false);
                      button.current?.focus();
                      onExport(it.kind);
                    }}
                  >
                    <span className={`text-sm ${disabled[it.kind] ? "text-ink-muted" : "text-ink"}`}>{it.label}</span>
                    <span className="text-xs text-ink-muted">{it.note}</span>
                    {notes[it.kind] && (
                      <span className="text-xs text-ink-muted" data-testid={`export-note-${it.kind}`}>
                        {notes[it.kind]}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
