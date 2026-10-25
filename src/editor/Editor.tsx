"use client";

import "@xyflow/react/dist/base.css";
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  ViewportPortal,
  useReactFlow,
  useStore,
  useStoreApi,
  getNodesBounds,
  getViewportForBounds,
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
  type SetStateAction,
} from "react";
import Link from "next/link";
import { exampleCategories, examples } from "@/examples";
import { EXAMPLE_PARAM, exampleFromSearch, shownText } from "@/examples/deepLink";
import { archimateElements, archimateRelationshipFor, edgeNotation, lenses, readLens, saveLens, showsArchimate, type ArchimateRelationshipType, type Lens } from "@/frameworks";
import { downloadText } from "@/io/download";
import { pngScale, svgToPng } from "@/io/png";
import { printSvg } from "@/io/print";
import { exportJson, fileBase, importJson, MAX_FILE_CHARS } from "@/io/file";
import { decodeShare, encodeShare, shareSize, shareSupported, shareUrl, takeSharedPayload, type ShareResult } from "@/io/shareLink";
import { modelToArchimateXml } from "@/io/archimate";
import { modelToDrawioFile } from "@/io/drawio";
import { lucidFit, lucidFitMessage, lucidFitNote } from "@/io/lucid";
import { modelToServiceNowXlsx } from "@/io/servicenow";
import { modelToSvg } from "@/io/svg";
import { LAYERS, layerBoxes, layerLanes, layoutOrientation, settleIntoLane } from "@/layout/bands";
import { edgePath } from "@/layout/edgePath";
import { edgeEnds, type Side } from "@/layout/geometry";
import { alignNodes, boundsOf, snapToGuides, type Guide } from "@/layout/align";
import { distributeEvenly } from "@/layout/distribute";
import { arrangeByGroups, groupFrames, ownGroups, type Frame } from "@/layout/groupLayout";
import { autoLayout, DEFAULT_SIZE, fillSpace, type LayoutMode } from "@/layout/layout";
import { createWorkerEngine } from "@/layout/worker-engine";
import { classById, classes, ENVIRONMENT_EXAMPLES, isClassId, isExtended, type ClassId, type Layer } from "@/metamodel";
import { ALL_ELEMENTS, FIELD_LABEL, GROUP_BY_LABEL, groupsOf, primaryGroup, SIDES, attrValue, compareModels, parseModel, blastRadius, COLOR_BY_LABEL, evaluateHints, filterActive, formatModelDate, impactEnds, inView, isBusinessAnchor as isAnchor, modelDate, slotMap, UNTITLED_MODEL, type BlastDirection, type Edge, type HintResult, type Model } from "@/model";
import { site } from "@/lib/site";
import { ClassNode, SuggestContext, type ClassFlowNode } from "./ClassNode";
import { ConnectionLine, ConnectionModelContext, ReconnectingContext } from "./ConnectionLine";
import { exportItems, ExportMenu, type ExportKind } from "./ExportMenu";
import { CommandPalette } from "./CommandPalette";
import type { Command } from "./commands";
import { ShortcutMap } from "./ShortcutMap";
import { CompareBar, CompareDialog, compareSummary } from "./Compare";
import { ARRANGE, batchTargets, SelectionPanel, type ArrangeKind, type BatchKey } from "./SelectionPanel";
import { ViewDialog, ViewLegend, ViewsMenu, type ShownView } from "./Views";
import { ExamplesMenu } from "./ExamplesMenu";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { blastAnnouncement, blastProgress, blastSteps, blastView, flowAnnouncement, flowProgress, flowSteps, type BlastKind } from "./blast";
import { blastFrames, GIF_MAX_SIDE, gifScale } from "./blastGif";
import { renderGif } from "@/io/gif/render";
import { CanvasEdge, LabelObstacles, LineStyleContext, type LabelPlanInput } from "./CanvasEdge";
import type { Rect } from "@/layout/edgeLabel";
import { ModelManager } from "./ModelManager";
import { ToolbarIcon } from "./ToolbarIcon";
import { CanvasTitle, titleRoom } from "./CanvasTitle";
import { layoutChoices, LayoutMenu, type LayoutChoice } from "./LayoutMenu";
import { ModelMenu } from "./ModelMenu";
import { GroupNode, GroupOverlay, type GroupFlowNode } from "./GroupOverlay";
import { LayerOverlay, layerHandleId, type LayerHandlers } from "./LayerOverlay";
import { DEFAULT_VIEW, lineStyles, readView, saveView, viewItems, ViewMenu, type ViewOptions } from "./ViewMenu";
import { ZOOM_PRESETS, ZoomMenu, type ZoomCommand } from "./ZoomMenu";
import { IsoView, type IsoHandle } from "./IsoView";
import { isoToSvg } from "@/iso/svg";
import type { IsoMode } from "@/iso/scene";
import { HintsPanel } from "./HintsPanel";
import { markerId, NotationLegend, NotationMarkers, type EdgeTone } from "./Notation";
import { ReadPanel, type ReadMode } from "./ReadPanel";
import { outlineModel, readModel, type Sentence } from "./reading";
import { Inspector } from "./Inspector";
import { Palette } from "./Palette";
import { connectionProblem, modernEdge, SLOT } from "./state";
import { relatedClasses, suggestionDetail, suggestions, type Suggestion } from "./suggest";
import { useModelDocument, type SaveStatus } from "./useModelDocument";

