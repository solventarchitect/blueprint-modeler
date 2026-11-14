"use client";

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useViewport } from "@xyflow/react";
import { MAX_NOTE_CHARS, noteAt, type Model, type Note } from "@/model";

/** A note's width on the canvas, in canvas pixels. */
export const NOTE_WIDTH = 208;
/** How far an arrow key moves a note; with Shift, four times as far. */
const STEP = 16;

/** M93: a note not yet in the model: where it will go, and the element it will be attached to. */
export type NoteDraft = { x: number; y: number; attachTo?: string };

/** What a note says to a screen reader: "Note on Shop: Who owns this?". */
export const noteLabel = (model: Model, note: Note) => {
  const on = note.attachedTo ? model.nodes.find((n) => n.id === note.attachedTo) : undefined;
  return `Note${on ? ` on ${on.name || "Untitled"}` : ""}: ${note.text || "(empty)"}`;
};

function NoteEditor({ initial, label, onCommit, onCancel }: { initial: string; label: string; onCommit: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const done = useRef(false);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) onCommit(text);
    else onCancel();
  };
  return (
    <textarea
      aria-label={label}
      // The note being written takes focus at once.
      autoFocus
      maxLength={MAX_NOTE_CHARS}
      rows={4}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          finish(true);
        }
      }}
      className="nopan nodrag nowheel block w-full resize-none border-0 bg-transparent p-0 text-sm text-ink outline-none"
    />
  );
}

/**
 * M93: the model's notes on the canvas, drawn in canvas coordinates (inside the viewport), over the
 * elements. A note is a sticky with a status-colored edge; one attached to an element names it and
 * moves with it. When `editable`, a note is a button: Enter or a double-click edits it in place
 * (Ctrl+Enter or leaving keeps the text, Escape puts it back), Delete deletes it, the arrow keys move
 * it (Shift: further), dragging moves it, and the context menu key or a right-click opens its menu.
 */
