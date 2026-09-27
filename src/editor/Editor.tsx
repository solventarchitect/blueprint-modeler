"use client";

import "@xyflow/react/dist/base.css";
import {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge as FlowEdge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { classById, classes, type ClassId } from "@/metamodel";
import { ClassNode, type ClassFlowNode } from "./ClassNode";
import { Inspector } from "./Inspector";
import { Palette } from "./Palette";
import { connectionProblem } from "./state";
import { useModelDocument, type SaveStatus } from "./useModelDocument";

const nodeTypes = { csdm: ClassNode };
const newId = () => crypto.randomUUID();

const statusText: Record<SaveStatus, string> = {
  loading: "Opening…",
  saving: "Saving…",
  saved: "Saved in this browser",
  "memory-only": "Not saved: this browser blocks storage. Export to keep your work.",
  error: "Could not save. Export to keep your work.",
};

const toolbarButton =
  "cursor-pointer border border-border-strong px-2.5 py-1 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60";

function useIsWide() {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

function EditorInner() {
  const doc = useModelDocument();
  const { model, dispatch } = doc;
  const wide = useIsWide();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusName, setFocusName] = useState(0);
  const [message, setMessage] = useState("");
  const drag = useRef<Record<string, { x: number; y: number }>>({});
  const [dragTick, setDragTick] = useState(0);

  // Undo / redo from the keyboard, except while typing in a field (native undo applies there).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: "undo" });
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        dispatch({ type: "redo" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dispatch]);

  // Selection must point at something that still exists (after undo or delete).
  useEffect(() => {
    if (selectedId && !model.nodes.some((n) => n.id === selectedId)) setSelectedId(null);
  }, [model.nodes, selectedId]);

  const nodes: ClassFlowNode[] = useMemo(
    () =>
      model.nodes.map((n) => ({
        id: n.id,
        type: "csdm",
        position: drag.current[n.id] ?? model.layout[n.id] ?? { x: 0, y: 0 },
        data: { name: n.name, cls: n.class },
        selected: n.id === selectedId,
        ariaLabel: `${classById(n.class)?.label ?? n.class}: ${n.name || "Untitled"}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag is a ref; dragTick re-runs this
    [model, selectedId, dragTick],
  );

  const edges: FlowEdge[] = useMemo(
    () =>
      model.edges.map((e) => {
        // Route each edge between facing handles: downward edges leave the bottom, upward the top.
        const down = (model.layout[e.from]?.y ?? 0) <= (model.layout[e.to]?.y ?? 0);
        return {
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: down ? "bottom" : "top",
        targetHandle: down ? "top" : "bottom",
        label: e.type.startsWith("reference:") ? "reference" : e.type.split("::")[0],
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-strong)" },
        ariaLabel: `${e.type} from ${model.nodes.find((n) => n.id === e.from)?.name} to ${model.nodes.find((n) => n.id === e.to)?.name}`,
        };
      }),
    [model],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<ClassFlowNode>[]) => {
      for (const c of changes) {
        if (c.type === "position") {
          if (c.dragging && c.position) {
            drag.current = { ...drag.current, [c.id]: c.position };
            setDragTick((n) => n + 1);
          } else {
            const pos = c.position ?? drag.current[c.id];
            const { [c.id]: _done, ...rest } = drag.current;
            void _done;
            drag.current = rest;
            if (pos) dispatch({ type: "move-node", id: c.id, x: pos.x, y: pos.y });
          }
        } else if (c.type === "select") {
          if (c.selected) setSelectedId(c.id);
          else setSelectedId((cur) => (cur === c.id ? null : cur));
        } else if (c.type === "remove") {
          dispatch({ type: "delete-node", id: c.id });
        }
      }
    },
    [dispatch],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const c of changes) if (c.type === "remove") dispatch({ type: "delete-edge", id: c.id });
    },
    [dispatch],
  );

  const onConnect = useCallback(
    (c: Connection) => {
      const problem = connectionProblem(model, c.source, c.target);
      if (problem) {
        setMessage(problem);
        return;
      }
      dispatch({ type: "add-edge", id: newId(), from: c.source, to: c.target });
      setMessage("Relationship added.");
    },
    [model, dispatch],
  );

  const addNode = (cls: ClassId) => {
    const id = newId();
    const label = classes.find((c) => c.id === cls)!.label;
    dispatch({ type: "add-node", id, class: cls, name: `New ${label.toLowerCase()}` });
    setSelectedId(id);
    setFocusName((n) => n + 1);
    setMessage(`${label} added. Type its name.`);
  };

  return (
    <div className="flex h-[calc(100dvh-4.75rem)] min-h-[32rem] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Open model</span>
          <select
            className="max-w-56 border border-border-strong bg-surface px-2 py-1 text-sm text-ink"
            value={model.id}
            onChange={(e) => {
              setSelectedId(null);
              void doc.open(e.target.value);
            }}
          >
            {doc.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || "Untitled model"}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={toolbarButton} onClick={() => void doc.newModel()}>
          New model
        </button>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <button type="button" className={toolbarButton} disabled={!doc.canUndo} onClick={() => dispatch({ type: "undo" })} aria-keyshortcuts="Control+Z">
          Undo
        </button>
        <button type="button" className={toolbarButton} disabled={!doc.canRedo} onClick={() => dispatch({ type: "redo" })} aria-keyshortcuts="Control+Shift+Z">
          Redo
        </button>
        <p className="ml-auto text-xs text-ink-muted" data-testid="save-status">
          {statusText[doc.status]}
        </p>
      </div>

      {doc.problem && (
        <div role="alert" className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-2 text-sm">
          <span>{doc.problem}</span>
          <button type="button" className={toolbarButton} onClick={doc.dismissProblem}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {wide && (
          <aside className="w-56 shrink-0 overflow-y-auto border-r border-border" aria-label="Palette">
            <Palette onAdd={addNode} />
          </aside>
        )}

        <div className="relative min-w-0 flex-1" aria-label="Model canvas" role="region">
          <ReactFlow<ClassFlowNode, FlowEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            connectionMode={ConnectionMode.Loose}
            nodesDraggable={wide}
            nodesConnectable={wide}
            deleteKeyCode={wide ? ["Delete", "Backspace"] : null}
            fitView
            fitViewOptions={{ maxZoom: 1 }}
            minZoom={0.2}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={32} color="var(--grid-line)" />
            <Controls showInteractive={false} />
          </ReactFlow>
          {model.nodes.length === 0 && (
            <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-ink-muted">
              {wide ? "Add an element from the palette to start." : "This model is empty."}
            </p>
          )}
        </div>

        {wide ? (
          <aside className="w-80 shrink-0 overflow-y-auto border-l border-border" aria-label="Inspector">
            <Inspector model={model} selectedId={selectedId} dispatch={dispatch} focusName={focusName} onSelect={setSelectedId} newId={newId} />
          </aside>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-1.5 text-xs text-ink-muted">
        <p role="status" aria-live="polite">
          {message}
        </p>
        <p>{wide ? "Your models are stored only in this browser." : "Editing needs a screen at least 768px wide. You can view and pan here."}</p>
      </div>
    </div>
  );
}

export function Editor() {
  return (
    <ReactFlowProvider>
      <EditorInner />
    </ReactFlowProvider>
  );
}
