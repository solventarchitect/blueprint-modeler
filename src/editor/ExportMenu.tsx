"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ToolbarIcon } from "./ToolbarIcon";

export type ExportKind = "json" | "svg-dark" | "svg-light" | "archimate" | "drawio" | "servicenow";

const items: { kind: ExportKind; label: string; note: string }[] = [
  { kind: "json", label: "Model file (JSON)", note: "Back up, move or version it" },
  { kind: "svg-dark", label: "Image, dark (SVG)", note: "For docs and slides" },
  { kind: "svg-light", label: "Image, light (SVG)", note: "For docs and slides" },
  { kind: "archimate", label: "ArchiMate model (XML)", note: "Open in Archi or another ArchiMate tool" },
  { kind: "drawio", label: "draw.io / Lucidchart (.drawio)", note: "Open in draw.io, or import into Lucidchart" },
  { kind: "servicenow", label: "ServiceNow import (Excel)", note: "One sheet per CMDB table, plus relationships" },
];

/** Disclosure menu: a button that shows the export actions. Escape or a click outside closes it. */
export function ExportMenu({
  onExport,
  buttonClass,
  notes = {},
}: {
  onExport: (k: ExportKind) => void;
  buttonClass: string;
  /** Extra line under an item, e.g. the Lucid plan fit for the draw.io export. */
  notes?: Partial<Record<ExportKind, string>>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();

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
      <button ref={button} type="button" className={buttonClass} aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
        <ToolbarIcon name="export" />
        Export <span aria-hidden="true">▾</span>
      </button>
      <ul id={listId} hidden={!open} className="absolute left-0 z-20 mt-1 w-60 border border-border-strong bg-surface-raised py-1">
        {items.map((it) => (
          <li key={it.kind}>
            <button
              type="button"
              className="flex w-full cursor-pointer flex-col px-3 py-2 text-left hover:bg-surface hover:text-accent focus-visible:bg-surface"
              onClick={() => {
                setOpen(false);
                button.current?.focus();
                onExport(it.kind);
              }}
            >
              <span className="text-sm text-ink">{it.label}</span>
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
  );
}