export function NotesLayer({
  model,
  layout,
  hidden,
  editable,
  editing,
  draft,
  onEditing,
  onAdd,
  onText,
  onMove,
  onDelete,
  onMenu,
}: {
  model: Model;
  /** Where each element is right now (mid-drag included), so an attached note follows. */
  layout: Model["layout"];
  /** Elements not drawn (a collapsed group, the state shown): their notes aren't either. */
  hidden: ReadonlySet<string>;
  editable: boolean;
  /** The note being edited in place. */
  editing: string | null;
  draft: NoteDraft | null;
  onEditing: (id: string | null) => void;
  onAdd: (draft: NoteDraft, text: string) => void;
  onText: (id: string, text: string) => void;
  onMove: (id: string, x: number, y: number) => void;
  onDelete: (id: string, el: HTMLElement) => void;
  onMenu: (id: string, x: number, y: number, el: HTMLElement) => void;
}) {
  const { zoom } = useViewport();
  // A drag in progress: the note and how far it has gone, in canvas pixels.
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const start = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const where = { layout } as Pick<Model, "layout">;

  const box = "nopan nodrag nowheel pointer-events-auto absolute border border-border-strong border-l-4 border-l-[var(--status)] bg-surface-raised px-2.5 py-2 text-left text-sm text-ink shadow-sm";
  const caption = (note: Pick<Note, "attachedTo">) => {
    const on = note.attachedTo ? model.nodes.find((n) => n.id === note.attachedTo) : undefined;
    return (
      <span aria-hidden="true" className="mb-1 block font-mono text-[0.6rem] tracking-[0.12em] text-ink-muted uppercase">
        {on ? `Note · on ${on.name || "Untitled"}` : "Note"}
      </span>
    );
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>, id: string) => {
    if (!editable || e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = { id, x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = (e.clientX - s.x) / zoom;
    const dy = (e.clientY - s.y) / zoom;
    if (!s.moved && Math.hypot(dx, dy) < 3) return;
    s.moved = true;
    setDrag({ id: s.id, dx, dy });
  };
  const onPointerUp = (note: Note) => {
    const s = start.current;
    start.current = null;
    if (s?.moved && drag) {
      const at = noteAt(where, note);
      onMove(note.id, at.x + drag.dx, at.y + drag.dy);
    }
    setDrag(null);
  };
  const onKeyDown = (e: ReactKeyboardEvent<HTMLElement>, note: Note) => {
    const step = e.shiftKey ? STEP * 4 : STEP;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (move) {
      e.preventDefault();
      e.stopPropagation();
      const at = noteAt(where, note);
      onMove(note.id, at.x + move[0]!, at.y + move[1]!);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      e.stopPropagation();
      onEditing(note.id);
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      e.stopPropagation();
      onDelete(note.id, e.currentTarget);
    } else if (e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      const r = e.currentTarget.getBoundingClientRect();
      onMenu(note.id, r.left + r.width / 2, r.top + r.height / 2, e.currentTarget);
    }
  };

  return (
    <div data-testid="notes-layer">
      {(model.notes ?? []).map((note) => {
        if (note.attachedTo && hidden.has(note.attachedTo)) return null;
        const at = noteAt(where, note);
        const d = drag?.id === note.id ? drag : null;
        const style = { left: 0, top: 0, width: NOTE_WIDTH, transform: `translate(${at.x + (d?.dx ?? 0)}px, ${at.y + (d?.dy ?? 0)}px)`, zIndex: 5 };
        if (editing === note.id) {
          return (
            <div key={note.id} data-note={note.id} className={box} style={style}>
              {caption(note)}
              <NoteEditor
                initial={note.text}
                label={`Edit the note${note.attachedTo ? ` on ${model.nodes.find((n) => n.id === note.attachedTo)?.name || "Untitled"}` : ""}`}
                onCommit={(text) => {
                  onEditing(null);
                  onText(note.id, text);
                }}
                onCancel={() => onEditing(null)}
              />
            </div>
          );
        }
        if (!editable) {
          return (
            <div key={note.id} data-note={note.id} role="note" aria-label={noteLabel(model, note)} className={box} style={style}>
              {caption(note)}
              <span className="block whitespace-pre-wrap break-words">{note.text}</span>
            </div>
          );
        }
        return (
          <button
            key={note.id}
            type="button"
            data-note={note.id}
            aria-label={noteLabel(model, note)}
            aria-keyshortcuts="Enter Delete ArrowUp ArrowDown ArrowLeft ArrowRight Shift+F10"
            className={`${box} cursor-grab focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${d ? "cursor-grabbing opacity-90" : ""}`}
            style={style}
            onPointerDown={(e) => onPointerDown(e, note.id)}
            onPointerMove={onPointerMove}
            onPointerUp={() => onPointerUp(note)}
            onPointerCancel={() => {
              start.current = null;
              setDrag(null);
            }}
            onDoubleClick={() => onEditing(note.id)}
            onKeyDown={(e) => onKeyDown(e, note)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onMenu(note.id, e.clientX, e.clientY, e.currentTarget);
            }}
          >
            {caption(note)}
            <span className="block whitespace-pre-wrap break-words">{note.text}</span>
          </button>
        );
      })}
      {draft && (
        <div data-note="" className={box} style={{ left: 0, top: 0, width: NOTE_WIDTH, transform: `translate(${draft.x}px, ${draft.y}px)`, zIndex: 6 }}>
          {caption({ attachedTo: draft.attachTo })}
          <NoteEditor
            initial=""
            label={`New note${draft.attachTo ? ` on ${model.nodes.find((n) => n.id === draft.attachTo)?.name || "Untitled"}` : ""}`}
            onCommit={(text) => onAdd(draft, text)}
            onCancel={() => onAdd(draft, "")}
          />
        </div>
      )}
    </div>
  );
}
