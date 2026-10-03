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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import { examples } from "@/examples";
import { archimateElements, archimateRelationshipFor, edgeNotation, lenses, readLens, saveLens, showsArchimate, type ArchimateRelationshipType, type Lens } from "@/frameworks";
import { downloadText } from "@/io/download";
import { exportJson, fileBase, importJson, MAX_FILE_CHARS } from "@/io/file";
import { modelToArchimateXml } from "@/io/archimate";
import { modelToDrawioFile } from "@/io/drawio";
import { lucidFit, lucidFitMessage, lucidFitNote } from "@/io/lucid";
import { modelToServiceNowXlsx } from "@/io/servicenow";
import { modelToSvg } from "@/io/svg";
import { LAYERS, layerBoxes, layerLanes, settleIntoLane } from "@/layout/bands";
import { edgeSides } from "@/layout/geometry";
import { distributeEvenly } from "@/layout/distribute";
import { autoLayout, DEFAULT_SIZE } from "@/layout/layout";
import { createWorkerEngine } from "@/layout/worker-engine";
import { classById, classes, isClassId, type ClassId, type Layer } from "@/metamodel";
import { blastRadius, evaluateHints, type BlastDirection, type HintResult } from "@/model";
import { site } from "@/lib/site";
import { ClassNode, SuggestContext, type ClassFlowNode } from "./ClassNode";
import { ConnectionLine, ConnectionModelContext } from "./ConnectionLine";
import { ExportMenu, type ExportKind } from "./ExportMenu";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { blastAnnouncement, blastProgress, blastSteps, blastView } from "./blast";
import { CanvasEdge, LabelObstacles } from "./CanvasEdge";
import { ModelManager } from "./ModelManager";
import { ToolbarIcon } from "./ToolbarIcon";
import { CanvasTitle } from "./CanvasTitle";
import { LayerOverlay, layerHandleId, type LayerHandlers } from "./LayerOverlay";
import { DEFAULT_VIEW, readView, saveView, ViewMenu, type ViewOptions } from "./ViewMenu";
import { HintsPanel } from "./HintsPanel";
import { markerId, NotationLegend, NotationMarkers, type EdgeTone } from "./Notation";
import { ReadPanel } from "./ReadPanel";
import { readModel, type Sentence } from "./reading";
import { Inspector } from "./Inspector";
import { Palette } from "./Palette";
import { connectionProblem, modernEdge, SLOT } from "./state";
import { suggestions, type Suggestion } from "./suggest";
import { useModelDocument, type SaveStatus } from "./useModelDocument";

const nodeTypes = { csdm: ClassNode };
const edgeTypes = { csdm: CanvasEdge };
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
/** Whole-model fits leave room above the diagram for the canvas title (see CanvasTitle). */
const fitPadding = (p: number) => ({ x: p, bottom: p, top: "120px" }) as const;
/**
 * Blast-radius step controls: aria-disabled rather than disabled, so the button keeps focus when the
 * last (or first) hop is reached (a disabled button drops focus to the page).
 */
const stepButton = `${toolbarButton} aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:border-border-strong aria-disabled:hover:text-ink`;
/** Status bar links: a 24px-tall target even at the bar's small text size. */
const footerLink = "inline-flex min-h-6 items-center text-accent underline underline-offset-4 hover:opacity-90";
/** The one filled button: Present. */
const primaryButton =
  "inline-flex min-h-8 cursor-pointer items-center gap-1.5 border border-accent bg-accent px-3 text-sm font-medium text-accent-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
/** Toolbar groups (Model, Edit, Arrange, Lens): a caption on wide screens, a divider between groups. */
const toolbarGroup = "flex flex-wrap items-center gap-1.5";
const groupCaption = "mr-0.5 hidden font-mono text-[0.65rem] tracking-[0.14em] text-ink-muted uppercase min-[1840px]:inline";
const toolbarDivider = "h-6 w-px bg-border-strong/50";
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

type Tab = "details" | "hints" | "read";
const TABS: readonly Tab[] = ["details", "hints", "read"];

const withIndefinite = (label: string) => `${/^[AEIOU]/.test(label) ? "an" : "a"} ${label}`;

