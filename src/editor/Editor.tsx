"use client";

import "@xyflow/react/dist/base.css";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge as FlowEdge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { examples } from "@/examples";
import { archimateElements, lenses, readLens, saveLens, type Lens } from "@/frameworks";
import { downloadText } from "@/io/download";
import { exportJson, fileBase, importJson, MAX_FILE_CHARS } from "@/io/file";
import { modelToArchimateXml } from "@/io/archimate";
import { modelToSvg } from "@/io/svg";
import { layerBoxes, layerLanes, settleIntoLane } from "@/layout/bands";
import { edgeSides } from "@/layout/geometry";
import { autoLayout, DEFAULT_SIZE } from "@/layout/layout";
import { createWorkerEngine } from "@/layout/worker-engine";
import { classById, classes, isClassId, type ClassId } from "@/metamodel";
import { evaluateHints, type HintResult } from "@/model";
import { ClassNode, type ClassFlowNode } from "./ClassNode";
import { ConnectionLine, ConnectionModelContext } from "./ConnectionLine";
import { ExportMenu, type ExportKind } from "./ExportMenu";
import { LayerOverlay } from "./LayerOverlay";
import { DEFAULT_VIEW, readView, saveView, ViewMenu, type ViewOptions } from "./ViewMenu";
import { HintsPanel } from "./HintsPanel";
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
  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 border border-border-strong bg-surface-raised px-2.5 text-sm text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60";
const toolbarSelect = "min-h-8 max-w-60 border border-border-strong bg-surface-raised px-2 text-sm text-ink";

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

type Tab = "details" | "hints";

