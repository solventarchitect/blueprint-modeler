"use client";

import { useCallback, useId, useRef, useState } from "react";
import { ToolbarIcon } from "./ToolbarIcon";
import { useDismiss } from "./useDismiss";

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
  const panelId = useId();
  const close = useCallback(() => setOpen(false), []);
  // As the other toolbar panels: a press outside or Escape (wherever focus is) closes it.
  useDismiss(open, close, root, button);

  return (
    <div
      ref={root}
      onBlur={(e) => {
        // Tabbing out of the panel closes it, so it never sits over the control that has focus.
        if (open && e.relatedTarget && !root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button ref={button} type="button" className={buttonClass} aria-expanded={open} aria-controls={panelId} onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}>
        <ToolbarIcon name="export" />
        Export <span aria-hidden="true">▾</span>
      </button>
      {/* Anchored to the toolbar, as the Examples and Model panels are: always inside the window. */}
      <div
        id={panelId}
        hidden={!open}
        data-testid="export-panel"
        className="absolute inset-x-4 top-full z-30 mt-1 max-h-[min(70vh,40rem)] max-w-5xl overflow-y-auto border border-border-strong bg-surface-raised p-2 shadow-lg md:columns-3 md:gap-x-2"
      >
        {EXPORT_GROUPS.map((g, i) => (
          <section key={g.label} aria-labelledby={`${panelId}-g${i}`} className="break-inside-avoid py-1">
            <h2 id={`${panelId}-g${i}`} className="px-3 pt-1 pb-0.5 font-mono text-xs tracking-[0.14em] text-accent uppercase">
              {g.label}
            </h2>
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
          </section>
        ))}
      </div>
    </div>
  );
}