/** Blast radius auto-play: time on each hop. */
const BLAST_STEP_MS = 1500;
const prefersStill = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function EditorInner() {
  const doc = useModelDocument();
  const { model, dispatch } = doc;
  const wide = useIsWide();
  const flow = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusName, setFocusName] = useState(0);
  const [focusConnect, setFocusConnect] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState<Layer | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [reveal, setReveal] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; label: string; items: MenuItem[] } | null>(null);
  const menuReturn = useRef<HTMLElement | null>(null);
  const layerDrag = useRef<{ layer: Layer; x: number; y: number; zoom: number; origin: Record<string, { x: number; y: number }>; moved: boolean } | null>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("details");
  const [view, setViewState] = useState<ViewOptions>(DEFAULT_VIEW);
  useEffect(() => setViewState(readView()), []);
  const setView = (v: ViewOptions) => {
    setViewState(v);
    saveView(v);
  };
  const [managing, setManaging] = useState(false);
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
  // The open model's id, readable after an await (Auto-layout checks it before applying its result).
  const openModelId = useRef(model.id);
  useEffect(() => {
    openModelId.current = model.id;
  }, [model.id]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => engine.current?.dispose(), []);

  const hints = useMemo(() => evaluateHints(model), [model]);
  const hintLevel = useMemo(() => {
    const level = new Map<string, "warning" | "info">();
    for (const h of hints) for (const id of h.nodeIds) if (level.get(id) !== "warning") level.set(id, h.hint.severity);
    return level;
  }, [hints]);
  // The relationship chosen in the Read tab: highlighted like a hint's elements and relationships.
  const [readEdgeId, setReadEdgeId] = useState<string | null>(null);
  const readEdge = model.edges.find((e) => e.id === readEdgeId);
  const highlighted = useMemo(
    () => new Set([...(activeHint?.nodeIds ?? []), ...(readEdge ? [readEdge.from, readEdge.to] : [])]),
    [activeHint, readEdge],
  );

  // Blast radius: view-only. The radius follows the model, so an edit while it is open updates it.
  const [blast, setBlast] = useState<{ start: string; direction: BlastDirection; step: number; playing: boolean } | null>(null);
  const blastReturn = useRef<HTMLElement | null>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const radius = useMemo(() => (blast ? blastRadius(model, blast.start, blast.direction) : null), [model, blast?.start, blast?.direction]); // eslint-disable-line react-hooks/exhaustive-deps -- step and playing do not change the radius
  const blastShown = useMemo(() => (blast && radius ? blastView(model, radius, blast.step) : null), [model, radius, blast]);

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

  // Elements directly connected to the selected one, highlighted with their relationships.
  const neighbors = useMemo(() => {
    const set = new Set<string>();
    if (!selectedId) return set;
    for (const e of model.edges) {
      if (e.from === selectedId) set.add(e.to);
      if (e.to === selectedId) set.add(e.from);
    }
    set.delete(selectedId);
    return set;
  }, [model.edges, selectedId]);

  const blastLabel = (id: string) => {
    const b = blastShown?.nodes.get(id);
    if (!b || !blast) return "";
    const impact = blast.direction === "impact";
    if (b.hop === 0) return impact ? " (failed: start of the blast radius)" : " (start of the dependencies view)";
    return impact ? ` (affected at hop ${b.hop})` : ` (needed at hop ${b.hop})`;
  };
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
          // While a blast radius is open it is the only highlight on the canvas.
          hint: blastShown ? undefined : hintLevel.get(n.id),
          highlight: !blastShown && highlighted.has(n.id),
          neighbor: !blastShown && neighbors.has(n.id),
          blast: blastShown?.nodes.has(n.id) ? { ...blastShown.nodes.get(n.id)!, impact: blast!.direction === "impact" } : undefined,
          description: n.attrs?.description,
          alt: showsArchimate(lens) && isClassId(n.class) ? { type: archimateElements[n.class].type, label: archimateElements[n.class].label, layer: archimateElements[n.class].layer } : undefined,
          archimateOnly: lens === "archimate-only",
          suggest: wide && !presenting && !blastShown && !dismissed.has(n.id) && !model.edges.some((e) => e.from === n.id || e.to === n.id),
        },
        selected: n.id === selectedId,
        ariaLabel: `${classById(n.class)?.label ?? n.class}: ${n.name || "Untitled"}${!blastShown && hintLevel.get(n.id) ? " (has hints)" : ""}${!blastShown && neighbors.has(n.id) ? " (connected to the selected element)" : ""}${blastLabel(n.id)}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag and measured are refs; dragTick re-runs this
    [model, selectedId, dragTick, hintLevel, highlighted, lens, wide, presenting, dismissed, neighbors, blastShown],
  );

  const hintedEdges = useMemo(() => new Set([...(activeHint?.edgeIds ?? []), ...(readEdge ? [readEdge.id] : [])]), [activeHint, readEdge]);
  const edges: FlowEdge[] = useMemo(
    () =>
      model.edges.map((e) => {
        const carried = blastShown?.edges.get(e.id);
        const connected = !blastShown && !!selectedId && (e.from === selectedId || e.to === selectedId);
        // ArchiMate-only lens: the ArchiMate relationship's name and notation (line style, and the
        // decoration on each end ArchiMate puts it). Other lenses: the CSDM type with a plain arrow.
        const classOf = (id: string) => model.nodes.find((n) => n.id === id)?.class ?? "";
        const am = lens === "archimate-only" ? edgeNotation(archimateRelationshipFor(classOf(e.from), classOf(e.to))) : undefined;
        const a = model.layout[e.from] ?? { x: 0, y: 0 };
        const b = model.layout[e.to] ?? { x: 0, y: 0 };
        const [sourceHandle, targetHandle] = edgeSides(a, b);
        const hinted = !blastShown && hintedEdges.has(e.id);
        const tone: EdgeTone = carried || hinted ? "status" : connected ? "neighbor" : "line";
        return {
          id: e.id,
          type: "csdm",
          source: e.from,
          target: e.to,
          sourceHandle,
          targetHandle,
          label: am ? am.type : e.type.startsWith("reference:") ? "reference" : e.type.split("::")[0],
          className: carried
            ? `blast${carried.current ? " blast-now" : ""}${carried.forward ? "" : " blast-reverse"}`
            : hinted
              ? "hinted"
              : connected
                ? "connected"
                : undefined,
          ...(am
            ? {
                // The flowing blast dash replaces the notation's dash while that hop is current.
                style: am.dash && !carried?.current ? { strokeDasharray: am.dash } : undefined,
                markerStart: am.atFrom ? markerId(am.atFrom, tone) : undefined,
                markerEnd: am.atTo ? markerId(am.atTo, tone) : undefined,
              }
            : {
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: tone === "status" ? "var(--status)" : tone === "neighbor" ? "var(--neighbor)" : "var(--border-strong)",
                },
              }),
          ariaLabel: `${e.type} from ${model.nodes.find((n) => n.id === e.from)?.name} to ${model.nodes.find((n) => n.id === e.to)?.name}${carried ? " (carries impact)" : ""}`,
        };
      }),
    [model, hintedEdges, selectedId, lens, blastShown],
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
    setReveal(id);
    setMessage(`${label} added. Type its name.`);
  };

  const focusHint = (r: HintResult) => {
    setReadEdgeId(null);
    setActiveHint((cur) => (cur?.id === r.id ? null : r));
    if (r.nodeIds.length) void flow.fitView({ nodes: r.nodeIds.map((id) => ({ id })), maxZoom: 1, duration: 300, padding: 0.4 });
    setMessage(`${r.hint.title}: ${r.message}`);
  };

  // Read tab: choosing a sentence highlights its relationship (again clears it) and brings both ends into view.
  const focusRead = (sentence: Sentence) => {
    setActiveHint(null);
    const off = readEdgeId === sentence.edgeId;
    setReadEdgeId(off ? null : sentence.edgeId);
    if (!off) void flow.fitView({ nodes: [{ id: sentence.subjectId }, { id: sentence.objectId }], maxZoom: 1, duration: 300, padding: 0.4 });
    setMessage(off ? "Relationship no longer highlighted." : sentence.text);
  };

  const loadExample = async (exampleId: string) => {
    const ex = examples.find((e) => e.id === exampleId);
    if (!ex) return;
    setSelectedId(null);
    setActiveHint(null);
    await doc.createFrom(ex.create());
    if (ex.lens) setLens(ex.lens);
    setMessage(`Opened the example “${ex.name}” as a new model.${ex.lens ? ` Lens: ${lenses.find((l) => l.id === ex.lens)?.label}.` : ""}`);
    setTimeout(() => void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15) }), 50);
  };

  // "Blank model" closes the empty-state card for this model and moves focus to the palette.
  const [blankFor, setBlankFor] = useState<string | null>(null);
  const startBlank = () => {
    setBlankFor(model.id);
    setMessage("Blank model ready. Add an element from the palette.");
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('nav[aria-label="Element palette"] button')?.focus());
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
      const layout = await autoLayout(engine.current, model, sizes);
      // Another model may have opened while the layout ran; examples share element ids, so a stale
      // layout would move that model's elements.
      if (openModelId.current !== model.id) {
        setMessage("Auto-layout stopped: another model opened while it ran. Nothing was moved.");
        return;
      }
      dispatch({ type: "set-layout", layout });
      setMessage("Laid out by CSDM layer. Undo restores the previous positions.");
      setTimeout(() => void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15), duration: 300 }), 50);
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
    setTimeout(() => void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15) }), 50);
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
    } else if (kind === "servicenow") {
      const filename = `${fileBase(model)}-servicenow.xlsx`;
      downloadText(filename, modelToServiceNowXlsx(model) as Uint8Array<ArrayBuffer>, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      setMessage(`Exported ${filename}. Its README sheet explains the import into ServiceNow.`);
    } else if (kind === "drawio") {
      const filename = `${fileBase(model)}.drawio`;
      void modelToDrawioFile(model, { lens }).then((text) => {
        downloadText(filename, text, "application/vnd.jgraph.mxfile");
        setMessage(`Exported ${filename}. In Lucidchart: Import › draw.io. ${lucidFitMessage(lucidFit(model))}`);
      });
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

  // A new element can land in its lane outside the visible canvas: pan to it (same zoom) once it
  // has been measured, so it is never added out of sight.
  useEffect(() => {
    if (!reveal) return;
    const n = flow.getInternalNode(reveal);
    const w = n?.measured.width;
    const h = n?.measured.height;
    if (!n || !w || !h) return; // not measured yet; dragTick re-runs this
    setReveal(null);
    const box = document.querySelector(".react-flow")?.getBoundingClientRect();
    if (!box) return;
    const { x, y, zoom } = flow.getViewport();
    const p = n.internals.positionAbsolute;
    const [left, top] = [p.x * zoom + x, p.y * zoom + y];
    // Pan only as far as needed, so the elements already in view mostly stay there.
    const margin = 24;
    const shift = (start: number, size: number, room: number) => (start < margin ? margin - start : start + size > room - margin ? room - margin - (start + size) : 0);
    const dx = shift(left, w * zoom, box.width);
    const dy = shift(top, h * zoom, box.height);
    if (dx || dy) void flow.setViewport({ x: x + dx, y: y + dy, zoom }, { duration: 300 });
  }, [reveal, dragTick, flow]);

  // Layers: select one by its label, then drag it (or its box) or use the arrow keys to move it
  // with everything in it. A move is one undo step.
  const layerName = (layer: Layer) => LAYERS.find((l) => l.id === layer)!.name;
  const layerIds = (layer: Layer) => boxes.find((b) => b.layer === layer)?.nodeIds ?? [];
  const moveLayerBy = (layer: Layer, dx: number, dy: number) => {
    const ids = layerIds(layer);
    if (ids.length === 0) return;
    dispatch({ type: "set-layout", layout: Object.fromEntries(ids.map((id) => [id, { x: model.layout[id]!.x + dx, y: model.layout[id]!.y + dy }])) });
    setMessage(`Moved the ${layerName(layer)} layer.`);
  };
  const layerHandlers: LayerHandlers = {
    selected: selectedLayer,
    onPointerDown: (layer, e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const fromHandle = e.currentTarget.dataset.testid === "layer-handle";
      const origin = Object.fromEntries(layerIds(layer).map((id) => [id, model.layout[id]!]));
      layerDrag.current = { layer, x: e.clientX, y: e.clientY, zoom: flow.getZoom(), origin, moved: false };
      const move = (ev: PointerEvent) => {
        const d = layerDrag.current;
        if (!d || (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) < 4)) return;
        d.moved = true;
        let dx = (ev.clientX - d.x) / d.zoom;
        let dy = (ev.clientY - d.y) / d.zoom;
        if (view.snap) [dx, dy] = [Math.round(dx / 16) * 16, Math.round(dy / 16) * 16];
        drag.current = Object.fromEntries(Object.entries(d.origin).map(([id, p]) => [id, { x: p.x + dx, y: p.y + dy }]));
        setDragTick((n) => n + 1);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        const d = layerDrag.current;
        layerDrag.current = null;
        if (d?.moved) {
          dispatch({ type: "set-layout", layout: drag.current });
          drag.current = {};
          setDragTick((n) => n + 1);
          setSelectedLayer(layer);
          setMessage(`Moved the ${layerName(layer)} layer.`);
        } else if (fromHandle) {
          setSelectedLayer((cur) => (cur === layer ? null : layer));
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    // Pointer presses select in pointerup; this handles Enter and Space (detail 0).
    onClick: (layer, e) => {
      if (e.detail === 0) setSelectedLayer((cur) => (cur === layer ? null : layer));
    },
    onKeyDown: (layer, e) => {
      const step = e.shiftKey ? 64 : 16;
      const arrows: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const d = arrows[e.key];
      if (d) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedLayer(layer);
        moveLayerBy(layer, d[0], d[1]);
      } else if (e.key === "Escape" && selectedLayer) {
        e.stopPropagation();
        setSelectedLayer(null);
      } else if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        openMenu(r.left, r.bottom, `${layerName(layer)} layer menu`, layerMenu(layer), e.currentTarget);
      }
    },
    onContextMenu: (layer, e: ReactMouseEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu(e.clientX, e.clientY, `${layerName(layer)} layer menu`, layerMenu(layer), e.currentTarget);
    },
  };
  useEffect(() => {
    if (selectedLayer && !boxes.some((b) => b.layer === selectedLayer)) setSelectedLayer(null);
  }, [boxes, selectedLayer]);

  // Suggestions for an element with no relationships: on the canvas beside it, and in the Inspector.
  const pickSuggestion = (nodeId: string, s: Suggestion) => {
    const anchor = model.nodes.find((n) => n.id === nodeId);
    if (!anchor) return;
    const anchorName = anchor.name || "Untitled";
    if (s.kind === "existing") {
      dispatch({ type: "add-edge", id: newId(), from: s.from, to: s.to, edgeType: s.type });
      setMessage(`Related ${anchorName} and ${s.name} (${s.type}).`);
      return;
    }
    const id = newId();
    dispatch({ type: "add-related", id, class: s.cls, name: `New ${s.classLabel}`, edgeId: newId(), relatedTo: nodeId, outgoing: s.outgoing, edgeType: s.type });
    selectNode(id);
    setReveal(id);
    setFocusName((k) => k + 1);
    setMessage(`Added ${withIndefinite(s.classLabel)} related to ${anchorName}. Type its name.`);
  };
  const suggestCtx = {
    list: (nodeId: string) => suggestions(model, nodeId),
    pick: pickSuggestion,
    dismiss: (nodeId: string) => setDismissed((d) => new Set(d).add(nodeId)),
  };

  // Right-click menus, built for what was clicked.
  const openMenu = (x: number, y: number, label: string, items: MenuItem[], returnTo: HTMLElement | null) => {
    menuReturn.current = returnTo;
    setMenu({ x, y, label, items });
  };
  const closeMenu = useCallback((restoreFocus: boolean) => {
    setMenu(null);
    const el = menuReturn.current;
    if (restoreFocus && el?.isConnected) setTimeout(() => !document.querySelector("[data-testid=context-menu]") && el.focus(), 0);
  }, []);
  const selectNode = (id: string) => {
    setSelectedId(id);
    setTab("details");
  };
  const focusLayerHandle = (layer: Layer) => setTimeout(() => document.getElementById(layerHandleId(layer))?.focus(), 0);
  const nodeMenu = (id: string): MenuItem[] => {
    const n = model.nodes.find((x) => x.id === id);
    if (!n) return [];
    const name = n.name || "Untitled";
    const count = hints.filter((h) => h.nodeIds.includes(id)).length;
    const layer = classById(n.class)?.layer;
    return [
      { kind: "item", label: "Rename", onSelect: () => (selectNode(id), setFocusName((k) => k + 1)) },
      { kind: "item", label: "Add a relationship…", onSelect: () => (selectNode(id), setFocusConnect((k) => k + 1)) },
      {
        kind: "item",
        label: "Duplicate",
        onSelect: () => {
          const copy = newId();
          dispatch({ type: "add-node", id: copy, class: n.class as ClassId, name: `${name} (copy)` });
          selectNode(copy);
          setReveal(copy);
          setMessage(`Duplicated ${name}. Relationships are not copied.`);
        },
      },
      { kind: "item", label: count ? `Show hints (${count})` : "No hints", disabled: count === 0, onSelect: () => (setSelectedId(id), setTab("hints")) },
      { kind: "item", label: "Show blast radius", onSelect: () => openBlast(id, menuReturn.current) },
      ...(layer && (view.boxes || view.lanes)
        ? [{ kind: "item" as const, label: `Select the ${layerName(layer)} layer`, onSelect: () => (setSelectedLayer(layer), focusLayerHandle(layer)) }]
        : []),
      { kind: "separator" },
      { kind: "item", label: "Delete", danger: true, onSelect: () => (dispatch({ type: "delete-node", id }), setMessage(`Deleted ${name}. Undo restores it.`)) },
    ];
  };
  const edgeMenu = (id: string): MenuItem[] => {
    const e = model.edges.find((x) => x.id === id);
    if (!e) return [];
    const fix = modernEdge(model, e);
    const name = (nid: string) => model.nodes.find((n) => n.id === nid)?.name || "Untitled";
    return [
      ...(fix
        ? [
            {
              kind: "item" as const,
              label: `Update to CSDM 5 (${fix.type})`,
              onSelect: () => {
                dispatch({ type: "update-edge", id, from: fix.from, to: fix.to, edgeType: fix.type });
                setMessage(`Updated to ${fix.type}${fix.from !== e.from ? ", drawn from " + name(fix.from) : ""}.`);
              },
            },
            { kind: "separator" as const },
          ]
        : []),
      { kind: "item", label: `Select ${name(e.from)}`, onSelect: () => selectNode(e.from) },
      { kind: "item", label: `Select ${name(e.to)}`, onSelect: () => selectNode(e.to) },
      { kind: "separator" },
      { kind: "item", label: "Delete relationship", danger: true, onSelect: () => (dispatch({ type: "delete-edge", id }), setMessage("Deleted the relationship. Undo restores it.")) },
    ];
  };
  const layerMenu = (layer: Layer): MenuItem[] => {
    const ids = layerIds(layer);
    return [
      { kind: "item", label: "Zoom to layer", disabled: ids.length === 0, onSelect: () => void flow.fitView({ nodes: ids.map((id) => ({ id })), padding: 0.3, maxZoom: 1.25, duration: 300 }) },
      { kind: "item", label: selectedLayer === layer ? "Deselect layer" : "Select layer", onSelect: () => setSelectedLayer(selectedLayer === layer ? null : layer) },
      {
        kind: "item",
        label: "Distribute evenly",
        disabled: ids.length < 2,
        onSelect: () => {
          const layout = distributeEvenly(model, ids, SLOT);
          if (layout) dispatch({ type: "set-layout", layout });
          setMessage(layout ? `Spread the ${layerName(layer)} layer evenly.` : `The ${layerName(layer)} layer is already evenly spread.`);
        },
      },
      { kind: "separator" },
      {
        kind: "item",
        label: `Delete ${ids.length} element${ids.length === 1 ? "" : "s"} in this layer`,
        danger: true,
        disabled: ids.length === 0,
        onSelect: () => {
          dispatch({ type: "delete-nodes", ids });
          setSelectedLayer(null);
          setMessage(`Deleted ${ids.length} element${ids.length === 1 ? "" : "s"} from the ${layerName(layer)} layer. Undo restores them.`);
        },
      },
    ];
  };
  const paneMenu = (): MenuItem[] => [
    { kind: "item", label: "Undo", disabled: !doc.canUndo, onSelect: () => dispatch({ type: "undo" }) },
    { kind: "item", label: "Redo", disabled: !doc.canRedo, onSelect: () => dispatch({ type: "redo" }) },
    { kind: "separator" },
    { kind: "item", label: "Fit view", onSelect: () => void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15), duration: 300 }) },
    { kind: "item", label: "Auto-layout", disabled: model.nodes.length === 0 || layingOut, onSelect: () => void runLayout() },
    { kind: "separator" },
    { kind: "check", label: "Layer boxes", checked: view.boxes, onSelect: () => setView({ ...view, boxes: !view.boxes }) },
    { kind: "check", label: "Lanes", checked: view.lanes, onSelect: () => setView({ ...view, lanes: !view.lanes }) },
    { kind: "check", label: "Snap to grid", checked: view.snap, onSelect: () => setView({ ...view, snap: !view.snap }) },
  ];
  const canMenu = wide && !presenting;
  const labelOf = (id: string) => {
    const n = model.nodes.find((x) => x.id === id);
    return `${n?.name || "Untitled"} menu`;
  };
  const onCanvasKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!canMenu || !(e.key === "ContextMenu" || (e.shiftKey && e.key === "F10"))) return;
    const t = e.target as HTMLElement;
    e.preventDefault();
    const nodeEl = t.closest<HTMLElement>(".react-flow__node");
    const edgeEl = t.closest<HTMLElement>(".react-flow__edge");
    if (nodeEl?.dataset.id) {
      const r = nodeEl.getBoundingClientRect();
      openMenu(r.left + 8, r.bottom + 4, labelOf(nodeEl.dataset.id), nodeMenu(nodeEl.dataset.id), nodeEl);
    } else if (edgeEl?.dataset.id) {
      const r = edgeEl.getBoundingClientRect();
      openMenu(r.left + r.width / 2, r.top + r.height / 2, "Relationship menu", edgeMenu(edgeEl.dataset.id), edgeEl);
    } else {
      const r = e.currentTarget.getBoundingClientRect();
      openMenu(r.left + r.width / 2, r.top + r.height / 2, "Canvas menu", paneMenu(), t);
    }
  };

  // Blast radius: the start element, then each hop it reaches, played or stepped by hand.
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  const openBlast = (id: string, returnTo: HTMLElement | null, direction: BlastDirection = "impact", moveFocus = true) => {
    const r = blastRadius(model, id, direction);
    // Reduced motion: no playing; the whole radius at once.
    const still = prefersStill();
    blastReturn.current = returnTo;
    setActiveHint(null);
    setReadEdgeId(null);
    setBlast({ start: id, direction, step: still ? r.steps.length - 1 : 0, playing: !still && r.steps.length > 1 });
    setMessage(blastAnnouncement(r, 0, nameOf));
    const ids = r.steps.flatMap((st) => st.nodeIds);
    void flow.fitView({ nodes: ids.map((n) => ({ id: n })), padding: 0.3, maxZoom: 1, duration: still ? 0 : 300 });
    if (moveFocus) setTimeout(() => playButton.current?.focus(), 0);
  };
  const blastTo = (step: number, playing = false) => {
    if (!blast || !radius) return;
    const k = Math.max(0, Math.min(step, radius.steps.length - 1));
    setBlast({ ...blast, step: k, playing });
    setMessage(blastAnnouncement(radius, k, nameOf));
  };
  const closeBlast = useCallback(() => {
    setBlast(null);
    setMessage("Blast radius closed.");
    const el = blastReturn.current;
    blastReturn.current = null;
    if (el?.isConnected) setTimeout(() => el.focus(), 0);
  }, []);
  // Auto-play: one hop every BLAST_STEP_MS, stopping on the last.
  useEffect(() => {
    if (!blast?.playing || !radius) return;
    const last = radius.steps.length - 1;
    if (blast.step >= last) {
      setBlast({ ...blast, playing: false });
      return;
    }
    const t = setTimeout(() => {
      setBlast({ ...blast, step: blast.step + 1 });
      setMessage(blastAnnouncement(radius, blast.step + 1, nameOf));
    }, BLAST_STEP_MS);
    return () => clearTimeout(t);
  }, [blast, radius]); // eslint-disable-line react-hooks/exhaustive-deps -- nameOf reads the same model as radius
  // It closes when its element is deleted or another model opens.
  useEffect(() => {
    if (blast && !model.nodes.some((n) => n.id === blast.start)) setBlast(null);
  }, [model.nodes, blast]);
  useEffect(() => {
    setBlast(null);
    blastReturn.current = null;
  }, [model.id]);
  // An edit can shorten the radius under the open view: stay on its last hop.
  useEffect(() => {
    if (blast && radius && blast.step > radius.steps.length - 1) {
      setBlast({ ...blast, step: radius.steps.length - 1, playing: false });
      setMessage(blastAnnouncement(radius, radius.steps.length - 1, nameOf));
    }
  }, [blast, radius]); // eslint-disable-line react-hooks/exhaustive-deps -- nameOf reads the same model as radius
  // Escape closes it, unless a menu, dialog or text field has the key.
  useEffect(() => {
    if (!blast || menu || managing) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      closeBlast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blast, menu, managing, closeBlast]);

  // Present mode: the canvas alone, full screen, stepping through the model layer by layer.
  const steps = useMemo(() => [{ name: "Overview", nodeIds: [] as string[] }, ...boxes.map((b) => ({ name: b.name, nodeIds: b.nodeIds }))], [boxes]);
  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(i, steps.length - 1));
      setStep(next);
      const target = steps[next]!;
      void flow.fitView(target.nodeIds.length ? { nodes: target.nodeIds.map((id) => ({ id })), padding: 0.25, maxZoom: 1.25, duration: 400 } : { padding: fitPadding(0.12), maxZoom: 1, duration: 400 });
    },
    [steps, flow],
  );
  const startPresenting = () => {
    setBlast(null);
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
      void flow.fitView({ padding: fitPadding(0.12), maxZoom: 1, duration: 300 });
    }, 60);
  };
  const stopPresenting = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setTimeout(() => {
      presentButton.current?.focus();
      void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15) });
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
  const scopedWarnings = scopedHints.filter((h) => h.hint.severity === "warning").length;
  const reading = useMemo(() => readModel(model, lens, selectedId), [model, lens, selectedId]);
  // ArchiMate-only lens: the relationship types on the canvas, for the notation legend.
  const legendTypes = useMemo(() => {
    const types = new Set<ArchimateRelationshipType>();
    if (lens !== "archimate-only") return types;
    const classOf = (id: string) => model.nodes.find((n) => n.id === id)?.class ?? "";
    for (const e of model.edges) types.add(edgeNotation(archimateRelationshipFor(classOf(e.from), classOf(e.to))).type);
    return types;
  }, [model, lens]);

  const onTabKey = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const i = TABS.indexOf(tab);
      const next = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]!;
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
        <div role="group" aria-label="Model" className={toolbarGroup}>
        <span className={groupCaption} aria-hidden="true">
          Model
        </span>
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
        <button type="button" className={toolbarButton} onClick={() => setManaging(true)}>
          <ToolbarIcon name="manage" />
          Manage…
        </button>
        <button type="button" className={toolbarButton} onClick={() => void doc.newModel()} aria-label="New model">
          <ToolbarIcon name="new" />
          New
        </button>
        <label className="flex items-center text-sm">
          <span className="sr-only">Start from an example</span>
          {/* Fixed width, like the model picker: a long example name must not re-wrap the toolbar. */}
          <select className={`${toolbarSelect} w-36`} value="" onChange={(e) => {
              const v = e.target.value;
              if (v === "__blank") {
                setSelectedId(null);
                setActiveHint(null);
                void doc.newModel().then(() => setMessage("Opened a new blank model."));
              } else void loadExample(v);
            }}>
            <option value="">Examples…</option>
            <option value="__blank">Blank model</option>
            {examples.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </label>
        {wide && (
          <>
            <button type="button" className={toolbarButton} onClick={() => fileInput.current?.click()}>
              <ToolbarIcon name="import" />
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
        <ExportMenu onExport={exportAs} buttonClass={toolbarButton} notes={{ drawio: lucidFitNote(lucidFit(model)) }} />
        </div>
        <span className={toolbarDivider} aria-hidden="true" />
        <div role="group" aria-label="Edit" className={toolbarGroup}>
          <span className={groupCaption} aria-hidden="true">
            Edit
          </span>
          {/* Undo and Redo as one joined pair. */}
          <span className="inline-flex">
            <button type="button" className={toolbarButton} disabled={!doc.canUndo} onClick={() => dispatch({ type: "undo" })} aria-keyshortcuts="Control+Z">
              <ToolbarIcon name="undo" />
              Undo
            </button>
            <button type="button" className={`${toolbarButton} -ml-px`} disabled={!doc.canRedo} onClick={() => dispatch({ type: "redo" })} aria-keyshortcuts="Control+Shift+Z">
              <ToolbarIcon name="redo" />
              Redo
            </button>
          </span>
        </div>
        <span className={toolbarDivider} aria-hidden="true" />
        <div role="group" aria-label="Arrange" className={toolbarGroup}>
          <span className={groupCaption} aria-hidden="true">
            Arrange
          </span>
          {wide && (
            <button type="button" className={toolbarButton} disabled={layingOut || model.nodes.length === 0} aria-busy={layingOut} onClick={() => void runLayout()}>
              <ToolbarIcon name="layout" />
              {layingOut ? "Laying out…" : "Auto-layout"}
            </button>
          )}
          <ViewMenu value={view} onChange={setView} buttonClass={toolbarButton} />
        </div>
        <span className={toolbarDivider} aria-hidden="true" />
        <div role="group" aria-label="Lens" className={toolbarGroup}>
          <span className={groupCaption} aria-hidden="true">
            Lens
          </span>
          <label className="flex items-center text-sm">
            <span className="sr-only">Framework lens</span>
            <select className={`${toolbarSelect} w-44`} value={lens} onChange={(e) => setLens(e.target.value as Lens)} data-testid="lens-select">
              {lenses.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button ref={presentButton} type="button" className={primaryButton} disabled={model.nodes.length === 0} onClick={startPresenting}>
          <ToolbarIcon name="present" />
          Present
        </button>
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

      {blast && radius && !presenting && (
        <div role="region" aria-label="Blast radius" className="flex flex-col gap-1.5 border-b border-border px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs tracking-[0.14em] text-status uppercase">Blast radius</p>
            <h2 className="text-sm font-medium">{blast.direction === "impact" ? `If ${nameOf(blast.start)} fails` : `What ${nameOf(blast.start)} needs`}</h2>
            <div role="group" aria-label="Direction" className="inline-flex">
              {(["impact", "dependencies"] as const).map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={blast.direction === d}
                  className={`${toolbarButton} ${i ? "-ml-px" : ""} aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-accent-ink aria-pressed:hover:text-accent-ink`}
                  onClick={() => blast.direction !== d && openBlast(blast.start, blastReturn.current, d, false)}
                >
                  {d === "impact" ? "Impact" : "Dependencies"}
                </button>
              ))}
            </div>
            <p className="text-sm text-ink-muted" data-testid="blast-progress">
              {blastProgress(radius, blast.step)}
            </p>
            <span className="ml-auto flex flex-wrap gap-2">
              <button type="button" className={stepButton} aria-label="Previous step" aria-disabled={blast.step === 0} onClick={() => blast.step > 0 && blastTo(blast.step - 1)}>
                <span aria-hidden="true">←</span> Previous
              </button>
              <button
                ref={playButton}
                type="button"
                className={stepButton}
                aria-disabled={radius.steps.length < 2}
                onClick={() =>
                  radius.steps.length < 2
                    ? undefined
                    : blast.playing ? setBlast({ ...blast, playing: false }) : blast.step >= radius.steps.length - 1 ? blastTo(0, true) : setBlast({ ...blast, playing: true })
                }
              >
                {blast.playing ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                className={stepButton}
                aria-label="Next step"
                aria-disabled={blast.step >= radius.steps.length - 1}
                onClick={() => blast.step < radius.steps.length - 1 && blastTo(blast.step + 1)}
              >
                Next <span aria-hidden="true">→</span>
              </button>
              <button type="button" className={toolbarButton} onClick={closeBlast} aria-keyshortcuts="Escape">
                Close
              </button>
            </span>
          </div>
          <details className="text-sm">
            <summary className="inline-flex min-h-6 cursor-pointer items-center text-ink-muted hover:text-ink">Steps ({radius.steps.length})</summary>
            <ol aria-label="Steps" className="mt-1 flex max-h-40 flex-col gap-0.5 overflow-y-auto">
              {blastSteps(radius, nameOf).map((st) => (
                <li key={st.hop} className={st.hop === blast.step ? "font-medium text-ink" : "text-ink-soft"} aria-current={st.hop === blast.step ? "step" : undefined}>
                  <span className="font-mono text-xs text-ink-muted">{st.label}:</span> {st.names.join(", ")}
                </li>
              ))}
            </ol>
            {radius.truncated && <p className="mt-1 text-xs text-ink-muted">Stopped after {radius.steps.length - 1} hops; more elements lie beyond.</p>}
            <p className="mt-1 text-xs text-ink-muted">
              Follows the impact rules in the{" "}
              <Link className="text-accent underline underline-offset-4" href="/guide#impact">
                guide
              </Link>
              . Not ServiceNow&apos;s Impacted Services calculation.
            </p>
          </details>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {wide && !presenting && (
          <aside className="w-60 shrink-0 overflow-y-auto border-r border-border" aria-label="Palette">
            <Palette onAdd={addNode} lens={lens} extended={view.extended} />
          </aside>
        )}

        <div className="relative min-w-0 flex-1 bg-canvas" aria-label="Model canvas" role="region" onKeyDown={onCanvasKeyDown}>
          <ConnectionModelContext.Provider value={model}>
          <SuggestContext.Provider value={suggestCtx}>
          <LabelObstacles boxes={boxes} tabsAbove={canMenu} show={(view.boxes || presenting) && !view.lanes}>
            <ReactFlow<ClassFlowNode, FlowEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={(c) => connectionProblem(model, c.source, c.target) === null}
              onConnectEnd={(_, state) => {
                // Refused connections never reach onConnect, so explain them here.
                if (state.fromNode && state.toNode && !state.isValid) setMessage(connectionProblem(model, state.fromNode.id, state.toNode.id) ?? "");
              }}
              connectionLineComponent={ConnectionLine}
              onConnectStart={(_, { nodeId }) => {
                const from = model.nodes.find((n) => n.id === nodeId);
                if (!from) return;
                const count = model.nodes.filter((n) => n.id !== from.id && connectionProblem(model, from.id, n.id) === null).length;
                setMessage(
                  count
                    ? `Drop on an outlined element: ${count} can take a relationship from ${from.name || "this element"}.`
                    : `Nothing on the canvas can take a relationship drawn from ${from.name || "this element"}. Try drawing it from the other element, or add one from the palette.`,
                );
              }}
              onPaneClick={() => {
                setActiveHint(null);
                setSelectedLayer(null);
              }}
              onNodeContextMenu={
                canMenu
                  ? (e, node) => {
                      e.preventDefault();
                      openMenu(e.clientX, e.clientY, labelOf(node.id), nodeMenu(node.id), e.currentTarget as HTMLElement);
                    }
                  : undefined
              }
              onEdgeContextMenu={
                canMenu
                  ? (e, edge) => {
                      e.preventDefault();
                      openMenu(e.clientX, e.clientY, "Relationship menu", edgeMenu(edge.id), null);
                    }
                  : undefined
              }
              onPaneContextMenu={
                canMenu
                  ? (e) => {
                      e.preventDefault();
                      openMenu(e.clientX, e.clientY, "Canvas menu", paneMenu(), null);
                    }
                  : undefined
              }
              // Only a pan or zoom by the user closes a menu; programmatic moves (fit, focus auto-pan) keep it.
              onMoveStart={(e) => e && closeMenu(false)}
              connectionMode={ConnectionMode.Loose}
              nodesDraggable={wide && !presenting}
              nodesConnectable={wide && !presenting}
              elementsSelectable={!presenting}
              deleteKeyCode={wide && !presenting ? ["Delete", "Backspace"] : null}
              snapToGrid={view.snap}
              snapGrid={[16, 16]}
              fitView
              fitViewOptions={{ maxZoom: 1, padding: fitPadding(0.15) }}
              minZoom={0.2}
            >
              <NotationMarkers />
              <NotationLegend types={legendTypes} />
              <Background id="minor" variant={BackgroundVariant.Lines} gap={32} color="var(--canvas-grid)" />
              <Background id="major" variant={BackgroundVariant.Lines} gap={160} color="var(--canvas-grid-major)" />
              {!presenting && <Controls showInteractive={false} fitViewOptions={{ maxZoom: 1, padding: fitPadding(0.15) }} />}
              <LayerOverlay boxes={boxes} lanes={lanes} showBoxes={view.boxes || presenting} showLanes={view.lanes} handlers={canMenu ? layerHandlers : undefined} />
              <CanvasTitle name={model.name} boxes={boxes} tabsAbove={view.boxes && !view.lanes && canMenu} decorative={presenting} />
            </ReactFlow>
          </LabelObstacles>
          </SuggestContext.Provider>
          </ConnectionModelContext.Provider>
          {model.nodes.length === 0 && doc.status !== "loading" && blankFor !== model.id && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div className="pointer-events-auto max-h-full max-w-lg overflow-y-auto border border-border bg-surface-raised p-6">
                <p className="font-mono text-xs tracking-[0.14em] text-accent uppercase">{"// Empty model"}</p>
                <h2 className="mt-2 text-lg font-semibold">Start blank, or open an example</h2>
                <ul className="mt-4 flex flex-col gap-2">
                  <li>
                    <button type="button" onClick={startBlank} className="w-full cursor-pointer border border-accent p-3 text-left hover:bg-surface">
                      <span className="block text-sm font-medium text-ink">Blank model</span>
                      <span className="mt-1 block text-xs text-ink-muted">An empty canvas: add elements from the palette.</span>
                    </button>
                  </li>
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
              {TABS.map((t) => (
                <button
                  key={t}
                  id={`tab-${t}`}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  aria-controls={`panel-${t}`}
                  aria-label={t === "hints" ? `Hints (${scopedHints.length})` : undefined}
                  tabIndex={tab === t ? 0 : -1}
                  onClick={() => setTab(t)}
                  className={`flex-1 cursor-pointer px-3 py-2 text-sm ${tab === t ? "border-b-2 border-accent font-medium text-ink" : "text-ink-muted hover:text-ink"}`}
                >
                  {t === "details" ? (
                    "Details"
                  ) : t === "read" ? (
                    "Read"
                  ) : (
                    <>
                      Hints
                      <span aria-hidden="true" className={`ml-1.5 inline-block min-w-5 rounded-full px-1.5 font-mono text-xs ${scopedWarnings ? "bg-status text-accent-ink" : "bg-border text-ink"}`}>
                        {scopedHints.length}
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
            <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
              {tab === "details" ? (
                <Inspector
                  model={model}
                  selectedId={selectedId}
                  dispatch={dispatch}
                  focusName={focusName}
                  focusConnect={focusConnect}
                  onSelect={setSelectedId}
                  newId={newId}
                  lens={lens}
                  suggestions={selectedId ? suggestions(model, selectedId) : []}
                  onSuggest={(s) => selectedId && pickSuggestion(selectedId, s)}
                  onBlast={(from) => selectedId && openBlast(selectedId, from)}
                />
              ) : tab === "read" ? (
                <ReadPanel reading={reading} activeEdgeId={readEdge?.id ?? null} onFocus={focusRead} scopeName={selected?.name} />
              ) : (
                <HintsPanel results={scopedHints} activeId={activeHint?.id ?? null} onFocus={focusHint} scopeName={selected?.name} />
              )}
            </div>
          </aside>
        )}
      </div>

      <ModelManager
        open={managing}
        onClose={() => setManaging(false)}
        models={doc.models}
        currentId={model.id}
        onOpen={(id) => {
          setSelectedId(null);
          setActiveHint(null);
          void doc.open(id);
        }}
        onDownload={async (id) => {
          const m = await doc.read(id);
          if (!m) return;
          const f = exportJson(m);
          downloadText(f.filename, f.text, "application/json");
        }}
        onDelete={async (ids) => {
          if (ids.includes(model.id)) {
            setSelectedId(null);
            setActiveHint(null);
          }
          await doc.remove(ids);
          setMessage(`Deleted ${ids.length} model${ids.length === 1 ? "" : "s"} from this browser.`);
        }}
      />
      {menu && <ContextMenu x={menu.x} y={menu.y} label={menu.label} items={menu.items} onClose={closeMenu} />}
      <div className={`${presenting ? "hidden" : "flex"} flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-1.5 text-xs text-ink-muted`}>
        <p role="status" aria-live="polite">
          {message}
        </p>
        {/* The site footer is left off this page (the editor fills the screen); its links live here. */}
        <div className="flex flex-wrap items-center gap-x-3">
          {/* The widest routine status reserves its width, so "Saving…" ↔ "Saved" never shifts the bar. */}
          <p className="grid">
            <span aria-hidden="true" className="invisible col-start-1 row-start-1">
              {statusText.saved}
            </span>
            <span className="col-start-1 row-start-1" data-testid="save-status">
              {statusText[doc.status]}
            </span>
          </p>
          {/* "Saved in this browser" already says where models live; small screens get the editing note. */}
          {!wide && <p>Editing needs a screen at least 768px wide. You can view and pan here.</p>}
          <nav aria-label="Site">
            <ul className="flex flex-wrap items-center gap-x-3">
              <li>
                <a className={footerLink} href={site.author.url}>
                  {site.author.name}
                </a>
              </li>
              <li>
                <a className={footerLink} href={site.repo}>
                  MIT · GitHub
                </a>
              </li>
              <li>
                <Link className={footerLink} href="/about">
                  About
                </Link>
              </li>
              <li>
                <Link className={footerLink} href="/privacy">
                  Privacy
                </Link>
              </li>
            </ul>
          </nav>
          <p>Not affiliated with ServiceNow.</p>
        </div>
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