function EditorInner() {
  const doc = useModelDocument();
  const { model, dispatch } = doc;
  const wide = useIsWide();
  const flow = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusName, setFocusName] = useState(0);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("details");
  const [view, setViewState] = useState<ViewOptions>(DEFAULT_VIEW);
  useEffect(() => setViewState(readView()), []);
  const setView = (v: ViewOptions) => {
    setViewState(v);
    saveView(v);
  };
  const [presenting, setPresenting] = useState(false);
  const [step, setStep] = useState(0);
  const presentButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const [lens, setLensState] = useState<Lens>("csdm");
  useEffect(() => setLensState(readLens()), []);
  const setLens = (l: Lens) => {
    setLensState(l);
    saveLens(l);
  };
  const [activeHint, setActiveHint] = useState<HintResult | null>(null);
  const drag = useRef<Record<string, { x: number; y: number }>>({});
  const [dragTick, setDragTick] = useState(0);
  // Measured node sizes. The canvas is controlled, so every rebuilt node must carry its size, or
  // React Flow hides it until it is measured again (nodes vanished while dragging).
  const measured = useRef<Record<string, { width: number; height: number }>>({});
  const [layingOut, setLayingOut] = useState(false);
  const [ioError, setIoError] = useState<string | null>(null);
  const engine = useRef<ReturnType<typeof createWorkerEngine> | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => engine.current?.dispose(), []);

  const hints = useMemo(() => evaluateHints(model), [model]);
  const hintLevel = useMemo(() => {
    const level = new Map<string, "warning" | "info">();
    for (const h of hints) for (const id of h.nodeIds) if (level.get(id) !== "warning") level.set(id, h.hint.severity);
    return level;
  }, [hints]);
  const highlighted = useMemo(() => new Set(activeHint?.nodeIds ?? []), [activeHint]);

  // A focused hint that no longer applies (fixed, undone, model switched) stops highlighting.
  useEffect(() => {
    if (activeHint && !hints.some((h) => h.id === activeHint.id)) setActiveHint(null);
  }, [hints, activeHint]);

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

  useEffect(() => {
    if (selectedId && !model.nodes.some((n) => n.id === selectedId)) setSelectedId(null);
  }, [model.nodes, selectedId]);

  const nodes: ClassFlowNode[] = useMemo(
    () =>
      model.nodes.map((n) => ({
        id: n.id,
        type: "csdm",
        position: drag.current[n.id] ?? model.layout[n.id] ?? { x: 0, y: 0 },
        measured: measured.current[n.id],
        data: {
          name: n.name,
          cls: n.class,
          hint: hintLevel.get(n.id),
          highlight: highlighted.has(n.id),
          alt: lens === "archimate" && isClassId(n.class) ? { type: archimateElements[n.class].type, label: archimateElements[n.class].label } : undefined,
        },
        selected: n.id === selectedId,
        ariaLabel: `${classById(n.class)?.label ?? n.class}: ${n.name || "Untitled"}${hintLevel.get(n.id) ? " (has hints)" : ""}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag and measured are refs; dragTick re-runs this
    [model, selectedId, dragTick, hintLevel, highlighted, lens],
  );

  const hintedEdges = useMemo(() => new Set(activeHint?.edgeIds ?? []), [activeHint]);
  const edges: FlowEdge[] = useMemo(
    () =>
      model.edges.map((e) => {
        const a = model.layout[e.from] ?? { x: 0, y: 0 };
        const b = model.layout[e.to] ?? { x: 0, y: 0 };
        const [sourceHandle, targetHandle] = edgeSides(a, b);
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          sourceHandle,
          targetHandle,
          label: e.type.startsWith("reference:") ? "reference" : e.type.split("::")[0],
          className: hintedEdges.has(e.id) ? "hinted" : undefined,
          markerEnd: { type: MarkerType.ArrowClosed, color: hintedEdges.has(e.id) ? "var(--status)" : "var(--border-strong)" },
          ariaLabel: `${e.type} from ${model.nodes.find((n) => n.id === e.from)?.name} to ${model.nodes.find((n) => n.id === e.to)?.name}`,
        };
      }),
    [model, hintedEdges],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<ClassFlowNode>[]) => {
      for (const c of changes) {
        if (c.type === "dimensions") {
          if (c.dimensions) {
            const prev = measured.current[c.id];
            if (prev?.width !== c.dimensions.width || prev?.height !== c.dimensions.height) {
              measured.current = { ...measured.current, [c.id]: c.dimensions };
              setDragTick((n) => n + 1);
            }
          }
        } else if (c.type === "position") {
          if (c.dragging && c.position) {
            drag.current = { ...drag.current, [c.id]: c.position };
            setDragTick((n) => n + 1);
          } else {
            const pos = c.position ?? drag.current[c.id];
            const { [c.id]: _done, ...rest } = drag.current;
            void _done;
            drag.current = rest;
            if (pos) {
              const kept = view.lanes ? settleIntoLane(model, measured.current, c.id, pos) : { ...pos, settled: false, lane: undefined };
              dispatch({ type: "move-node", id: c.id, x: kept.x, y: kept.y });
              if (kept.settled) setMessage(`Kept in the ${kept.lane} lane.`);
            }
          }
        } else if (c.type === "select") {
          if (c.selected) {
            setSelectedId(c.id);
            setTab("details");
          } else setSelectedId((cur) => (cur === c.id ? null : cur));
        } else if (c.type === "remove") {
          dispatch({ type: "delete-node", id: c.id });
        }
      }
    },
    [dispatch, view.lanes, model],
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
    dispatch({ type: "add-node", id, class: cls, name: `New ${label}` });
    setSelectedId(id);
    setTab("details");
    setFocusName((n) => n + 1);
    setMessage(`${label} added. Type its name.`);
  };

  const focusHint = (r: HintResult) => {
    setActiveHint((cur) => (cur?.id === r.id ? null : r));
    if (r.nodeIds.length) void flow.fitView({ nodes: r.nodeIds.map((id) => ({ id })), maxZoom: 1, duration: 300, padding: 0.4 });
    setMessage(`${r.hint.title}: ${r.message}`);
  };

  const loadExample = async (exampleId: string) => {
    const ex = examples.find((e) => e.id === exampleId);
    if (!ex) return;
    setSelectedId(null);
    setActiveHint(null);
    await doc.createFrom(ex.create());
    setMessage(`Opened the example “${ex.name}” as a new model.`);
    setTimeout(() => void flow.fitView({ maxZoom: 1, padding: 0.15 }), 50);
  };

  const runLayout = async () => {
    if (model.nodes.length === 0 || layingOut) return;
    setLayingOut(true);
    setMessage("Laying out by CSDM layer…");
    try {
      engine.current ??= createWorkerEngine();
      const sizes = Object.fromEntries(
        flow.getNodes().map((n) => [n.id, { width: n.measured?.width ?? DEFAULT_SIZE.width, height: n.measured?.height ?? DEFAULT_SIZE.height }]),
      );
      dispatch({ type: "set-layout", layout: await autoLayout(engine.current, model, sizes) });
      setMessage("Laid out by CSDM layer. Undo restores the previous positions.");
      setTimeout(() => void flow.fitView({ maxZoom: 1, padding: 0.15, duration: 300 }), 50);
    } catch {
      setMessage("Auto-layout failed. Your positions are unchanged.");
    } finally {
      setLayingOut(false);
    }
  };

  const importFile = async (file: File) => {
    setIoError(null);
    if (file.size > MAX_FILE_CHARS * 4) {
      setIoError("The file is too large to be a Blueprint Modeler model (over 5 MB).");
      return;
    }
    const r = importJson(await file.text(), new Set(doc.models.map((m) => m.id)));
    if (!r.ok) {
      setIoError(`Could not import “${file.name}”. ${r.error} Nothing was changed.`);
      return;
    }
    setSelectedId(null);
    setActiveHint(null);
    await doc.createFrom(r.model);
    const warn = r.issues.length ? ` ${r.issues.length} relationship${r.issues.length === 1 ? " breaks" : "s break"} the CSDM rules; see Hints.` : "";
    setMessage(`Imported “${r.model.name || "Untitled model"}”${r.copied ? " as a copy (a model with the same id is already here)" : ""}.${warn}`);
    setTimeout(() => void flow.fitView({ maxZoom: 1, padding: 0.15 }), 50);
  };

  const exportAs = (kind: ExportKind) => {
    if (kind === "json") {
      const f = exportJson(model);
      downloadText(f.filename, f.text, "application/json");
      setMessage(`Exported ${f.filename}.`);
    } else if (kind === "archimate") {
      const filename = `${fileBase(model)}-archimate.xml`;
      downloadText(filename, modelToArchimateXml(model), "application/xml");
      setMessage(`Exported ${filename}. In Archi: File › Import › Open Exchange XML Model.`);
    } else {
      const theme = kind === "svg-dark" ? "dark" : "light";
      const filename = `${fileBase(model)}-${theme}.svg`;
      downloadText(filename, modelToSvg(model, theme, { lens }), "image/svg+xml");
      setMessage(`Exported ${filename}.`);
    }
  };

  // Boxes and lanes follow elements live while they are dragged.
  const liveModel = useMemo(
    () => (Object.keys(drag.current).length ? { ...model, layout: { ...model.layout, ...drag.current } } : model),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag is a ref; dragTick re-runs this
    [model, dragTick],
  );
  const boxes = useMemo(
    () => layerBoxes(liveModel, measured.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measured is a ref; dragTick re-runs this
    [liveModel, dragTick],
  );
  const lanes = useMemo(
    () => layerLanes(liveModel, measured.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measured is a ref; dragTick re-runs this
    [liveModel, dragTick],
  );

  // Present mode: the canvas alone, full screen, stepping through the model layer by layer.
  const steps = useMemo(() => [{ name: "Overview", nodeIds: [] as string[] }, ...boxes.map((b) => ({ name: b.name, nodeIds: b.nodeIds }))], [boxes]);
  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(i, steps.length - 1));
      setStep(next);
      const target = steps[next]!;
      void flow.fitView(target.nodeIds.length ? { nodes: target.nodeIds.map((id) => ({ id })), padding: 0.25, maxZoom: 1.25, duration: 400 } : { padding: 0.12, maxZoom: 1, duration: 400 });
    },
    [steps, flow],
  );
  const startPresenting = () => {
    setSelectedId(null);
    setActiveHint(null);
    setPresenting(true);
    setStep(0);
    try {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    } catch {
      // Full screen refused: present mode still fills the window.
    }
    setTimeout(() => {
      exitButton.current?.focus();
      void flow.fitView({ padding: 0.12, maxZoom: 1, duration: 300 });
    }, 60);
  };
  const stopPresenting = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setTimeout(() => {
      presentButton.current?.focus();
      void flow.fitView({ maxZoom: 1, padding: 0.15 });
    }, 60);
  }, [flow]);
  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        stopPresenting();
      } else if (e.key === " " && (e.target as HTMLElement | null)?.closest("button")) {
        // Space on a focused button presses that button.
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        goTo(step + 1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goTo(step - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      }
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement) stopPresenting();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [presenting, step, goTo, stopPresenting]);

  const selected = model.nodes.find((n) => n.id === selectedId);
  const scopedHints = selected ? hints.filter((h) => h.nodeIds.includes(selected.id)) : hints;
  const warnings = hints.filter((h) => h.hint.severity === "warning").length;

  const onTabKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next: Tab = tab === "details" ? "hints" : "details";
      setTab(next);
      document.getElementById(`tab-${next}`)?.focus();
    }
  };

  return (
    <div className={presenting ? "fixed inset-0 z-50 flex flex-col bg-surface" : "flex h-[calc(100dvh-3.5rem)] min-h-[34rem] flex-col bg-surface"}>
      {presenting && (
        <div role="region" aria-label="Presentation" className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <p className="font-mono text-xs tracking-[0.14em] text-accent uppercase">Presenting</p>
          <h1 className="text-sm font-medium">{model.name || "Untitled model"}</h1>
          <p className="text-sm text-ink-muted" aria-live="polite" data-testid="present-step">
            {steps[step]?.name} · {step + 1} of {steps.length}
          </p>
          <span className="ml-auto flex gap-2">
            <button type="button" className={toolbarButton} disabled={step === 0} onClick={() => goTo(step - 1)} aria-keyshortcuts="ArrowLeft">
              <span aria-hidden="true">←</span> Previous
            </button>
            <button type="button" className={toolbarButton} disabled={step >= steps.length - 1} onClick={() => goTo(step + 1)} aria-keyshortcuts="ArrowRight">
              Next <span aria-hidden="true">→</span>
            </button>
            <button ref={exitButton} type="button" className={toolbarButton} onClick={stopPresenting} aria-keyshortcuts="Escape">
              Exit
            </button>
          </span>
        </div>
      )}
      <div className={`flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 ${presenting ? "hidden" : ""}`}>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Open model</span>
          {/* Fixed width: a long model name must not re-wrap the toolbar after the canvas has been fitted. */}
          <select
            className={`${toolbarSelect} w-44`}
            value={model.id}
            onChange={(e) => {
              setSelectedId(null);
              setActiveHint(null);
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
        <label className="flex items-center text-sm">
          <span className="sr-only">Start from an example</span>
          <select className={toolbarSelect} value="" onChange={(e) => void loadExample(e.target.value)}>
            <option value="">Start from an example…</option>
            {examples.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <button type="button" className={toolbarButton} disabled={!doc.canUndo} onClick={() => dispatch({ type: "undo" })} aria-keyshortcuts="Control+Z">
          Undo
        </button>
        <button type="button" className={toolbarButton} disabled={!doc.canRedo} onClick={() => dispatch({ type: "redo" })} aria-keyshortcuts="Control+Shift+Z">
          Redo
        </button>
        {wide && (
          <button type="button" className={toolbarButton} disabled={layingOut || model.nodes.length === 0} aria-busy={layingOut} onClick={() => void runLayout()}>
            {layingOut ? "Laying out…" : "Auto-layout"}
          </button>
        )}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {wide && (
          <>
            <button type="button" className={toolbarButton} onClick={() => fileInput.current?.click()}>
              Import…
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              className="hidden"
              data-testid="import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importFile(f);
              }}
            />
          </>
        )}
        <ExportMenu onExport={exportAs} buttonClass={toolbarButton} />
        <ViewMenu value={view} onChange={setView} buttonClass={toolbarButton} />
        <button ref={presentButton} type="button" className={toolbarButton} disabled={model.nodes.length === 0} onClick={startPresenting}>
          Present
        </button>
        <label className="flex items-center text-sm">
          <span className="sr-only">Framework lens</span>
          <select className={toolbarSelect} value={lens} onChange={(e) => setLens(e.target.value as Lens)} data-testid="lens-select">
            {lenses.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {wide && (
          <button
            type="button"
            className={toolbarButton}
            onClick={() => {
              setSelectedId(null);
              setTab("hints");
            }}
          >
            Hints
            <span className={`min-w-5 rounded-full px-1.5 font-mono text-xs ${warnings ? "bg-status text-accent-ink" : "bg-border text-ink"}`}>{hints.length}</span>
          </button>
        )}
        {/* The widest routine status reserves its width, so "Saving…" ↔ "Saved" never re-wraps the toolbar (and moves the canvas). */}
        <p className="ml-auto grid text-right text-xs text-ink-muted">
          <span aria-hidden="true" className="invisible col-start-1 row-start-1">
            {statusText.saved}
          </span>
          <span className="col-start-1 row-start-1" data-testid="save-status">
            {statusText[doc.status]}
          </span>
        </p>
      </div>

      {ioError && !presenting && (
        <div role="alert" className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-2 text-sm">
          <span>{ioError}</span>
          <button type="button" className={toolbarButton} onClick={() => setIoError(null)}>
            Dismiss
          </button>
        </div>
      )}
      {doc.problem && !presenting && (
        <div role="alert" className="flex items-center justify-between gap-2 border-b border-border bg-surface-raised px-4 py-2 text-sm">
          <span>{doc.problem}</span>
          <button type="button" className={toolbarButton} onClick={doc.dismissProblem}>
            Dismiss
          </button>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {wide && !presenting && (
          <aside className="w-60 shrink-0 overflow-y-auto border-r border-border" aria-label="Palette">
            <Palette onAdd={addNode} lens={lens} />
          </aside>
        )}

        <div className="relative min-w-0 flex-1 bg-canvas" aria-label="Model canvas" role="region">
          <ConnectionModelContext.Provider value={model}>
            <ReactFlow<ClassFlowNode, FlowEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={(c) => connectionProblem(model, c.source, c.target) === null}
              onConnectEnd={(_, state) => {
                // Refused connections never reach onConnect, so explain them here.
                if (state.fromNode && state.toNode && !state.isValid) setMessage(connectionProblem(model, state.fromNode.id, state.toNode.id) ?? "");
              }}
              connectionLineComponent={ConnectionLine}
              onPaneClick={() => setActiveHint(null)}
              connectionMode={ConnectionMode.Loose}
              nodesDraggable={wide && !presenting}
              nodesConnectable={wide && !presenting}
              elementsSelectable={!presenting}
              deleteKeyCode={wide && !presenting ? ["Delete", "Backspace"] : null}
              snapToGrid={view.snap}
              snapGrid={[16, 16]}
              fitView
              fitViewOptions={{ maxZoom: 1, padding: 0.15 }}
              minZoom={0.2}
            >
              <Background id="minor" variant={BackgroundVariant.Lines} gap={32} color="var(--canvas-grid)" />
              <Background id="major" variant={BackgroundVariant.Lines} gap={160} color="var(--canvas-grid-major)" />
              {!presenting && <Controls showInteractive={false} />}
              <LayerOverlay boxes={boxes} lanes={lanes} showBoxes={view.boxes || presenting} showLanes={view.lanes} />
            </ReactFlow>
          </ConnectionModelContext.Provider>
          {model.nodes.length === 0 && doc.status !== "loading" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto max-h-full max-w-lg overflow-y-auto border border-border bg-surface-raised p-6">
                <p className="font-mono text-xs tracking-[0.14em] text-accent uppercase">{"// Empty model"}</p>
                <h2 className="mt-2 text-lg font-semibold">Start from the palette, or open an example</h2>
                <ul className="mt-4 flex flex-col gap-2">
                  {examples.map((ex) => (
                    <li key={ex.id}>
                      <button type="button" onClick={() => void loadExample(ex.id)} className="w-full cursor-pointer border border-border p-3 text-left hover:border-accent">
                        <span className="block text-sm font-medium text-ink">{ex.name}</span>
                        <span className="mt-1 block text-xs text-ink-muted">{ex.summary}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {wide && !presenting && (
          <aside className="flex w-80 shrink-0 flex-col border-l border-border" aria-label="Inspector">
            <div role="tablist" aria-label="Panel" className="flex border-b border-border" onKeyDown={onTabKey}>
              {(["details", "hints"] as const).map((t) => (
                <button
                  key={t}
                  id={`tab-${t}`}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  aria-controls={`panel-${t}`}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)}
                  className={`flex-1 cursor-pointer px-3 py-2 text-sm ${tab === t ? "border-b-2 border-accent font-medium text-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  {t === "details" ? "Details" : `Hints (${scopedHints.length})`}
                </button>
              ))}
            </div>
            <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
              {tab === "details" ? (
                <Inspector model={model} selectedId={selectedId} dispatch={dispatch} focusName={focusName} onSelect={setSelectedId} newId={newId} lens={lens} />
              ) : (
                <HintsPanel results={scopedHints} activeId={activeHint?.id ?? null} onFocus={focusHint} scopeName={selected?.name} />
              )}
            </div>
          </aside>
        )}
      </div>

      <div className={`${presenting ? "hidden" : "flex"} flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-1.5 text-xs text-ink-muted`}>
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