const nodeTypes = { csdm: ClassNode, group: GroupNode };
/** What the canvas draws: elements, and collapsed groups (M56). */
type CanvasNode = ClassFlowNode | GroupFlowNode;
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
/** Fits keep this share of the viewport as padding on each side. */
const FIT_PAD = 0.15;
/** What React Flow takes off one side of a `length` for a numeric padding of FIT_PAD. */
const fitSide = (length: number) => Math.floor((length - length / (1 + FIT_PAD)) * 0.5);
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
const groupCaption = "mr-0.5 hidden font-mono text-[0.65rem] tracking-[0.14em] text-ink-muted uppercase min-[2120px]:inline";
const toolbarDivider = "h-6 w-px bg-border-strong/50";
const toolbarSelect = "min-h-8 max-w-60 border border-border-strong bg-surface-raised px-2 text-sm text-ink";
/** Minimap node fill per CSDM layer: the same tokens as the nodes' left borders (layerAccent). */
const minimapColor: Record<Layer, string> = {
  business: "var(--status)",
  design: "var(--accent)",
  service: "var(--ai)",
  functional: "var(--ink-muted)",
  infrastructure: "var(--border-strong)",
};

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
/** Smart guides (M57) pull a dragged element into line from this many screen pixels away. */
const GUIDE_SNAP_PX = 6;
/** Keys that add a clicked element to the selection (M57); one array, so React Flow keeps its key listener. */
const MULTI_KEYS = ["Shift", "Meta", "Control"];
const BATCH_LABEL: Record<BatchKey, string> = { lifecycle: "life cycle stage", environment: "environment", owner: "owner" };
const NO_IDS: ReadonlySet<string> = new Set();
/** Distribute vertically: the closest the tops of selected elements come (an element's height and a gap). */
const ROW_PITCH = 128;
const prefersStill = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** The theme being viewed: the header toggle's choice, else the system setting. */
const viewedTheme = (): "dark" | "light" => {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

/**
 * The canvas controls, with Fit View leaving the same room for the title block as the editor's own
 * fits: it follows the store (nodes, viewport size), so the estimate is current when the button is pressed.
 */
function FitControls({ hasDescription }: { hasDescription: boolean }) {
  const width = useStore((s) => s.width);
  const height = useStore((s) => s.height);
  const nodes = useStore((s) => s.nodes);
  const b = getNodesBounds(nodes);
  const zoom = width && height && b.width && b.height ? getViewportForBounds(b, width, height, 0.05, 1, { x: FIT_PAD, bottom: FIT_PAD, top: 0 }).zoom : 1;
  return <Controls showInteractive={false} fitViewOptions={{ maxZoom: 1, padding: { x: FIT_PAD, bottom: FIT_PAD, top: `${titleRoom(hasDescription, zoom)}px` } }} />;
}

function EditorInner() {
  // A link to /editor?example=<id> (M42, M43) or a shared model, /editor#model=… (M45): read once
  // when the browser store opens. The link comes off the URL first, so a reload, Back or a bookmark
  // cannot add a second copy. A real example or a readable shared model becomes the first load itself
  // (no empty model beside it); the announcement waits for `doc.ready`. A shared model wins over an example.
  const deepLink = useRef<
    { kind: "example"; link: ReturnType<typeof exampleFromSearch>; modelId?: string } | { kind: "share"; result: ShareResult } | null
  >(null);
  const doc = useModelDocument(async (storedIds) => {
    const payload = takeSharedPayload();
    const search = window.location.search;
    if (payload === null && !new URLSearchParams(search).has(EXAMPLE_PARAM)) return undefined;
    // `null` state: Next.js's router then takes the new URL as its own (passing the current state
    // would leave the router holding the old query, which it may write back later).
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    if (payload !== null) {
      let result: ShareResult;
      try {
        result = await decodeShare(payload, await storedIds());
      } catch {
        result = { ok: false, error: "This browser could not read the link." };
      }
      deepLink.current = { kind: "share", result };
      return result.ok ? { model: result.model, unsaved: "This browser could not save the shared model, so it was not opened. Free some space, then open the link again." } : undefined;
    }
    const link = exampleFromSearch(search);
    const model = link?.example?.create();
    deepLink.current = { kind: "example", link, modelId: model?.id };
    return model && { model, unsaved: "This browser could not save the example, so it was not opened. Choose it from Examples to try again." };
  });
  const { model, dispatch } = doc;
  const wide = useIsWide();
  const flow = useReactFlow();
  const store = useStoreApi();
  /**
   * Whole-model fits leave room above the diagram for the title block (see CanvasTitle). The room
   * depends on the zoom the fit will land on, estimated from the diagram's bounds and the viewport;
   * read when the fit runs (often from a timeout after a model opens), so it follows the open model.
   */
  const hasDescription = useRef(!!model.description);
  useEffect(() => {
    hasDescription.current = !!model.description;
  }, [model.description]);
  const fitPadding = useCallback(
    (p: number) => {
      const { width, height } = store.getState();
      const b = flow.getNodesBounds(flow.getNodes());
      // React Flow's own fit math, without the top room (which only makes the zoom smaller: safe side).
      const zoom = width && height && b.width && b.height ? getViewportForBounds(b, width, height, 0.05, 1, { x: p, bottom: p, top: 0 }).zoom : 1;
      return { x: p, bottom: p, top: `${titleRoom(hasDescription.current, zoom)}px` } as const;
    },
    [store, flow],
  );
  // The first fit, before any model is measured: the room at zoom 1 is the most ever needed.
  const firstFitOptions = { maxZoom: 1, padding: { x: FIT_PAD, bottom: FIT_PAD, top: `${titleRoom(!!model.description, 1)}px` } } as const;
  const [selectedId, setSelectedOne] = useState<string | null>(null);
  /** M57: two or more elements selected together (Shift+click, Shift+drag, Ctrl+A); selectedId is then null. */
  const [multi, setMulti] = useState<string[]>([]);
  /** Select one element, or none: a selection of several ends, and with it React Flow's box around a Shift+drag selection. */
  const setSelectedId = useCallback(
    (v: SetStateAction<string | null>) => {
      setMulti([]);
      setSelectedOne(v);
      store.setState({ nodesSelectionActive: false });
    },
    [store],
  );
  const multiSet = useMemo(() => new Set(multi), [multi]);
  const selection = useMemo(() => (multi.length ? multi : selectedId ? [selectedId] : []), [multi, selectedId]);
  /** The selection as of the last change, ahead of the next render: React Flow can report a box selection in two calls in one event. */
  const liveSelection = useRef<string[]>([]);
  useEffect(() => {
    liveSelection.current = selection;
  }, [selection]);
  /** Smart guides drawn while dragging (M57). */
  const [guides, setGuides] = useState<Guide[]>([]);
  /** How the canvas shows the model (M59): Plan (the editable canvas), Isometric or Exploded (read-only pictures). */
  const [projection, setProjection] = useState<"plan" | IsoMode>("plan");
  const isoRef = useRef<IsoHandle>(null);
  const [isoZoom, setIsoZoom] = useState(1);
  /** The selection as the zoom shortcuts see it: their listener is bound once, so it reads a ref. */
  const selectedRef = useRef<string[]>([]);
  useEffect(() => {
    selectedRef.current = selection;
  }, [selection]);
  /** Zoom menu and Shift+1/2/0 (M49): fit, the selected element, or a preset level around the center. */
  const zoomCommand = useCallback(
    (c: ZoomCommand) => {
      // The isometric picture has its own pan and zoom.
      if (isoRef.current) return isoRef.current.zoom(c);
      const duration = prefersStill() ? 0 : 300;
      if (c === "fit") void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15), duration });
      else if (c === "selection") {
        if (selectedRef.current.length) void flow.fitView({ nodes: selectedRef.current.map((id) => ({ id })), padding: 0.3, maxZoom: 1.25, duration });
      } else void flow.zoomTo(c, { duration });
    },
    [flow, fitPadding],
  );
  const [focusName, setFocusName] = useState(0);
  const [focusConnect, setFocusConnect] = useState(0);
  const [selectedLayer, setSelectedLayer] = useState<Layer | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [reveal, setReveal] = useState<string | null>(null);
  // n: a fresh menu each opening, so one menu opening another (Add a related element…) moves focus again.
  const [menu, setMenu] = useState<{ x: number; y: number; label: string; items: MenuItem[]; n: number } | null>(null);
  const menuCount = useRef(0);
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
  // The view in use (M54): a saved view's id (or null), its filter and its coloring. Kept per model and
  // not stored: a model opens on All elements, and a deleted view leaves its filter showing, unsaved.
  const [activeView, setActiveView] = useState<{ modelId: string } & ShownView>({ modelId: "", id: null, ...ALL_ELEMENTS });
  // Command palette and shortcut map (M52): modal dialogs, mounted while open; focus goes back where they were opened.
  const [palette, setPalette] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  /** M58: the Compare dialog, why a chosen file could not be compared, and the open comparison. */
  const [compareDialog, setCompareDialog] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ base: Model; label: string } | null>(null);
  const dialogReturn = useRef<HTMLElement | null>(null);
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
  /** The relationship whose end is being dragged to another point (M61). */
  const reconnecting = useRef<string | null>(null);
  /** The same, for the elements and the drawn line (no outlines, no verdict); and whether the drop stored a side. */
  const [reconnectingNow, setReconnectingNow] = useState(false);
  const portsStored = useRef(false);
  /** The Read tab as sentences or as an outline of every element (M55). */
  const [readMode, setReadMode] = useState<ReadMode>("sentences");
  const readEdge = model.edges.find((e) => e.id === readEdgeId);
  const highlighted = useMemo(
    () => new Set([...(activeHint?.nodeIds ?? []), ...(readEdge ? [readEdge.from, readEdge.to] : [])]),
    [activeHint, readEdge],
  );

  // Blast radius: view-only. The radius follows the model, so an edit while it is open updates it.
  const [blast, setBlast] = useState<{ start: string; direction: BlastDirection; kind: BlastKind; step: number; playing: boolean } | null>(null);
  const blastReturn = useRef<HTMLElement | null>(null);
  const playButton = useRef<HTMLButtonElement>(null);
  const radius = useMemo(() => (blast ? blastRadius(model, blast.start, blast.direction) : null), [model, blast?.start, blast?.direction]); // eslint-disable-line react-hooks/exhaustive-deps -- step and playing do not change the radius
  const blastShown = useMemo(() => (blast && radius ? blastView(model, radius, blast.step, blast.kind) : null), [model, radius, blast]);
  /** What changed since the compared model (M58), and how each element and relationship shows it. */
  const comparison = useMemo(() => (compare ? compareModels(model, compare.base) : null), [model, compare]);
  const diffOf = useMemo(() => {
    const nodes = new Map<string, { kind: "added" | "changed"; words: string }>();
    const edges = new Map<string, "added" | "changed">();
    if (!comparison || !compare) return { nodes, edges };
    for (const e of comparison.added) nodes.set(e.id, { kind: "added", words: ` (added since “${compare.label}”)` });
    for (const e of comparison.changed) nodes.set(e.id, { kind: "changed", words: ` (changed since “${compare.label}”: ${e.changes.map((c) => FIELD_LABEL[c.field].toLowerCase()).join(", ")})` });
    for (const e of comparison.edgesAdded) edges.set(e.id, "added");
    for (const e of comparison.edgesChanged) edges.set(e.id, "changed");
    return { nodes, edges };
  }, [comparison, compare]);
  const isFlow = blast?.kind === "flow";
  /** The open blast radius or data flow, as the isometric picture marks it. */
  const isoHighlight = useMemo(
    () => (blastShown && radius ? { impact: !isFlow && radius.direction === "impact", flow: isFlow, nodes: blastShown.nodes, edges: blastShown.edges } : undefined),
    [blastShown, radius, isFlow],
  );
  const PROJECTION_LABEL = { plan: "Plan", iso: "Isometric", exploded: "Exploded" } as const;
  const chooseProjection = (p: "plan" | IsoMode) => {
    setProjection(p);
    // The isometric projections are read only: a selection of several (which arranges and deletes) ends.
    if (p !== "plan" && multi.length) setSelectedId(null);
    setMessage(p === "plan" ? "Plan view: edit the model on the canvas." : `${PROJECTION_LABEL[p]} view, read only: drag or use the arrow keys to pan, the wheel or plus and minus to zoom. Switch to Plan to edit.`);
  };
  // The words for the open view: a blast radius speaks of hops and impact, a data flow of steps and data.
  const words = (kind: BlastKind) => (kind === "flow" ? { progress: flowProgress, announce: flowAnnouncement, steps: flowSteps } : { progress: blastProgress, announce: blastAnnouncement, steps: blastSteps });

  // A focused hint that no longer applies (fixed, undone, model switched) stops highlighting.
  useEffect(() => {
    if (activeHint && !hints.some((h) => h.id === activeHint.id)) setActiveHint(null);
  }, [hints, activeHint]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const mod = e.ctrlKey || e.metaKey;
      // Ctrl/⌘K opens the command palette from anywhere, text fields included; ? the shortcut map (M52).
      // Ctrl/⌘K never reaches the browser (its search-bar shortcut). While a dialog is open (read from the
      // page: state lags a fast second key) no editor shortcut acts on the canvas behind it.
      const isK = mod && !e.shiftKey && !e.altKey && (e.code === "KeyK" || e.key.toLowerCase() === "k");
      if (isK) e.preventDefault();
      if (document.querySelector("dialog[open]")) return;
      if (isK) {
        if (presenting) return;
        dialogReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setPalette(true);
        return;
      }
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      if (e.key === "?" && !mod && !e.altKey) {
        if (presenting) return;
        e.preventDefault();
        dialogReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setShortcuts(true);
        return;
      }
      // Shift+1 fit, Shift+2 zoom to selection, Shift+0 100% (by key position: Shift+1 types "!" on US layouts).
      if (!mod && e.shiftKey && !e.altKey && (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit0")) {
        e.preventDefault();
        zoomCommand(e.code === "Digit1" ? "fit" : e.code === "Digit2" ? "selection" : 1);
        return;
      }
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
  }, [dispatch, zoomCommand, presenting]);


  // The element under the pointer (M46): its own relationships run the way impact travels, so a
  // glance shows what it depends on and what depends on it. Off while a blast radius is open, while
  // dragging, and on touch (no pointer to hover with).
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** True while a relationship is being drawn: the drop-target outlines are the highlight then. */
  const connecting = useRef(false);
  const hoverNode = (id: string | null) => {
    clearTimeout(hoverTimer.current);
    // A tap's synthetic mouse events would leave the dashes running: only a real pointer hovers.
    if (id && (connecting.current || !window.matchMedia("(hover: hover)").matches)) id = null;
    hoverTimer.current = setTimeout(() => setHoveredId(id), id ? 150 : 200);
  };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);
  useEffect(() => {
    if (hoveredId && !model.nodes.some((n) => n.id === hoveredId)) setHoveredId(null);
  }, [model.nodes, hoveredId]);

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
    if (isFlow) return b.hop === 0 ? " (source of the data flow)" : ` (data reaches it at step ${b.hop})`;
    const impact = blast.direction === "impact";
    if (b.hop === 0) return impact ? " (failed: start of the blast radius)" : " (start of the dependencies view)";
    return impact ? ` (affected at hop ${b.hop})` : ` (needed at hop ${b.hop})`;
  };
  const shown = activeView.modelId === model.id ? { ...activeView, id: model.views?.some((v) => v.id === activeView.id) ? activeView.id : null } : { modelId: model.id, id: null, ...ALL_ELEMENTS };
  // Images follow the view on screen (M54); data exports always carry the whole model.
  const viewName = model.views?.find((v) => v.id === shown.id)?.name;
  const imageView = useMemo(() => ({ filter: shown.filter, colorBy: shown.colorBy, groupBy: shown.groupBy, name: viewName }), [shown.filter, shown.colorBy, shown.groupBy, viewName]);
  const showView = (v: ShownView) => setActiveView({ modelId: model.id, ...v });
  /** Switch views from the menu or the palette, and say what it shows. */
  const pickView = (v: ShownView) => {
    showView(v);
    const name = v.id ? model.views?.find((x) => x.id === v.id)?.name : null;
    const kept = model.nodes.filter((n) => inView(n, v.filter)).length;
    setMessage(name ? `View “${name}”: ${kept} of ${model.nodes.length} elements, ${COLOR_BY_LABEL[v.colorBy].toLowerCase()} colors.` : "Showing all elements, in layer colors.");
  };
  const fadedIds = useMemo(() => new Set(filterActive(shown.filter) ? model.nodes.filter((n) => !inView(n, shown.filter)).map((n) => n.id) : []), [model.nodes, shown.filter]);
  // A deleted element, or one the view now fades, is no longer selected (a faded element is out of reach).
  useEffect(() => {
    if (selectedId && (!model.nodes.some((n) => n.id === selectedId) || fadedIds.has(selectedId))) setSelectedId(null);
  }, [model.nodes, selectedId, fadedIds, setSelectedId]);
  useEffect(() => {
    if (!multi.length) return;
    const kept = multi.filter((id) => model.nodes.some((n) => n.id === id) && !fadedIds.has(id));
    if (kept.length === multi.length) return;
    if (kept.length > 1) setMulti(kept);
    else setSelectedId(kept[0] ?? null);
  }, [model.nodes, multi, fadedIds, setSelectedId]);
  const slotFor = useMemo(() => slotMap(model, shown.colorBy), [model, shown.colorBy]);
  // Suggestions for setting a property on several elements (M63), as the Inspector offers for one.
  const batchSuggestions = useMemo(() => {
    const used = (k: "environment" | "owner") => model.nodes.map((n) => n.attrs?.[k]?.trim() ?? "").filter(Boolean);
    return { environment: [...new Set([...ENVIRONMENT_EXAMPLES.values, ...used("environment")])], owner: [...new Set(used("owner"))] };
  }, [model.nodes]);
  // Group by (M56): frames around what belongs together, worked out from the model; a group can
  // collapse into one block (on screen only, for this model and grouping).
  const groupBy = shown.groupBy;
  const groups = useMemo(() => (groupBy ? groupsOf(model, groupBy) : []), [model, groupBy]);
  const [collapsed, setCollapsed] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: "", ids: NO_IDS });
  const collapsedKey = `${model.id}|${groupBy ?? ""}`;
  // Presenting shows every group open (the frames are off too): the slides are about the layers.
  const collapsedIds = collapsed.key === collapsedKey && !presenting ? collapsed.ids : NO_IDS;
  const toggleGroup = (key: string) => {
    const g = groups.find((x) => x.key === key);
    const next = new Set(collapsedIds);
    const closing = !next.has(key);
    if (closing) next.add(key);
    else next.delete(key);
    setCollapsed({ key: collapsedKey, ids: next });
    if (g) setMessage(`${GROUP_BY_LABEL[groupBy!]} “${g.label}” ${closing ? "collapsed into one block" : "expanded"}.`);
    // Focus follows the control: the block's Expand button, or the frame's tab.
    setTimeout(() => (document.querySelector<HTMLElement>(closing ? `[data-testid="group-node"][data-group="${CSS.escape(key)}"] button` : `[data-testid="group-frame"][data-group="${CSS.escape(key)}"] button`))?.focus(), 50);
  };
  /** Elements inside a collapsed group (their first group, the one they are laid out with). */
  const hiddenIds = useMemo(() => {
    if (!collapsedIds.size) return NO_IDS;
    const primary = primaryGroup(groups);
    return new Set(model.nodes.filter((n) => collapsedIds.has(primary.get(n.id) ?? "")).map((n) => n.id));
  }, [groups, collapsedIds, model.nodes]);
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
          blast: blastShown?.nodes.has(n.id) ? { ...blastShown.nodes.get(n.id)!, impact: blast!.direction === "impact", flow: isFlow } : undefined,
          description: n.attrs?.description,
          alt: showsArchimate(lens) && isClassId(n.class) ? { type: archimateElements[n.class].type, label: archimateElements[n.class].label, layer: archimateElements[n.class].layer } : undefined,
          archimateOnly: lens === "archimate-only",
          suggest: wide && !presenting && !blastShown && !fadedIds.has(n.id) && !dismissed.has(n.id) && !model.edges.some((e) => e.from === n.id || e.to === n.id),
          // M54: the view's coloring (a palette slot; none when coloring by layer) and whether it filters this out.
          slot: slotFor?.(n),
          faded: fadedIds.has(n.id) || undefined,
          // M58: added or changed since the compared model (a blast radius, while open, is the only highlight).
          diff: blastShown ? undefined : diffOf.nodes.get(n.id)?.kind,
        },
        selected: n.id === selectedId || multiSet.has(n.id),
        hidden: hiddenIds.has(n.id) || undefined,
        // Filtered out: in place and faded, but out of reach (no select, drag, connect or Tab stop).
        ...(fadedIds.has(n.id) ? { selectable: false, draggable: false, connectable: false, focusable: false, deletable: false, className: "bm-faded" } : {}),
        ariaLabel: `${classById(n.class)?.label ?? n.class}: ${n.name || "Untitled"}${shown.colorBy !== "layer" ? `, ${COLOR_BY_LABEL[shown.colorBy]}: ${attrValue(n, shown.colorBy) || "Not set"}` : ""}${!blastShown && hintLevel.get(n.id) ? " (has hints)" : ""}${!blastShown && neighbors.has(n.id) ? " (connected to the selected element)" : ""}${blastLabel(n.id)}${blastShown ? "" : (diffOf.nodes.get(n.id)?.words ?? "")}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag and measured are refs; dragTick re-runs this
    [model, selectedId, multiSet, dragTick, hintLevel, highlighted, lens, wide, presenting, dismissed, neighbors, blastShown, fadedIds, shown.colorBy, slotFor, diffOf, hiddenIds],
  );
  /** Where each element is right now (mid-drag included), for the group frames. */
  const liveLayout = useMemo(
    () => ({ ...model.layout, ...drag.current }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- drag is a ref; dragTick re-runs this
    [model.layout, dragTick],
  );
  const groupLabel = groupBy ? GROUP_BY_LABEL[groupBy] : "";
  // Frames for the open groups, each around the elements it holds (one shared by two is framed with its first);
  // a collapsed group's block sits where its frame began.
  const frames = useMemo(() => {
    if (!groups.length) return [];
    return groupFrames(ownGroups(groups).filter((g) => !collapsedIds.has(g.key)), liveLayout, measured.current);
  }, [groups, collapsedIds, liveLayout]);
  const groupNodes: GroupFlowNode[] = useMemo(() => {
    if (!collapsedIds.size) return [];
    return ownGroups(groups)
      .filter((g) => collapsedIds.has(g.key))
      .flatMap((g) => {
        const own = g.nodeIds;
        const [f] = groupFrames([g], model.layout, measured.current);
        if (!f) return [];
        return [
          {
            id: `group:${g.key}`,
            type: "group" as const,
            position: { x: f.x, y: f.y },
            data: { label: g.label, kind: groupLabel, count: own.length, groupKey: g.key, onExpand: () => toggleGroup(g.key) },
            draggable: false,
            selectable: false,
            deletable: false,
            connectable: false,
            // Its Expand button is the one stop for it.
            focusable: false,
            ariaLabel: `${groupLabel} group ${g.label}, ${own.length} element${own.length === 1 ? "" : "s"}, collapsed`,
          },
        ];
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measured is a ref; toggleGroup reads current state
  }, [groups, collapsedIds, model.layout, groupLabel]);
  // An element folded into a collapsed group is out of reach: it is no longer selected.
  useEffect(() => {
    if (!hiddenIds.size) return;
    if (selectedId && hiddenIds.has(selectedId)) setSelectedId(null);
    if (multi.some((id) => hiddenIds.has(id))) {
      const kept = multi.filter((id) => !hiddenIds.has(id));
      if (kept.length > 1) setMulti(kept);
      else setSelectedId(kept[0] ?? null);
    }
  }, [hiddenIds, selectedId, multi, setSelectedId]);
  const canvasNodes: CanvasNode[] = useMemo(() => (groupNodes.length ? [...nodes, ...groupNodes] : nodes), [nodes, groupNodes]);

  // Layers as columns (a left-to-right layout): relationships then run sideways between layers.
  const columns = useMemo(
    () => layoutOrientation(model, measured.current) === "columns",
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measured is a ref; dragTick re-runs this
    [model, dragTick],
  );
  const hintedEdges = useMemo(() => new Set([...(activeHint?.edgeIds ?? []), ...(readEdge ? [readEdge.id] : [])]), [activeHint, readEdge]);
  /** What a relationship's line says: the ArchiMate relationship in the ArchiMate-only lens, else the CSDM type's first half. */
  const edgeLabelOf = useCallback(
    (e: Model["edges"][number]) => {
      const classOf = (id: string) => model.nodes.find((n) => n.id === id)?.class ?? "";
      const am = lens === "archimate-only" ? edgeNotation(archimateRelationshipFor(classOf(e.from), classOf(e.to))) : undefined;
      return am ? am.type : e.type.startsWith("reference:") ? "reference" : (e.type.split("::")[0] ?? e.type);
    },
    [model.nodes, lens],
  );
  /**
   * What the label plan works from (M50): the same geometry as the SVG export (element boxes from the
   * layout and measured sizes, the same sides and router). LabelObstacles runs the plan (it follows the
   * zoom, for the layer name tabs) and every edge draws its label at the planned spot, so the canvas
   * and the exported image agree.
   */
  const labelPlan = useMemo((): LabelPlanInput => {
    if (!view.labels) return { items: [], nodes: [] };
    const box = (id: string): Rect | undefined => {
      const pos = model.layout[id];
      if (!pos) return undefined;
      const m = measured.current[id];
      return { x: pos.x, y: pos.y, w: m?.width ?? 224, h: m?.height ?? 76 };
    };
    const anchor = (b: Rect, side: Side) => (side === "top" ? { x: b.x + b.w / 2, y: b.y } : side === "bottom" ? { x: b.x + b.w / 2, y: b.y + b.h } : side === "left" ? { x: b.x, y: b.y + b.h / 2 } : { x: b.x + b.w, y: b.y + b.h / 2 });
    const nodes = model.nodes.map((n) => box(n.id)).filter((b): b is Rect => !!b);
    const items = model.edges.flatMap((e) => {
      const a = box(e.from);
      const b = box(e.to);
      if (!a || !b) return [];
      const [ss, ts] = edgeEnds(e.ports, a, b, columns);
      const s = anchor(a, ss);
      const t = anchor(b, ts);
      const { path, label: middle } = edgePath({ x: s.x, y: s.y, side: ss }, { x: t.x, y: t.y, side: ts }, view.lines);
      return [{ id: e.id, path, label: edgeLabelOf(e), middle, span: Math.hypot(t.x - s.x, t.y - s.y) }];
    });
    return { items, nodes };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measured is a ref; dragTick re-runs this
  }, [model, columns, view.lines, view.labels, edgeLabelOf, dragTick]);
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
        const [sourceHandle, targetHandle] = edgeEnds(e.ports, a, b, columns);
        const hinted = !blastShown && hintedEdges.has(e.id);
        // A hinted relationship keeps its hint color; the others around the hovered element light up.
        const hovered = !blastShown && !hinted && !!hoveredId && (e.from === hoveredId || e.to === hoveredId);
        // Dashes run the way impact travels: forward along the line when its From end is the dependency.
        // A pair the impact rules do not cover is highlighted but still.
        const ends = hovered ? impactEnds(model, e) : null;
        const hoverClass = hovered ? ` hover${!ends ? " hover-still" : ends.dependency !== e.from ? " hover-reverse" : ""}` : "";
        const tone: EdgeTone = carried || hinted ? "status" : hovered ? "accent" : connected ? "neighbor" : "line";
        return {
          id: e.id,
          type: "csdm",
          source: e.from,
          target: e.to,
          sourceHandle,
          targetHandle,
          label: view.labels ? edgeLabelOf(e) : undefined,
          hidden: hiddenIds.has(e.from) || hiddenIds.has(e.to) || undefined,
          className:
            ((fadedIds.has(e.from) || fadedIds.has(e.to) ? "faded " : "") +
            (!blastShown && diffOf.edges.get(e.id) ? `diff-${diffOf.edges.get(e.id)} ` : "") +
            (carried
              ? `blast${isFlow ? " flow" : ""}${carried.current ? " blast-now" : ""}${carried.forward ? "" : " blast-reverse"}`
              : hinted
                ? "hinted"
                : connected
                  ? "connected"
                  : "") + hoverClass).trim() || undefined,
          ...(am
            ? {
                // The flowing blast dash replaces the notation's dash while that hop is current.
                style: am.dash && !carried?.current ? { strokeDasharray: am.dash } : undefined,
                markerStart: am.atFrom ? markerId(am.atFrom, tone) : undefined,
                markerEnd: am.atTo ? markerId(am.atTo, tone) : undefined,
              }
            : {
                // A fixed on-screen size (not scaled by the line's width), large enough to see on a curve.
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: tone === "status" ? "var(--status)" : tone === "accent" ? "var(--accent)" : tone === "neighbor" ? "var(--neighbor)" : "var(--border-strong)",
                  width: 32,
                  height: 32,
                  markerUnits: "userSpaceOnUse",
                },
              }),
          ariaLabel: `${e.type} from ${model.nodes.find((n) => n.id === e.from)?.name} to ${model.nodes.find((n) => n.id === e.to)?.name}${carried ? (isFlow ? " (carries data)" : " (carries impact)") : ""}`,
        };
      }),
    [model, hintedEdges, selectedId, lens, blastShown, columns, isFlow, hoveredId, view.labels, edgeLabelOf, fadedIds, diffOf, hiddenIds],
  );
  // A collapsed group stands in for its elements: their relationships with the rest run to its block (dashed, one per pair).
  const canvasEdges: FlowEdge[] = useMemo(() => {
    if (!groupNodes.length) return edges;
    const primary = primaryGroup(groups);
    const end = (id: string) => (hiddenIds.has(id) ? `group:${primary.get(id)}` : id);
    const posOf = (id: string) => groupNodes.find((g) => g.id === id)?.position ?? model.layout[id] ?? { x: 0, y: 0 };
    const seen = new Set<string>();
    const extra: FlowEdge[] = [];
    for (const e of model.edges) {
      if (!hiddenIds.has(e.from) && !hiddenIds.has(e.to)) continue;
      const [source, target] = [end(e.from), end(e.to)];
      if (source === target || seen.has(`${source}>${target}`)) continue;
      seen.add(`${source}>${target}`);
      const [sourceHandle, targetHandle] = edgeEnds(undefined, posOf(source), posOf(target), columns);
      const name = (id: string) => groupNodes.find((g) => g.id === id)?.data.label ?? model.nodes.find((n) => n.id === id)?.name;
      extra.push({
        id: `group-edge:${source}>${target}`,
        type: "smoothstep",
        source,
        target,
        sourceHandle,
        targetHandle,
        className: `group-edge${fadedIds.has(e.from) || fadedIds.has(e.to) ? " faded" : ""}`,
        selectable: false,
        focusable: false,
        deletable: false,
        markerEnd: { type: MarkerType.ArrowClosed, color: "var(--border-strong)", width: 24, height: 24, markerUnits: "userSpaceOnUse" },
        ariaLabel: `Relationships from ${name(source)} to ${name(target)}`,
      } as FlowEdge);
    }
    return [...edges, ...extra];
  }, [edges, groupNodes, groups, hiddenIds, model, columns, fadedIds]);

  /** Several elements selected at once (M57); one or none falls back to the single selection. */
  const selectMany = (ids: string[]) => {
    if (ids.length <= 1) {
      setSelectedId(ids[0] ?? null);
      if (ids[0]) setTab("details");
      return;
    }
    setSelectedOne(null);
    setMulti(ids);
    setTab("details");
    setMessage(`${ids.length} elements selected.`);
  };
  const sizeOf = (id: string) => measured.current[id] ?? DEFAULT_SIZE;
  /** Where moved elements come to rest: in their own lane when lanes are on. */
  const settle = (positions: Record<string, { x: number; y: number }>) => {
    let lane: string | undefined;
    const out = Object.fromEntries(
      Object.entries(positions).map(([id, pos]) => {
        if (!view.lanes) return [id, pos];
        const kept = settleIntoLane(model, measured.current, id, pos);
        if (kept.settled) lane = kept.lane;
        return [id, { x: kept.x, y: kept.y }];
      }),
    );
    return { positions: out, lane };
  };

  const onNodesChange = useCallback(
    (all: NodeChange<CanvasNode>[]) => {
      // A collapsed group's block (M56) is not an element: nothing about it is stored.
      const changes = all.filter((c) => !("id" in c && c.id.startsWith("group:")));
      // While dragging, line the moving elements up with the others (smart guides, M57): every
      // element of a group drag moves by the same shift, worked out from the box around them.
      const moving: Record<string, { x: number; y: number }> = {};
      for (const c of changes) if (c.type === "position" && c.dragging && c.position) moving[c.id] = c.position;
      if (Object.keys(moving).length) {
        let shift = { dx: 0, dy: 0 };
        let lines: Guide[] = [];
        // Snap to grid, when on, decides where things land; guides line up only what is in reach.
        if (view.guides && !view.snap) {
          const box = boundsOf(Object.entries(moving).map(([id, p]) => ({ ...p, ...sizeOf(id) })));
          const others = model.nodes.filter((n) => !moving[n.id] && !fadedIds.has(n.id) && model.layout[n.id]).map((n) => ({ ...model.layout[n.id]!, ...sizeOf(n.id) }));
          const r = snapToGuides(box, others, GUIDE_SNAP_PX / flow.getZoom());
          shift = r;
          lines = r.guides;
        }
        for (const [id, p] of Object.entries(moving)) moving[id] = { x: p.x + shift.dx, y: p.y + shift.dy };
        drag.current = { ...drag.current, ...moving };
        setGuides((cur) => (JSON.stringify(cur) === JSON.stringify(lines) ? cur : lines));
        setDragTick((n) => n + 1);
      }
      const ended: Record<string, { x: number; y: number }> = {};
      let picked: Set<string> | null = null;
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
          if (c.dragging) continue;
          // A drag ends where the guides left it; a keyboard move has only its own position.
          const pos = drag.current[c.id] ?? c.position;
          const { [c.id]: _done, ...rest } = drag.current;
          void _done;
          drag.current = rest;
          if (pos) ended[c.id] = pos;
        } else if (c.type === "select") {
          picked ??= new Set(liveSelection.current);
          if (c.selected) picked.add(c.id);
          else picked.delete(c.id);
        }
        // Deleting goes through onBeforeDelete, as one undo step.
      }
      const endedIds = Object.keys(ended);
      if (endedIds.length) {
        setGuides([]);
        const { positions, lane } = settle(ended);
        // A group move is one undo step.
        if (endedIds.length === 1) dispatch({ type: "move-node", id: endedIds[0]!, x: positions[endedIds[0]!]!.x, y: positions[endedIds[0]!]!.y });
        else dispatch({ type: "set-layout", layout: positions });
        if (lane) setMessage(endedIds.length === 1 ? `Kept in the ${lane} lane.` : "Kept each element in its own lane.");
      }
      if (picked) {
        const ids = [...picked].filter((id) => !fadedIds.has(id));
        const before = liveSelection.current;
        liveSelection.current = ids;
        if (ids.length !== before.length || ids.some((id) => !before.includes(id))) selectMany(ids);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectMany, settle and sizeOf read this render's state
    [dispatch, view.lanes, view.guides, view.snap, model, fadedIds, flow],
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

  /** After an example has opened: its lens, the announcement and a fit, as the Examples menu does. */
  const exampleOpened = (ex: (typeof examples)[number]) => {
    if (ex.lens) setLens(ex.lens);
    setMessage(`Opened the example “${ex.name}” as a new model.${ex.lens ? ` Lens: ${lenses.find((l) => l.id === ex.lens)?.label}.` : ""}`);
    setTimeout(() => void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15) }), 50);
  };

  const loadExample = async (exampleId: string) => {
    const ex = examples.find((e) => e.id === exampleId);
    if (!ex) return;
    setSelectedId(null);
    setActiveHint(null);
    if (!(await doc.createFrom(ex.create()))) return;
    exampleOpened(ex);
  };

  /** After a shared model has opened (M45): the announcement, as an import's, and a fit. */
  const sharedOpened = (r: Extract<ShareResult, { ok: true }>) => {
    const warn = r.issues.length ? ` ${r.issues.length} relationship${r.issues.length === 1 ? " breaks" : "s break"} the CSDM rules; see Hints.` : "";
    const name = shownText(r.model.name, 200) || UNTITLED_MODEL;
    setMessage(`Opened the shared model “${name}” ${r.copied ? "as a copy (a model with the same id is already here)" : "as a new model"}.${warn}`);
    setTimeout(() => void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15) }), 50);
  };
  // Shown as text and cut short: a small link can carry a validation message megabytes long.
  const shareProblem = (error: string) => setIoError(`This link does not contain a model Blueprint Modeler can open. ${shownText(error, 300)}`);

  // Once the first load has finished, say what a deep link did: the example or shared model it opened
  // (only when it really is the open model; a failed save has its own banner), or what was wrong with it.
  const deepLinked = useRef(false);
  useEffect(() => {
    if (!doc.ready || deepLinked.current) return;
    deepLinked.current = true;
    const d = deepLink.current;
    if (d?.kind === "share") {
      if (!d.result.ok) shareProblem(d.result.error);
      else if (doc.model.id === d.result.model.id) sharedOpened(d.result);
      return;
    }
    if (!d?.link) return;
    if (d.link.example) {
      if (doc.model.id === d.modelId) exampleOpened(d.link.example);
    } else setIoError(`No example named “${d.link.shown}”. Choose one from Examples.`);
  }, [doc.ready]); // eslint-disable-line react-hooks/exhaustive-deps -- runs once, after the first load

  // A model link pasted into the address bar of an editor that is already open changes only the
  // fragment, so the page does not reload: open it as an import would.
  const openSharedRef = useRef<(payload: string) => Promise<void>>(async () => {});
  openSharedRef.current = async (payload: string) => {
    setIoError(null);
    let r: ShareResult;
    try {
      r = await decodeShare(payload, await doc.storedIds());
    } catch {
      r = { ok: false, error: "This browser could not read the link." };
    }
    if (!r.ok) {
      shareProblem(r.error);
      return;
    }
    setSelectedId(null);
    setActiveHint(null);
    if (await doc.createFrom(r.model)) sharedOpened(r);
  };
  useEffect(() => {
    if (!doc.ready) return;
    // The capture script in <head> heard it first and took the link off the address; pick it up.
    const onHash = () => {
      const payload = takeSharedPayload();
      if (payload !== null) void openSharedRef.current(payload);
    };
    onHash(); // A link pasted while the editor was still loading.
    window.addEventListener("popstate", onHash);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("popstate", onHash);
      window.removeEventListener("hashchange", onHash);
    };
  }, [doc.ready]);

  // "Blank model" closes the empty-state card for this model and moves focus to the palette.
  const [blankFor, setBlankFor] = useState<string | null>(null);
  const startBlank = () => {
    setBlankFor(model.id);
    setMessage("Blank model ready. Add an element from the palette.");
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('nav[aria-label="Element palette"] button')?.focus());
  };

  const measuredSizes = () =>
    Object.fromEntries(flow.getNodes().map((n) => [n.id, { width: n.measured?.width ?? DEFAULT_SIZE.width, height: n.measured?.height ?? DEFAULT_SIZE.height }]));

  const layoutDone: Record<LayoutMode, string> = {
    auto: "Laid out by CSDM layer.",
    rows: "Laid out by CSDM layer, top to bottom.",
    columns: "Laid out by CSDM layer, left to right.",
    symmetric: "Laid out by CSDM layer, centered.",
  };

  const runLayout = async (mode: LayoutMode = "auto") => {
    if (model.nodes.length === 0 || layingOut) return;
    setLayingOut(true);
    setMessage("Laying out by CSDM layer…");
    try {
      engine.current ??= createWorkerEngine();
      const layout = await autoLayout(engine.current, model, measuredSizes(), mode);
      // Another model may have opened while the layout ran; examples share element ids, so a stale
      // layout would move that model's elements.
      if (openModelId.current !== model.id) {
        setMessage("Layout stopped: another model opened while it ran. Nothing was moved.");
        return;
      }
      dispatch({ type: "set-layout", layout });
      setMessage(`${layoutDone[mode]} Undo restores the previous positions.`);
      setTimeout(() => void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15), duration: 300 }), 50);
    } catch {
      setMessage("Layout failed. Your positions are unchanged.");
    } finally {
      setLayingOut(false);
    }
  };

  // Fill space: stretch the picture to the view's shape (the title block's room taken off the top).
  const runFill = () => {
    const { width, height } = store.getState();
    const sizes = measuredSizes();
    // The area a fit gives the picture: the padding each side and the title block's room above,
    // which depends on the zoom the fit lands on, so the stretch is estimated twice (once at zoom 1,
    // once at the zoom the first answer would fit at).
    let layout: Model["layout"] | null = null;
    let zoom = 1;
    for (let pass = 0; pass < 2; pass++) {
      const inner = { w: width - 2 * fitSide(width), h: height - fitSide(height) - titleRoom(hasDescription.current, zoom) };
      layout = inner.w > 0 && inner.h > 0 ? fillSpace(model, sizes, inner.w / inner.h) : null;
      if (!layout) break;
      // Only placed elements are in the answer (an imported file may leave one without a position).
      const placed = Object.entries(layout).map(([id, p]) => ({ ...p, ...(sizes[id] ?? DEFAULT_SIZE) }));
      const x = Math.min(...placed.map((p) => p.x)), y = Math.min(...placed.map((p) => p.y));
      const b = { x, y, width: Math.max(...placed.map((p) => p.x + p.width)) - x, height: Math.max(...placed.map((p) => p.y + p.height)) - y };
      zoom = getViewportForBounds(b, width, height, 0.05, 1, { x: FIT_PAD, bottom: FIT_PAD, top: 0 }).zoom || 1;
    }
    if (!layout) {
      const placed = model.nodes.filter((n) => model.layout[n.id]);
      const line = new Set(placed.map((n) => model.layout[n.id]!.x)).size === 1 || new Set(placed.map((n) => model.layout[n.id]!.y)).size === 1;
      setMessage(placed.length < 2 ? "Nothing to spread: the model has one element." : line ? "Fill space needs elements in more than one row and column." : "The picture already fills the view.");
      return;
    }
    dispatch({ type: "set-layout", layout });
    setMessage("Spread to fill the view. Undo restores the previous positions.");
    setTimeout(() => void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15), duration: 300 }), 50);
  };

  const chooseLayout = (choice: LayoutChoice) => (choice === "fill" ? runFill() : void runLayout(choice));

  const importFile = async (file: File) => {
    setIoError(null);
    if (file.size > MAX_FILE_CHARS * 4) {
      setIoError("The file is too large to be a Blueprint Modeler model (over 5 MB).");
      return;
    }
    const r = importJson(await file.text(), await doc.storedIds());
    if (!r.ok) {
      setIoError(`Could not import “${file.name}”. ${r.error} Nothing was changed.`);
      return;
    }
    setSelectedId(null);
    setActiveHint(null);
    if (!(await doc.createFrom(r.model))) return;
    const warn = r.issues.length ? ` ${r.issues.length} relationship${r.issues.length === 1 ? " breaks" : "s break"} the CSDM rules; see Hints.` : "";
    setMessage(`Imported “${r.model.name || UNTITLED_MODEL}”${r.copied ? " as a copy (a model with the same id is already here)" : ""}.${warn}`);
    setTimeout(() => void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15) }), 50);
  };

  const [makingGif, setMakingGif] = useState(false);
  // An export still running when the editor closes is stopped, and saves nothing.
  const gifAbort = useRef<AbortController | null>(null);
  useEffect(() => () => gifAbort.current?.abort(), []);
  const exportBlastGif = async () => {
    if (!blast || !radius || !radius.steps.length || makingGif) return;
    const frames = blastFrames(model, radius, viewedTheme(), lens, blast.kind, view.lines, view.labels, imageView);
    const filename = `${fileBase(model)}-${isFlow ? "data-flow" : "blast-radius"}.gif`;
    const count = `${frames.svgs.length} frame${frames.svgs.length === 1 ? "" : "s"}`;
    setMakingGif(true);
    // Pause the playing view: its hop announcements would replace the export's result on the status line.
    setBlast((b) => (b ? { ...b, playing: false } : b));
    setMessage(`Making ${filename} (${count})…`);
    const abort = new AbortController();
    gifAbort.current = abort;
    try {
      const { bytes } = await renderGif({ ...frames, comment: frames.summary, scale: gifScale, signal: abort.signal });
      downloadText(filename, bytes as Uint8Array<ArrayBuffer>, "image/gif");
      setMessage(`Exported ${filename}: ${count}, ${Math.max(1, Math.round(bytes.length / 1024))} KB. ${frames.summary}`);
    } catch {
      if (!abort.signal.aborted) setMessage("Could not make the GIF in this browser. Nothing was saved.");
    } finally {
      gifAbort.current = null;
      setMakingGif(false);
    }
  };

  // The model's share link (M45), made when the Export menu opens, so Copy link can usually write it
  // to the clipboard straight from the click (Safari refuses a copy that waits on other work first).
  const [canShare, setCanShare] = useState(true);
  useEffect(() => setCanShare(shareSupported()), []);
  const [share, setShare] = useState<{ model: Model; url: string; size: ReturnType<typeof shareSize> } | null>(null);
  const makeShare = async (m: Model) => {
    const payload = await encodeShare(m);
    const url = shareUrl(window.location.origin, payload);
    return { model: m, url, size: shareSize(url, payload) };
  };
  const prepareShare = () => {
    if (!canShare || share?.model === model) return;
    const m = model;
    void makeShare(m)
      .then(setShare)
      .catch(() => setCanShare(false));
  };
  // The palette lists Copy link too: make the link as it opens, as the Export menu does.
  useEffect(() => {
    if (palette) prepareShare();
  }, [palette]); // eslint-disable-line react-hooks/exhaustive-deps -- once per opening, for the model open then
  // Where the link is shown for copying by hand (the clipboard refused it), and where focus returns after.
  const [linkField, setLinkField] = useState<string | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const linkRegion = useRef<HTMLDivElement>(null);
  const linkReturn = useRef<HTMLElement | null>(null);
  const closeLinkField = useCallback(() => {
    const hadFocus = !!linkRegion.current?.contains(document.activeElement);
    setLinkField(null);
    if (hadFocus) linkReturn.current?.focus();
  }, []);
  // A link shown for copying by hand is stale once the model changes.
  useEffect(() => closeLinkField(), [model, closeLinkField]);
  useEffect(() => {
    if (!linkField) return;
    linkInput.current?.focus();
    linkInput.current?.select();
  }, [linkField]);
  const kb = (url: string) => `${(url.length / 1000).toFixed(1)} KB`;
  const copyLink = async () => {
    linkReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    let s = share?.model === model ? share : null;
    if (!s) {
      try {
        s = await makeShare(model);
      } catch {
        setCanShare(false);
        setIoError("This browser cannot make model links. Use Export › Model file (JSON) instead.");
        return;
      }
      setShare(s);
    }
    if (s.size === "too-large") {
      setIoError("This model is too large to share as a link. Use Export › Model file (JSON) instead.");
      return;
    }
    const long = s.size === "long" ? " It is long: some chat and email apps cut links this long, so a model file may travel better." : "";
    try {
      await navigator.clipboard.writeText(s.url);
      setLinkField(null);
      setMessage(`Link copied (${kb(s.url)}). Anyone with the link can open a copy of this model.${long}`);
    } catch {
      setLinkField(s.url);
      setMessage(`Copy the link in the field above the canvas (${kb(s.url)}): this browser did not allow copying it. Anyone with the link can open a copy of this model.${long}`);
    }
  };

  /** The image exports' picture: the plan, or the isometric projection on screen (M59), following the view. */
  const picture = (theme: "dark" | "light") =>
    projection === "plan" ? modelToSvg(model, theme, { lens, lines: view.lines, labels: view.labels, view: imageView }) : isoToSvg(model, theme, { mode: projection, view: imageView });
  const exportAs = (kind: ExportKind) => {
    if (kind === "blast-gif" || kind === "flow-gif") {
      void exportBlastGif();
    } else if (kind === "link") {
      void copyLink();
    } else if (kind === "json") {
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
    } else if (kind === "png-dark" || kind === "png-light") {
      const theme = kind === "png-dark" ? "dark" : "light";
      const filename = `${fileBase(model)}${projection === "plan" ? "" : `-${projection}`}-${theme}.png`;
      const svg = picture(theme);
      const size = /width="([\d.]+)" height="([\d.]+)"/.exec(svg);
      setMessage(`Making ${filename}…`);
      void svgToPng(svg, size ? pngScale(Number(size[1]), Number(size[2])) : 2)
        .then(({ blob, width, height }) => blob.arrayBuffer().then((buf) => {
          downloadText(filename, new Uint8Array(buf), "image/png");
          setMessage(`Exported ${filename} (${width} × ${height} px).`);
        }))
        .catch(() => setMessage("Could not make the PNG in this browser. Nothing was saved."));
    } else if (kind === "print") {
      printSvg(picture("light"), fileBase(model));
    } else {
      const theme = kind === "svg-dark" ? "dark" : "light";
      const filename = `${fileBase(model)}${projection === "plan" ? "" : `-${projection}`}-${theme}.svg`;
      downloadText(filename, picture(theme), "image/svg+xml");
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
  const pickSuggestion = (nodeId: string, s: Suggestion, at?: { x: number; y: number }) => {
    const anchor = model.nodes.find((n) => n.id === nodeId);
    if (!anchor) return;
    const anchorName = anchor.name || "Untitled";
    if (s.kind === "existing") {
      dispatch({ type: "add-edge", id: newId(), from: s.from, to: s.to, edgeType: s.type });
      setMessage(`Related ${anchorName} and ${s.name} (${s.type}).`);
      return;
    }
    const id = newId();
    dispatch({ type: "add-related", id, class: s.cls, name: `New ${s.classLabel}`, edgeId: newId(), relatedTo: nodeId, outgoing: s.outgoing, edgeType: s.type, at });
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

  // Quick-add (M53): a menu of every class that can be added related to an element, opened by
  // dropping a line on empty canvas (placed where it was dropped) or by Shift+A, the element's menu
  // or the palette (placed in its layer near the element). One choice = element + relationship, one undo step.
  const nodeEl = (id: string) => document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
  const openQuickAdd = (nodeId: string, x: number, y: number, returnTo: HTMLElement | null, at?: { x: number; y: number }) => {
    const n = model.nodes.find((x) => x.id === nodeId);
    if (!n) return;
    const name = n.name || "Untitled";
    const items: MenuItem[] = relatedClasses(model, nodeId, { extended: view.extended }).map((s) => ({
      kind: "item",
      label: `New ${s.classLabel}`,
      note: suggestionDetail(s),
      onSelect: () => pickSuggestion(nodeId, s, at),
    }));
    if (items.length === 0) {
      setMessage(`Nothing can be added related to ${name} in CSDM.`);
      return;
    }
    setMessage(`Choose a new element to relate to ${name}.`);
    openMenu(x, y, `Add related to ${name}`, items, returnTo);
  };
  /** Quick-add for an element, the menu just below it; an element out of view is brought into view first. */
  const quickAddAt = (nodeId: string) => {
    const open = () => {
      const el = nodeEl(nodeId);
      const r = el?.getBoundingClientRect();
      openQuickAdd(nodeId, (r?.left ?? 0) + 8, (r?.bottom ?? 0) + 4, el);
    };
    const r = nodeEl(nodeId)?.getBoundingClientRect();
    const c = document.querySelector(".react-flow")?.getBoundingClientRect();
    const inView = r && c && r.left >= c.left && r.right <= c.right && r.top >= c.top && r.bottom <= c.bottom;
    if (inView) open();
    else void flow.fitView({ nodes: [{ id: nodeId }], padding: 0.3, maxZoom: 1.25, duration: 0 }).then(open);
  };
  // Where a drawn line started, so a click on a handle (no drag) does not open the menu.
  const connectStart = useRef<{ x: number; y: number } | null>(null);
  const clientPoint = (e: MouseEvent | TouchEvent) => {
    const t = "changedTouches" in e ? e.changedTouches[0] : e;
    return t ? { x: t.clientX, y: t.clientY } : null;
  };

  // Right-click menus, built for what was clicked.
  const openMenu = (x: number, y: number, label: string, items: MenuItem[], returnTo: HTMLElement | null) => {
    menuReturn.current = returnTo;
    setMenu({ x, y, label, items, n: ++menuCount.current });
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
  /** Align or distribute the selected elements (M57), as one undo step. */
  const arrange = (kind: ArrangeKind) => {
    if (multi.length < 2) return;
    const layout =
      kind === "spread-x" ? distributeEvenly(model, multi, SLOT) : kind === "spread-y" ? distributeEvenly(model, multi, ROW_PITCH, "y") : alignNodes(model, multi, measured.current, kind);
    const a = ARRANGE.find((x) => x.id === kind)!;
    if (!layout) return setMessage(kind.startsWith("spread") ? "Already evenly spread." : `Already lined up ${a.done}.`);
    const { positions, lane } = settle(layout);
    dispatch({ type: "set-layout", layout: positions });
    setMessage(`${kind.startsWith("spread") ? "Spread" : "Aligned"} ${multi.length} elements ${a.done}.${lane ? " Lanes keep each in its own layer." : ""}`);
  };
  /**
   * A frame's tab got focus (Tab key): bring it into view as the canvas does for elements. The pane
   * clips its content, and a browser may scroll it to show the tab, so that scroll is undone first.
   */
  const revealFrame = (f: Frame, el: HTMLElement) => {
    const pane = el.closest<HTMLElement>(".react-flow");
    if (!pane) return;
    for (const x of [pane, ...pane.querySelectorAll<HTMLElement>(".react-flow__renderer, .react-flow__pane, .react-flow__viewport")]) x.scrollTop = x.scrollLeft = 0;
    const r = el.getBoundingClientRect();
    const p = pane.getBoundingClientRect();
    if (r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom) return;
    const { zoom } = flow.getViewport();
    void flow.setViewport({ x: 48 - f.x * zoom, y: 48 + r.height - f.y * zoom, zoom }, { duration: prefersStill() ? 0 : 200 });
  };
  /** Arrange by group (M56): each group in its own band, so its frame holds just its elements. */
  const arrangeGroups = () => {
    if (!groupBy) return;
    if (!groups.length) return setMessage(`No ${GROUP_BY_LABEL[groupBy]} groups in this model.`);
    const layout = arrangeByGroups(model, groups, measured.current);
    if (!layout) return setMessage("Already arranged by group.");
    dispatch({ type: "set-layout", layout: settle(layout).positions });
    setMessage(`Arranged ${groups.length} ${GROUP_BY_LABEL[groupBy]} group${groups.length === 1 ? "" : "s"} side by side.`);
    setTimeout(() => zoomCommand("fit"), 50);
  };
  /** Set a property on every selected element at once (M63), one undo step. */
  const setAttrForAll = (key: BatchKey, raw: string) => {
    const value = raw.trim();
    const selected = model.nodes.filter((n) => multiSet.has(n.id));
    const targets = batchTargets(selected, key);
    const skipped = selected.length - targets.length;
    const left = skipped ? ` ${skipped} without a CSDM life cycle ${skipped === 1 ? "is" : "are"} left as ${skipped === 1 ? "it is" : "they are"}.` : "";
    const label = BATCH_LABEL[key];
    if (!targets.length) return setMessage(`None of these elements has a ${label}.`);
    if (targets.every((n) => (n.attrs?.[key] ?? "") === value)) return setMessage(value ? `All ${targets.length} already have ${label} “${value}”.` : `None of them has a ${label} set.`);
    dispatch({ type: "set-attrs", ids: targets.map((n) => n.id), key, value });
    setMessage(value ? `Set ${label} “${value}” on ${targets.length} elements.${left}` : `Cleared the ${label} of ${targets.length} elements.${left}`);
  };
  // The side panel's buttons go with the selection: focus moves on to the Details tab.
  const focusDetails = () => setTimeout(() => document.getElementById("tab-details")?.focus(), 0);
  const deleteSelection = () => {
    const n = multi.length;
    if (n < 2) return;
    dispatch({ type: "delete-nodes", ids: multi });
    setSelectedId(null);
    setMessage(`Deleted ${n} elements. Undo restores them.`);
    focusDetails();
  };
  const clearSelection = (moveFocus = false) => {
    setSelectedId(null);
    setMessage("Selection cleared.");
    if (moveFocus) focusDetails();
  };
  const selectAll = () => {
    if (projection !== "plan") return;
    store.setState({ nodesSelectionActive: false });
    selectMany(model.nodes.filter((n) => !fadedIds.has(n.id)).map((n) => n.id));
  };
  const selectionMenu = (): MenuItem[] => [
    ...ARRANGE.slice(0, 6).map((a): MenuItem => ({ kind: "item", label: a.label, onSelect: () => arrange(a.id) })),
    { kind: "separator" },
    ...ARRANGE.slice(6).map((a): MenuItem => ({ kind: "item", label: a.label, onSelect: () => arrange(a.id) })),
    { kind: "separator" },
    { kind: "item", label: "Clear selection", onSelect: () => clearSelection() },
    { kind: "item", label: `Delete ${multi.length} elements`, danger: true, onSelect: deleteSelection },
  ];
  const focusLayerHandle = (layer: Layer) => setTimeout(() => document.getElementById(layerHandleId(layer))?.focus(), 0);
  const nodeMenu = (id: string): MenuItem[] => {
    // An element in a selection of several: the menu acts on all of them.
    if (multiSet.has(id)) return selectionMenu();
    // A collapsed group's block (M56): its only action is to open again.
    if (id.startsWith("group:")) return [{ kind: "item", label: "Expand group", onSelect: () => toggleGroup(id.slice("group:".length)) }];
    const n = model.nodes.find((x) => x.id === id);
    if (!n) return [];
    const name = n.name || "Untitled";
    const count = hints.filter((h) => h.nodeIds.includes(id)).length;
    const layer = classById(n.class)?.layer;
    return [
      { kind: "item", label: "Rename", onSelect: () => (selectNode(id), setFocusName((k) => k + 1)) },
      { kind: "item", label: "Add a relationship…", onSelect: () => (selectNode(id), setFocusConnect((k) => k + 1)) },
      { kind: "item", label: "Add a related element…", onSelect: () => quickAddAt(id) },
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
      ...(isAnchor(n.class) ? [{ kind: "item" as const, label: "Show data flow", onSelect: () => openBlast(id, menuReturn.current, "dependencies", true, "flow") }] : []),
      ...(layer && (view.boxes || view.lanes)
        ? [{ kind: "item" as const, label: `Select the ${layerName(layer)} layer`, onSelect: () => (setSelectedLayer(layer), focusLayerHandle(layer)) }]
        : []),
      { kind: "separator" },
      { kind: "item", label: "Delete", danger: true, onSelect: () => (dispatch({ type: "delete-node", id }), setMessage(`Deleted ${name}. Undo restores it.`)) },
    ];
  };
  /** M61: keep a relationship's end on a chosen side of its element (null: back to automatic), and say so. */
  const setPorts = (e: Edge, p: { from?: Side | null; to?: Side | null }) => {
    dispatch({ type: "set-ports", id: e.id, ...p });
    const name = (nid: string) => model.nodes.find((n) => n.id === nid)?.name || "Untitled";
    const said = [
      p.from !== undefined ? (p.from ? `leaves ${name(e.from)} from the ${p.from}` : `leaves ${name(e.from)} where the layout puts it`) : "",
      p.to !== undefined ? (p.to ? `arrives at ${name(e.to)} at the ${p.to}` : `arrives at ${name(e.to)} where the layout puts it`) : "",
    ].filter(Boolean);
    setMessage(p.from === null && p.to === null ? "Connection points back to automatic." : `The relationship ${said.join(" and ")}.`);
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
      // M61: the side each end sits on, chosen here or by dragging the end; the check marks a chosen side.
      ...SIDES.map((sd): MenuItem => ({ kind: "check", label: `Leave from the ${sd}`, checked: e.ports?.from === sd, onSelect: () => setPorts(e, { from: e.ports?.from === sd ? null : sd }) })),
      ...SIDES.map((sd): MenuItem => ({ kind: "check", label: `Arrive at the ${sd}`, checked: e.ports?.to === sd, onSelect: () => setPorts(e, { to: e.ports?.to === sd ? null : sd }) })),
      { kind: "item", label: "Automatic connection points", disabled: !e.ports, onSelect: () => setPorts(e, { from: null, to: null }) },
      { kind: "separator" },
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
    { kind: "item", label: "Fit view", onSelect: () => zoomCommand("fit") },
    { kind: "item", label: "Zoom to selection", disabled: !selection.length, onSelect: () => zoomCommand("selection") },
    { kind: "item", label: "Select all", disabled: model.nodes.length < 2, onSelect: selectAll },
    { kind: "item", label: "Auto-layout", disabled: model.nodes.length === 0 || layingOut, onSelect: () => void runLayout() },
    ...(groupBy ? [{ kind: "item" as const, label: "Arrange by group", disabled: !groups.length, onSelect: arrangeGroups }] : []),
    { kind: "separator" },
    { kind: "check", label: "Layer boxes", checked: view.boxes, onSelect: () => setView({ ...view, boxes: !view.boxes }) },
    { kind: "check", label: "Lanes", checked: view.lanes, onSelect: () => setView({ ...view, lanes: !view.lanes }) },
    { kind: "check", label: "Snap to grid", checked: view.snap, onSelect: () => setView({ ...view, snap: !view.snap }) },
    { kind: "check", label: "Smart guides", checked: view.guides, onSelect: () => setView({ ...view, guides: !view.guides }) },
    { kind: "check", label: "Relationship labels", checked: view.labels, onSelect: () => setView({ ...view, labels: !view.labels }) },
  ];
  const canMenu = wide && !presenting;
  const labelOf = (id: string) => {
    if (id.startsWith("group:")) return `${groups.find((g) => `group:${g.key}` === id)?.label ?? "Group"} group menu`;
    const n = model.nodes.find((x) => x.id === id);
    return `${n?.name || "Untitled"} menu`;
  };
  const onCanvasKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    // The isometric projections are read only: no quick-add, no canvas menu.
    if (projection !== "plan") return;
    const inField = (t: HTMLElement) => t.isContentEditable || !!t.closest("input, textarea, select");
    // Ctrl+A selects every element in the view; Esc lets a selection of several go (M57).
    if (canMenu && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "a" && !inField(e.target as HTMLElement)) {
      e.preventDefault();
      selectAll();
      return;
    }
    if (e.key === "Escape" && multi.length && !inField(e.target as HTMLElement)) {
      e.preventDefault();
      clearSelection();
      return;
    }
    // Shift+A: quick-add to the focused element, else the selected one (M53).
    if (canMenu && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === "a") {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || t.closest("input, textarea, select")) return;
      const id = t.closest<HTMLElement>(".react-flow__node")?.dataset.id ?? selectedId;
      if (!id || id.startsWith("group:")) return;
      e.preventDefault();
      selectNode(id);
      quickAddAt(id);
      return;
    }
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

  // Compare (M58): this model against another saved model or a model file.
  const showComparison = (base: Model, label: string) => {
    setBlast(null);
    setCompareError(null);
    if (compareDialog) dialogClosed(setCompareDialog);
    setCompare({ base, label });
    setMessage(`Comparing with “${label}”: ${compareSummary(compareModels(model, base))}.`);
  };
  const compareWithModel = async (id: string) => {
    const base = await doc.read(id);
    if (!base) return setCompareError("That model could not be read.");
    showComparison(base, base.name || UNTITLED_MODEL);
  };
  const compareWithFile = async (file: File) => {
    // As Import: bytes first (a character can take up to four), then characters.
    const tooLarge = "That file is too large to be a model.";
    if (file.size > MAX_FILE_CHARS * 4) return setCompareError(tooLarge);
    const text = await file.text();
    if (text.length > MAX_FILE_CHARS) return setCompareError(tooLarge);
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      return setCompareError("That file is not a model file (it is not JSON).");
    }
    const r = parseModel(data);
    if (!r.ok) return setCompareError(r.error);
    showComparison(r.model, file.name);
  };
  const closeCompare = useCallback(() => {
    setCompare(null);
    setMessage("Compare closed.");
  }, []);
  // Another model opened: the comparison was of the one before.
  useEffect(() => setCompare(null), [model.id]);
  // Escape ends it, unless a menu, dialog, text field or a blast radius has the key.
  useEffect(() => {
    if (!compare || presenting || blast || menu || managing || palette || shortcuts || viewDialog || compareDialog) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      closeCompare();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compare, presenting, blast, menu, managing, palette, shortcuts, viewDialog, compareDialog, closeCompare]);

  // Blast radius: the start element, then each hop it reaches, played or stepped by hand.
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  const openBlast = (id: string, returnTo: HTMLElement | null, direction: BlastDirection = "impact", moveFocus = true, kind: BlastKind = "blast") => {
    const r = blastRadius(model, id, direction);
    // Reduced motion: no playing; the whole radius at once.
    const still = prefersStill();
    blastReturn.current = returnTo;
    setActiveHint(null);
    setReadEdgeId(null);
    setBlast({ start: id, direction, kind, step: still ? r.steps.length - 1 : 0, playing: !still && r.steps.length > 1 });
    setMessage(words(kind).announce(r, 0, nameOf));
    const ids = r.steps.flatMap((st) => st.nodeIds);
    void flow.fitView({ nodes: ids.map((n) => ({ id: n })), padding: 0.3, maxZoom: 1, duration: still ? 0 : 300 });
    if (moveFocus) setTimeout(() => playButton.current?.focus(), 0);
  };
  const blastTo = (step: number, playing = false) => {
    if (!blast || !radius) return;
    const k = Math.max(0, Math.min(step, radius.steps.length - 1));
    setBlast({ ...blast, step: k, playing });
    setMessage(words(blast.kind).announce(radius, k, nameOf));
  };
  const closeBlast = useCallback(() => {
    setBlast(null);
    setMessage(isFlow ? "Data flow closed." : "Blast radius closed.");
    const el = blastReturn.current;
    blastReturn.current = null;
    if (el?.isConnected) setTimeout(() => el.focus(), 0);
  }, [isFlow]);
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
      setMessage(words(blast.kind).announce(radius, blast.step + 1, nameOf));
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
      setMessage(words(blast.kind).announce(radius, radius.steps.length - 1, nameOf));
    }
  }, [blast, radius]); // eslint-disable-line react-hooks/exhaustive-deps -- nameOf reads the same model as radius
  // Escape closes it, unless a menu, dialog or text field has the key.
  useEffect(() => {
    if (!blast || menu || managing || palette || shortcuts || viewDialog) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      e.preventDefault();
      closeBlast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blast, menu, managing, palette, shortcuts, viewDialog, closeBlast]);

  // Present mode: the canvas alone, full screen, stepping through the model layer by layer.
  const steps = useMemo(() => [{ name: "Overview", nodeIds: [] as string[], layer: undefined as Layer | undefined }, ...boxes.map((b) => ({ name: b.name, nodeIds: b.nodeIds, layer: b.layer as Layer | undefined }))], [boxes]);
  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(i, steps.length - 1));
      setStep(next);
      const target = steps[next]!;
      // In isometric the step lifts its layer (see IsoView's lift); the picture refits after it redraws.
      if (isoRef.current) return void setTimeout(() => isoRef.current?.zoom("fit"), 0);
      void flow.fitView(target.nodeIds.length ? { nodes: target.nodeIds.map((id) => ({ id })), padding: 0.25, maxZoom: 1.25, duration: 400 } : { padding: fitPadding(0.12), maxZoom: 1, duration: 400 });
    },
    [steps, flow, fitPadding],
  );
  /**
   * What a present step shows, in words (M55), from the step itself (the elements its box holds):
   * `count` for the live step line, `list` (the elements by name and kind) for screen readers to read on demand.
   */
  const stepContents = (st: (typeof steps)[number] | undefined) => {
    const count = (n: number) => `${n} element${n === 1 ? "" : "s"}`;
    if (!st) return { count: "", list: "" };
    if (!st.layer) {
      const layers = steps.length - 1;
      const all = boxes.reduce((n, b) => n + b.nodeIds.length, 0);
      return { count: `${count(all)} in ${layers} layer${layers === 1 ? "" : "s"}.`, list: layers ? "Next shows each layer in turn." : "" };
    }
    const items = st.nodeIds.map((id) => outline.flatMap((l) => l.items).find((i) => i.id === id)).filter((i) => !!i);
    return { count: `${count(items.length)}.`, list: `The ${st.name} layer: ${items.map((i) => `${i.name} (${i.kind})`).join(", ")}.` };
  };
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
      if (isoRef.current) isoRef.current.zoom("fit");
      else void flow.fitView({ padding: fitPadding(0.12), maxZoom: 1, duration: 300 });
    }, 60);
  };
  const stopPresenting = useCallback(() => {
    setPresenting(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    setTimeout(() => {
      presentButton.current?.focus();
      if (isoRef.current) isoRef.current.zoom("fit");
      else void flow.fitView({ maxZoom: 1, padding: fitPadding(0.15) });
    }, 60);
  }, [flow, fitPadding]);
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
  /**
   * Select an element and bring it into view, from the palette's Go to or the outline (M55). A faded
   * element is out of reach: the filter lifts (keeping the coloring) first. The outline keeps its tab.
   */
  const goToElement = (id: string, keepTab = false) => {
    const n = model.nodes.find((x) => x.id === id);
    if (!n) return;
    if (fadedIds.has(id)) showView({ id: null, filter: {}, colorBy: shown.colorBy, groupBy: shown.groupBy });
    // Folded into a collapsed group (M56): open the group first, so the element can be shown and selected.
    const folded = hiddenIds.has(id);
    if (folded) {
      const ids = new Set(collapsedIds);
      ids.delete(primaryGroup(groups).get(id) ?? "");
      setCollapsed({ key: collapsedKey, ids });
    }
    if (keepTab) setSelectedId(id);
    else selectNode(id);
    // The isometric picture zooms to the selection once it has been drawn with it.
    if (isoRef.current) setTimeout(() => isoRef.current?.zoom("selection"), 0);
    else if (folded) setTimeout(() => void flow.fitView({ nodes: [{ id }], padding: 0.3, maxZoom: 1.25, duration: prefersStill() ? 0 : 300 }), 50);
    else void flow.fitView({ nodes: [{ id }], padding: 0.3, maxZoom: 1.25, duration: prefersStill() ? 0 : 300 });
    setMessage(`Selected ${classById(n.class)?.label ?? n.class} “${n.name || "Untitled"}”.`);
  };
  const scopedHints = selected ? hints.filter((h) => h.nodeIds.includes(selected.id)) : hints;
  const scopedWarnings = scopedHints.filter((h) => h.hint.severity === "warning").length;
  const reading = useMemo(() => readModel(model, lens, selectedId), [model, lens, selectedId]);
  const outline = useMemo(() => outlineModel(model, lens), [model, lens]);
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

  // Export menu notes and availability, shared with the command palette.
  const exportNotes: Partial<Record<ExportKind, string>> = {
            link: !canShare
              ? "This browser cannot make model links"
              : share?.model !== model
                ? undefined
                : share.size === "too-large"
                ? "Too large to share as a link: use Model file (JSON)"
                : share.size === "long"
                  ? `Long link (${kb(share.url)}): some chat and email apps cut links this long`
                  : undefined,
            drawio: lucidFitNote(lucidFit(model)),
            "blast-gif": makingGif
              ? "Making the GIF…"
              : blast && radius && !isFlow
                ? `${radius.steps.length} frame${radius.steps.length === 1 ? "" : "s"}, up to ${GIF_MAX_SIDE} px, in the theme you are viewing`
                : "Show a blast radius first: right-click an element",
            "flow-gif": makingGif
              ? "Making the GIF…"
              : blast && radius && isFlow
                ? `${radius.steps.length} frame${radius.steps.length === 1 ? "" : "s"}, up to ${GIF_MAX_SIDE} px, in the theme you are viewing`
                : "Show a data flow first: right-click a Business Capability or Business Process",
          };
  const exportDisabled: Partial<Record<ExportKind, boolean>> = {
            link: !canShare || (share?.model === model && share.size === "too-large"),
            "blast-gif": !blast || !radius || isFlow || makingGif,
            "flow-gif": !blast || !radius || !isFlow || makingGif,
          };

  const openDialog = (open: (v: boolean) => void) => {
    dialogReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    open(true);
  };
  /** A dialog closed: focus back where it was opened, then the command chosen, so a command that moves focus wins. */
  const dialogClosed = (close: (v: boolean) => void, chosen?: Command) => {
    close(false);
    const el = dialogReturn.current;
    dialogReturn.current = null;
    if (el?.isConnected) el.focus();
    chosen?.run();
  };
  const openBlank = () => {
    setSelectedId(null);
    setActiveHint(null);
    void doc.newModel().then(() => setMessage("Opened a new blank model."));
  };

  /**
   * Everything the command palette lists (M52), built while it is open: the toolbar's actions in
   * toolbar order, then every element by name. Edit-only commands follow the toolbar: not below 768px.
   */
  const paletteCommands = (): Command[] => {
    const empty = model.nodes.length === 0 ? "The model has no elements yet" : undefined;
    const list: Command[] = [
      { id: "new", group: "Model", label: "New model", keywords: "blank create", run: () => void doc.newModel() },
      { id: "manage", group: "Model", label: "Manage models…", keywords: "delete download saved", run: () => setManaging(true) },
      ...doc.models
        .filter((m) => m.id !== model.id)
        .map((m): Command => ({ id: `open-${m.id}`, group: "Model", label: `Open “${m.name || UNTITLED_MODEL}”`, keywords: m.artifactId, run: () => {
          setSelectedId(null);
          setActiveHint(null);
          void doc.open(m.id);
        } })),
      { id: "example-blank", group: "Examples", label: "Blank model", keywords: "example new", run: openBlank },
      ...examples.map((ex): Command => ({ id: `example-${ex.id}`, group: "Examples", label: `Example: ${ex.name}`, run: () => void loadExample(ex.id) })),
      ...(wide ? [{ id: "import", group: "Model", label: "Import…", keywords: "open file json", run: () => fileInput.current?.click() }] : []),
      ...exportItems.map((it): Command => ({
        id: `export-${it.kind}`,
        group: "Export",
        label: it.kind === "link" || it.kind === "print" ? it.label : `Export ${it.label}`,
        keywords: "export download save",
        disabled: exportDisabled[it.kind] ? exportNotes[it.kind] : undefined,
        run: () => exportAs(it.kind),
      })),
      { id: "undo", group: "Edit", label: "Undo", keys: "Ctrl+Z", disabled: doc.canUndo ? undefined : "Nothing to undo", run: () => dispatch({ type: "undo" }) },
      { id: "redo", group: "Edit", label: "Redo", keys: "Ctrl+Shift+Z", disabled: doc.canRedo ? undefined : "Nothing to redo", run: () => dispatch({ type: "redo" }) },
      ...(wide
        ? classes
            .filter((c) => view.extended || !isExtended(c))
            .map((c): Command => ({ id: `add-${c.id}`, group: "Add", label: `Add ${c.label}`, keywords: "new element", run: () => addNode(c.id) }))
        : []),
      ...(wide
        ? [{ id: "quick-add", group: "Add", label: "Add a related element…", keys: "Shift+A", keywords: "connect new relationship", disabled: selectedId ? undefined : "Select an element first", run: () => selectedId && quickAddAt(selectedId) }]
        : []),
      ...(wide
        ? [
            { id: "select-all", group: "Arrange", label: "Select all elements", keys: "Ctrl+A", keywords: "selection multiple", disabled: model.nodes.length < 2 ? "Add two or more elements first" : projection !== "plan" ? "Switch to Plan to select elements" : undefined, run: selectAll },
            { id: "arrange-groups", group: "Arrange", label: "Arrange by group", keywords: "group frames band", disabled: !groupBy ? "Pick a grouping in Views first" : !groups.length ? "This model has no groups for that grouping" : undefined, run: arrangeGroups },
            ...ARRANGE.map((a): Command => ({ id: `arrange-${a.id}`, group: "Arrange", label: a.label, keywords: "selection line up spread", disabled: multi.length < 2 ? "Select two or more elements first (Shift+click)" : undefined, run: () => arrange(a.id) })),
          ]
        : []),
      ...(wide
        ? layoutChoices.map((c): Command => ({ id: `layout-${c.id}`, group: "Layout", label: c.id === "auto" ? c.label : `Layout: ${c.label}`, keywords: "arrange", disabled: empty ?? (layingOut ? "A layout is running" : undefined), run: () => chooseLayout(c.id) }))
        : []),
      ...viewItems.map((it): Command => ({
        id: `view-${it.key}`,
        group: "View",
        // Snapping is turned on, the rest are shown.
        label: it.key === "snap" || it.key === "guides" ? `Turn ${view[it.key] ? "off" : "on"} ${it.label.toLowerCase()}` : `${view[it.key] ? "Hide" : "Show"} ${it.label.toLowerCase()}`,
        keywords: it.note,
        run: () => setView({ ...view, [it.key]: !view[it.key] }),
      })),
      ...lineStyles
        .filter((l) => l.id !== view.lines)
        .map((l): Command => ({ id: `lines-${l.id}`, group: "View", label: `Line style: ${l.label}`, keywords: "relationship", run: () => setView({ ...view, lines: l.id }) })),
      { id: "compare", group: "Model", label: "Compare with…", keywords: "diff changes difference version file saved model", run: () => openDialog(setCompareDialog) },
      ...(compare ? [{ id: "compare-close", group: "Model", label: "Close compare", keys: "Esc", keywords: "diff", run: closeCompare }] : []),
      { id: "view-edit", group: "Views", label: "Filter and color…", keywords: "view legend color by lifecycle environment owner", run: () => openDialog(setViewDialog) },
      {
        id: "view-all",
        group: "Views",
        label: "Show all elements",
        keywords: "view reset clear filter",
        disabled: shown.id === null && !filterActive(shown.filter) && shown.colorBy === "layer" && !shown.groupBy ? "Already showing all elements, in layer colors" : undefined,
        run: () => pickView({ id: null, filter: {}, colorBy: "layer" }),
      },
      ...(model.views ?? []).map((v): Command => ({ id: `view-${v.id}`, group: "Views", label: `View: ${v.name}`, keywords: "saved view", run: () => pickView({ id: v.id, filter: v.filter, colorBy: v.colorBy, groupBy: v.groupBy }) })),
      ...(["plan", "iso", "exploded"] as const)
        .filter((p) => p !== projection)
        .map((p): Command => ({ id: `projection-${p}`, group: "Projection", label: `${PROJECTION_LABEL[p]} view`, keywords: p === "plan" ? "edit 2d canvas" : "isometric 3d layers stack read only", run: () => chooseProjection(p) })),
      { id: "zoom-fit", group: "Zoom", label: "Fit view", keys: "Shift+1", keywords: "whole model", run: () => zoomCommand("fit") },
      { id: "zoom-selection", group: "Zoom", label: "Zoom to selection", keys: "Shift+2", disabled: selection.length ? undefined : "Select an element first", run: () => zoomCommand("selection") },
      ...ZOOM_PRESETS.map((z): Command => ({ id: `zoom-${z}`, group: "Zoom", label: `Zoom to ${z * 100}%`, keys: z === 1 ? "Shift+0" : undefined, run: () => zoomCommand(z) })),
      ...lenses
        .filter((l) => l.id !== lens)
        .map((l): Command => ({ id: `lens-${l.id}`, group: "Lens", label: `Lens: ${l.label}`, keywords: "framework", run: () => setLens(l.id) })),
      { id: "present", group: "Present", label: "Present", keywords: "slides full screen", disabled: empty, run: startPresenting },
      { id: "shortcuts", group: "Help", label: "Keyboard shortcuts", keys: "?", keywords: "keys help", run: () => openDialog(setShortcuts) },
    ];
    const className = (id: string) => classById(model.nodes.find((n) => n.id === id)?.class ?? "")?.label ?? "";
    const goTo = model.nodes.map((n): Command => ({
      id: `go-${n.id}`,
      group: "Go to",
      label: `${n.name || "Untitled"}`,
      keywords: `${className(n.id)} element select find`,
      run: () => goToElement(n.id),
    }));
    return [...list, ...goTo];
  };

  // After `outline` is declared: the step's words read it.
  const shownStep = stepContents(steps[step]);
  return (
    <div className={presenting ? "fixed inset-0 z-50 flex flex-col bg-surface" : "flex h-[calc(100dvh-3.5rem)] min-h-[34rem] flex-col bg-surface"}>
      {presenting && (
        <div role="region" aria-label="Presentation" className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          <p className="font-mono text-xs tracking-[0.14em] text-accent uppercase">Presenting</p>
          <h1 className="text-sm font-medium">{model.name || UNTITLED_MODEL}</h1>
          {/* The canvas title block is hidden from screen readers while presenting; its details are read here. */}
          {model.artifactId && <p className="sr-only">Artifact ID {model.artifactId}</p>}
          <p className="sr-only">Dated {formatModelDate(modelDate(model))}</p>
          {model.description && <p className="sr-only">{model.description}</p>}
          {/* The step, announced whole on each change; with how many elements it shows (M55). */}
          <p className="text-sm text-ink-muted" aria-live="polite" aria-atomic="true" data-testid="present-step">
            {`${steps[step]?.name} · ${step + 1} of ${steps.length}`}
            <span className="sr-only">{`. ${shownStep.count}`}</span>
          </p>
          {/* What the step shows, by name, for screen readers to read when they choose (the canvas is a picture to them). */}
          <p className="sr-only" data-testid="present-contents">
            {shownStep.list}
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
      {/* relative: the Model and Examples panels span the toolbar. */}
      <div className={`relative flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 ${presenting ? "hidden" : ""}`}>
        <div role="group" aria-label="Model" className={toolbarGroup}>
        <span className={groupCaption} aria-hidden="true">
          Model
        </span>
        <ModelMenu
          buttonClass={toolbarButton}
          models={doc.models}
          currentId={model.id}
          currentName={model.name}
          onCompare={() => openDialog(setCompareDialog)}
          onOpen={(id) => {
            setSelectedId(null);
            setActiveHint(null);
            void doc.open(id);
          }}
        />
        <button type="button" className={toolbarButton} onClick={() => setManaging(true)}>
          <ToolbarIcon name="manage" />
          Manage…
        </button>
        <button type="button" className={toolbarButton} onClick={() => void doc.newModel()} aria-label="New model">
          <ToolbarIcon name="new" />
          New
        </button>
        <ExamplesMenu
          buttonClass={toolbarButton}
          onPick={(id) => void loadExample(id)}
          onBlank={openBlank}
        />
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
        <ExportMenu
          onExport={exportAs}
          buttonClass={toolbarButton}
          onOpen={prepareShare}
          notes={exportNotes}
          disabled={exportDisabled}
        />
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
          {wide && <LayoutMenu busy={layingOut} disabled={model.nodes.length === 0} onChoose={chooseLayout} buttonClass={toolbarButton} />}
          <ViewMenu value={view} onChange={setView} buttonClass={toolbarButton} />
          <ViewsMenu model={model} shown={shown} onShow={pickView} onEdit={() => openDialog(setViewDialog)} buttonClass={toolbarButton} />
          <ZoomMenu onCommand={zoomCommand} canZoomToSelection={selection.length > 0} buttonClass={toolbarButton} level={projection === "plan" ? undefined : isoZoom} />
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
        {/* Projection (M59): the editable plan, or the model in isometric, layers close or spread. */}
        <div role="group" aria-label="Projection" className={toolbarGroup}>
          <span className={groupCaption} aria-hidden="true">
            Projection
          </span>
          <div className="flex">
            {(["plan", "iso", "exploded"] as const).map((p, i) => (
              <button
                key={p}
                type="button"
                aria-pressed={projection === p}
                onClick={() => chooseProjection(p)}
                className={`${toolbarButton} ${i ? "-ml-px" : ""} ${projection === p ? "relative !border-accent !bg-accent !text-accent-ink" : ""}`}
              >
                {p === "plan" ? "Plan" : p === "iso" ? "Iso" : "Exploded"}
              </button>
            ))}
          </div>
        </div>
        {/* Commands and Present wrap together, so Present never sits alone on a second row. */}
        <div className="flex items-center gap-2">
          {/* Icon only from 1778 to 1847px: there the word would push Present onto a second row (narrower, the toolbar has two rows anyway). */}
          <button type="button" className={toolbarButton} onClick={() => openDialog(setPalette)} aria-label="Commands" title="Commands (Ctrl+K or ⌘K)" aria-keyshortcuts="Control+K Meta+K">
            <ToolbarIcon name="commands" />
            <span aria-hidden="true" className="min-[1778px]:max-[1847px]:hidden">
              Commands
            </span>
          </button>
          <button ref={presentButton} type="button" className={primaryButton} disabled={model.nodes.length === 0} onClick={startPresenting}>
            <ToolbarIcon name="present" />
            Present
          </button>
        </div>
      </div>

      {linkField && !presenting && (
        <div
          ref={linkRegion}
          role="region"
          aria-label="Copy the link by hand"
          className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-raised px-4 py-2 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              closeLinkField();
            }
          }}
        >
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0">Link to this model</span>
            <input
              ref={linkInput}
              readOnly
              value={linkField}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 border border-border-strong bg-surface px-2 py-1 font-mono text-xs text-ink"
            />
          </label>
          <button type="button" className={toolbarButton} aria-label="Close link" onClick={closeLinkField}>
            Close
          </button>
        </div>
      )}
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

      {compare && comparison && !presenting && (
        <CompareBar base={compare} comparison={comparison} onGo={(id) => goToElement(id, true)} onClose={closeCompare} buttonClass={toolbarButton} />
      )}
      {blast && radius && !presenting && (
        <div role="region" aria-label={isFlow ? "Data flow" : "Blast radius"} className="flex flex-col gap-1.5 border-b border-border px-4 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`font-mono text-xs tracking-[0.14em] uppercase ${isFlow ? "text-ai" : "text-status"}`}>{isFlow ? "Data flow" : "Blast radius"}</p>
            <h2 className="text-sm font-medium">
              {isFlow ? `Data flow from ${nameOf(blast.start)}` : blast.direction === "impact" ? `If ${nameOf(blast.start)} fails` : `What ${nameOf(blast.start)} needs`}
            </h2>
            {!isFlow && (
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
            )}
            <p className="text-sm text-ink-muted" data-testid="blast-progress">
              {words(blast.kind).progress(radius, blast.step)}
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
              {words(blast.kind).steps(radius, nameOf).map((st) => (
                <li key={st.hop} className={st.hop === blast.step ? "font-medium text-ink" : "text-ink-soft"} aria-current={st.hop === blast.step ? "step" : undefined}>
                  <span className="font-mono text-xs text-ink-muted">{st.label}:</span> {st.names.join(", ")}
                </li>
              ))}
            </ol>
            {radius.truncated && <p className="mt-1 text-xs text-ink-muted">Stopped after {radius.steps.length - 1} {isFlow ? "steps" : "hops"}; more elements lie beyond.</p>}
            <p className="mt-1 text-xs text-ink-muted">
              Follows the impact rules in the{" "}
              <Link className="text-accent underline underline-offset-4" href="/guide#impact">
                guide
              </Link>
              {isFlow ? ", read as dependencies" : ""}. Not ServiceNow&apos;s Impacted Services calculation.
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
          <ReconnectingContext.Provider value={reconnectingNow}>
          <SuggestContext.Provider value={suggestCtx}>
          {/* In an isometric projection the plan canvas stays mounted underneath, out of reach. */}
          <div className="contents" inert={projection !== "plan" || undefined}>
          <LabelObstacles boxes={boxes} tabsAbove={canMenu} show={(view.boxes || presenting) && !view.lanes} plan={labelPlan}>
          <LineStyleContext.Provider value={view.lines}>
            <ReactFlow<CanvasNode, FlowEdge>
              nodes={canvasNodes}
              edges={canvasEdges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              isValidConnection={(c) => {
                // Moving a relationship's end (M61): only to another point on the same element.
                const moving = reconnecting.current && model.edges.find((x) => x.id === reconnecting.current);
                if (moving) return c.source === moving.from && c.target === moving.to;
                return connectionProblem(model, c.source, c.target) === null;
              }}
              // M61: drag either end of a relationship to another point on its element, and it stays there.
              edgesReconnectable={wide && !presenting && projection === "plan"}
              onReconnectStart={(_, edge) => {
                reconnecting.current = edge.id;
                portsStored.current = false;
                setReconnectingNow(true);
                setMessage("Drop the end on another point of the same element, and the relationship keeps it.");
              }}
              onReconnect={(old, c) => {
                const e = model.edges.find((x) => x.id === old.id);
                if (!e || c.source !== e.from || c.target !== e.to) return;
                const p = {
                  ...(c.sourceHandle && c.sourceHandle !== old.sourceHandle ? { from: c.sourceHandle as Side } : {}),
                  ...(c.targetHandle && c.targetHandle !== old.targetHandle ? { to: c.targetHandle as Side } : {}),
                };
                if (p.from || p.to) {
                  portsStored.current = true;
                  setPorts(e, p);
                }
              }}
              onReconnectEnd={() => {
                reconnecting.current = null;
                setReconnectingNow(false);
                // Let go without a new side (dropped back, elsewhere or cancelled): the hint goes.
                if (!portsStored.current) setMessage("");
              }}
              onConnectEnd={(event, state) => {
                connecting.current = false;
                // Moving an existing relationship's end (M61) goes through onReconnect: no explanations, no Quick Add.
                if (reconnecting.current) {
                  connectStart.current = null;
                  return;
                }
                // Refused connections never reach onConnect, so explain them here.
                if (state.fromNode && state.toNode && !state.isValid) setMessage(connectionProblem(model, state.fromNode.id, state.toNode.id) ?? "");
                // Dropped on empty canvas after a real drag: offer a new element there (M53).
                const p = clientPoint(event);
                const start = connectStart.current;
                connectStart.current = null;
                if (!canMenu || !state.fromNode || state.toNode || !p || !start || Math.hypot(p.x - start.x, p.y - start.y) < 24) return;
                // React Flow reports no target unless the drop is near a handle, so check what is under the
                // pointer: empty canvas only — not an element's body, a panel, or outside the canvas.
                const under = document.elementsFromPoint(p.x, p.y);
                if (!under.some((el) => el.closest(".react-flow")) || under.some((el) => el.closest(".react-flow__node, .react-flow__panel, .react-flow__node-toolbar"))) return;
                const f = flow.screenToFlowPosition(p);
                const snap = (v: number) => (view.snap ? Math.round(v / 16) * 16 : Math.round(v));
                // Centered on the drop point; with lanes on it goes to its own layer instead, as a drag would.
                const at = view.lanes ? undefined : { x: snap(f.x - DEFAULT_SIZE.width / 2), y: snap(f.y - DEFAULT_SIZE.height / 2) };
                openQuickAdd(state.fromNode.id, p.x, p.y, nodeEl(state.fromNode.id), at);
              }}
              connectionLineComponent={ConnectionLine}
              onNodeMouseEnter={(_, n) => hoverNode(n.id)}
              onNodeMouseLeave={() => hoverNode(null)}
              onNodeDragStart={() => hoverNode(null)}
              onConnectStart={(event, { nodeId }) => {
                if (reconnecting.current) return;
                connecting.current = true;
                connectStart.current = clientPoint(event);
                hoverNode(null);
                const from = model.nodes.find((n) => n.id === nodeId);
                if (!from) return;
                const count = model.nodes.filter((n) => n.id !== from.id && connectionProblem(model, from.id, n.id) === null).length;
                setMessage(
                  count
                    ? `Drop on an outlined element: ${count} can take a relationship from ${from.name || "this element"}. Or drop on empty canvas to add a new one.`
                    : `Nothing on the canvas can take a relationship drawn from ${from.name || "this element"}. Drop on empty canvas to add a new related element, or try drawing it from the other element.`,
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
              // React Flow listens for Delete on the document, past `inert`: the isometric projections are read only.
              deleteKeyCode={wide && !presenting && projection === "plan" && !palette && !shortcuts && !managing && !viewDialog ? ["Delete", "Backspace"] : null}
              // Delete and Backspace: the selected elements, their relationships and any selected
              // relationship go together, as one undo step (React Flow would report each on its own).
              onBeforeDelete={async ({ nodes: gone, edges: lines }) => {
                if (!gone.length) return true;
                const ids = gone.map((n) => n.id);
                dispatch({ type: "delete-nodes", ids, edgeIds: lines.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)).map((e) => e.id) });
                if (ids.length > 1) setMessage(`Deleted ${ids.length} elements. Undo restores them.`);
                return false;
              }}
              snapToGrid={view.snap}
              snapGrid={[16, 16]}
              // M57: Shift (or Ctrl, ⌘) + click adds to the selection; Shift + drag on the canvas selects in a box.
              multiSelectionKeyCode={wide && !presenting ? MULTI_KEYS : null}
              selectionKeyCode={wide && !presenting ? "Shift" : null}
              fitView
              fitViewOptions={firstFitOptions}
              minZoom={0.2}
            >
              <NotationMarkers />
              {guides.length > 0 && (
                <ViewportPortal>
                  {guides.map((g, i) => (
                    <div
                      key={i}
                      data-testid="guide"
                      data-axis={g.axis}
                      aria-hidden
                      className="bm-guide"
                      // One screen pixel wide at any zoom.
                      style={g.axis === "x" ? { left: g.at, top: g.from - 12, height: g.to - g.from + 24, width: 1 / flow.getZoom() } : { top: g.at, left: g.from - 12, width: g.to - g.from + 24, height: 1 / flow.getZoom() }}
                    />
                  ))}
                </ViewportPortal>
              )}
              <Panel position="top-right" className="!m-3 flex flex-col items-end gap-2">
                <NotationLegend types={legendTypes} />
                <ViewLegend
                  model={model}
                  shown={shown}
                  groups={groups.length}
                  onArrange={presenting ? undefined : arrangeGroups}
                  onEdit={presenting ? undefined : () => openDialog(setViewDialog)}
                  onShowAll={
                    presenting
                      ? undefined
                      : () => {
                          pickView({ id: null, filter: {}, colorBy: "layer" });
                          // The legend (and this button) goes away: keep focus on the Views button.
                          document.getElementById("views-button")?.focus();
                        }
                  }
                />
              </Panel>
              <Background id="minor" variant={BackgroundVariant.Dots} gap={32} size={3} color="var(--canvas-grid)" />
              <Background id="major" variant={BackgroundVariant.Dots} gap={160} size={5} color="var(--canvas-grid-major)" />
              {!presenting && <FitControls hasDescription={!!model.description} />}
              {wide && !presenting && view.minimap && (
                <MiniMap<ClassFlowNode>
                  pannable
                  zoomable
                  position="bottom-right"
                  ariaLabel="Model overview: drag to pan, scroll to zoom"
                  bgColor="var(--surface-raised)"
                  maskColor="var(--minimap-mask)"
                  maskStrokeColor="var(--accent)"
                  maskStrokeWidth={2}
                  nodeStrokeWidth={0}
                  nodeBorderRadius={0}
                  nodeColor={(n) => minimapColor[classById(n.data.cls)?.layer ?? "design"]}
                />
              )}
              {frames.length > 0 && !presenting && <GroupOverlay frames={frames} onToggle={toggleGroup} onFocusTab={revealFrame} kind={groupLabel} />}
              <LayerOverlay boxes={boxes} lanes={lanes} showBoxes={view.boxes || presenting} showLanes={view.lanes} handlers={canMenu ? layerHandlers : undefined} />
              <CanvasTitle name={model.name} date={modelDate(model)} description={model.description} artifactId={model.artifactId} boxes={boxes} tabsAbove={(view.boxes && !view.lanes && canMenu) || (view.lanes && columns)} decorative={presenting} />
            </ReactFlow>
          </LineStyleContext.Provider>
          </LabelObstacles>
          </div>
          </SuggestContext.Provider>
          </ReconnectingContext.Provider>
          </ConnectionModelContext.Provider>
          {projection !== "plan" && (
            <IsoView
              ref={isoRef}
              model={model}
              mode={projection}
              view={imageView}
              highlight={isoHighlight}
              sizes={measured.current}
              selectedId={selectedId}
              onSelect={(id) => (id ? selectNode(id) : setSelectedId(null))}
              onZoom={setIsoZoom}
              lift={presenting ? steps[step]?.layer : undefined}
            />
          )}
          {model.nodes.length === 0 && doc.status !== "loading" && blankFor !== model.id && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
              <div data-testid="empty-state" className="pointer-events-auto max-h-full max-w-lg overflow-y-auto border border-border bg-surface-raised p-6">
                <p className="font-mono text-xs tracking-[0.14em] text-accent uppercase">{"// Empty model"}</p>
                <h2 className="mt-2 text-lg font-semibold">Start blank, or open an example</h2>
                <ul className="mt-4 flex flex-col gap-2">
                  <li>
                    <button type="button" onClick={startBlank} className="w-full cursor-pointer border border-accent p-3 text-left hover:bg-surface">
                      <span className="block text-sm font-medium text-ink">Blank model</span>
                      <span className="mt-1 block text-xs text-ink-muted">An empty canvas: add elements from the palette.</span>
                    </button>
                  </li>
                </ul>
                {exampleCategories.map((c) => (
                  <section key={c.id} className="mt-4">
                    <h3 className="font-mono text-[0.65rem] tracking-[0.14em] text-accent uppercase">{c.label}</h3>
                    <ul className="mt-2 flex flex-col gap-2">
                      {examples
                        .filter((ex) => ex.category === c.id)
                        .map((ex) => (
                          <li key={ex.id}>
                            <button type="button" onClick={() => void loadExample(ex.id)} className="w-full cursor-pointer border border-border p-3 text-left hover:border-accent">
                              <span className="block text-sm font-medium text-ink">{ex.name}</span>
                              <span className="mt-1 block text-xs text-ink-muted">{ex.summary}</span>
                            </button>
                          </li>
                        ))}
                    </ul>
                  </section>
                ))}
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
              {tab === "details" && multi.length > 1 ? (
                <SelectionPanel
                  names={multi.map(nameOf)}
                  nodes={model.nodes.filter((n) => multiSet.has(n.id))}
                  suggestions={batchSuggestions}
                  onArrange={arrange}
                  onSetAttr={setAttrForAll}
                  onDelete={deleteSelection}
                  onClear={() => clearSelection(true)}
                />
              ) : tab === "details" ? (
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
                  onFlow={selected && isAnchor(selected.class) ? (from) => selectedId && openBlast(selectedId, from, "dependencies", true, "flow") : undefined}
                />
              ) : tab === "read" ? (
                <ReadPanel
                  reading={reading}
                  activeEdgeId={readEdge?.id ?? null}
                  onFocus={focusRead}
                  scopeName={selected?.name}
                  mode={readMode}
                  onMode={setReadMode}
                  outline={outline}
                  onGo={(id) => goToElement(id, true)}
                  selectedIds={selection}
                  faded={fadedIds}
                />
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
      {palette && <CommandPalette commands={paletteCommands()} onClose={(chosen) => dialogClosed(setPalette, chosen)} />}
      {shortcuts && <ShortcutMap onClose={() => dialogClosed(setShortcuts)} />}
      {compareDialog && (
        <CompareDialog
          models={doc.models}
          currentId={model.id}
          error={compareError}
          onModel={(id) => void compareWithModel(id)}
          onFile={(f) => void compareWithFile(f)}
          onClose={() => {
            setCompareError(null);
            dialogClosed(setCompareDialog);
          }}
        />
      )}
      {viewDialog && (
        <ViewDialog
          model={model}
          shown={shown}
          onChange={showView}
          onSave={(name) => {
            const id = newId();
            dispatch({ type: "save-view", view: { id, name, filter: shown.filter, colorBy: shown.colorBy, ...(shown.groupBy ? { groupBy: shown.groupBy } : {}) } });
            showView({ ...shown, id });
            setMessage(`Saved the view “${name}”.`);
          }}
          onUpdate={(name) => {
            if (!shown.id) return;
            dispatch({ type: "save-view", view: { id: shown.id, name, filter: shown.filter, colorBy: shown.colorBy, ...(shown.groupBy ? { groupBy: shown.groupBy } : {}) } });
            setMessage(`Updated the view “${name}”.`);
          }}
          onDelete={() => {
            const gone = model.views?.find((v) => v.id === shown.id);
            if (!gone) return;
            dispatch({ type: "delete-view", id: gone.id });
            showView({ ...shown, id: null });
            setMessage(`Deleted the view “${gone.name}”. Its filter still shows until you change it.`);
          }}
          onClose={() => dialogClosed(setViewDialog)}
        />
      )}
      {menu && <ContextMenu key={menu.n} x={menu.x} y={menu.y} label={menu.label} items={menu.items} onClose={closeMenu} />}
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
