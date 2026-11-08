/**
 * Views (M54): which elements a filter keeps, and how elements are colored. Pure, shared by the
 * canvas, the legend and image export, so all three agree. A value's color is fixed by the whole
 * model (not the filtered part), so filtering never recolors anything.
 */
import { classById, LIFE_CYCLE } from "@/metamodel";
import { PLAN_LABEL, PLAN_STATUSES, type PlanStatus } from "./plan";
import { COLOR_BY, COLOR_BY_EXT, type ColorBy, type Model, type Node, type View, type ViewFilter } from "./schema";

/** M88: the decisions filter's values in words, in the order they are offered. */
export const DECISIONS_FILTER_LABEL = { with: "Has decisions", without: "No decisions" } as const;

export const ALL_ELEMENTS: { filter: ViewFilter; colorBy: ColorBy } = { filter: {}, colorBy: "layer" };

/** An element's value for a view property, trimmed; "" when not set. */
export const attrValue = (n: Node, key: "lifecycle" | "environment" | "owner") => (n.attrs?.[key] ?? "").trim();

const dims = (f: ViewFilter) => [
  [f.layers, (n: Node) => classById(n.class)?.layer ?? ""],
  [f.classes, (n: Node) => n.class],
  [f.lifecycle, (n: Node) => attrValue(n, "lifecycle")],
  [f.environment, (n: Node) => attrValue(n, "environment")],
  [f.owner, (n: Node) => attrValue(n, "owner")],
  [f.plan, (n: Node) => n.plan ?? "live"],
] as const;

/** M69: an element carrying any tag listed (ignoring case); "" keeps the untagged. */
const tagsMatch = (n: Node, vals: string[]) => {
  const tags = n.tags ?? [];
  if (!tags.length) return vals.includes("");
  const want = new Set(vals.map((v) => v.toLowerCase()));
  return tags.some((t) => want.has(t.toLowerCase()));
};

/** M88: the elements some decision concerns, worked out once per model. */
const decidedCache = new WeakMap<Model, ReadonlySet<string>>();
function decidedIds(model: Model): ReadonlySet<string> {
  let ids = decidedCache.get(model);
  if (!ids) decidedCache.set(model, (ids = new Set((model.decisions ?? []).flatMap((d) => d.elements ?? []))));
  return ids;
}

/** Whether the filter narrows anything. */
export const filterActive = (f: ViewFilter) => dims(f).some(([vals]) => !!vals?.length) || !!f.tags?.length || !!f.decisions?.length;

/**
 * Whether an element is in the view: every dimension that lists values must contain the element's.
 * The model is needed for what isn't on the element itself (M88: the decisions about it).
 */
export const inView = (n: Node, f: ViewFilter, model: Model) =>
  dims(f).every(([vals, get]) => !vals?.length || vals.includes(get(n))) &&
  (!f.tags?.length || tagsMatch(n, f.tags)) &&
  (!f.decisions?.length || f.decisions.includes(decidedIds(model).has(n.id) ? "with" : "without"));

/**
 * Categorical colors for "color by", as literal hex (they go into exported images too), each at
 * least 3:1 on the element surface (#172738 dark, #ffffff light). Other and Not set follow.
 */
export const PALETTE = {
  dark: ["#5ec8ff", "#deb163", "#b4a7ff", "#7fd49a", "#ff9f80", "#f08fc0", "#e6e07a", "#9fb4cc"],
  light: ["#005785", "#6d4e17", "#2000d6", "#1f6f3a", "#b23c17", "#a3226b", "#5f5800", "#406996"],
  other: { dark: "#8a96a6", light: "#5c6773" },
  none: { dark: "#3b4f66", light: "#c3ccd6" },
} as const;

/** One marker shape per slot (path in a 10×10 box), so a value never rests on color alone. */
export const MARKERS = {
  slots: [
    "M5 0.5a4.5 4.5 0 1 0 0.01 0Z", // circle
    "M5 0.5 9.5 9.5H0.5Z", // triangle
    "M1 1H9V9H1Z", // square
    "M5 0 10 5 5 10 0 5Z", // diamond
    "M0.5 0.5H9.5L5 9.5Z", // triangle, pointing down
    "M5 0.5 9.3 3.2V7.8L5 10.5 0.7 7.8V3.2Z", // hexagon
    "M3.5 0H6.5V3.5H10V6.5H6.5V10H3.5V6.5H0V3.5H3.5Z", // plus
    "M1.8 0 5 3.2 8.2 0 10 1.8 6.8 5 10 8.2 8.2 10 5 6.8 1.8 10 0 8.2 3.2 5 0 1.8Z", // cross
  ],
  other: "M5 1a4 4 0 1 0 0.01 0ZM5 3a2 2 0 1 1-0.01 0Z", // ring
  none: "M1 4H9V6H1Z", // dash
} as const;

export type Slot = number | "other" | "none";
/** `key`: unique per row (the value, "" for Not set, or "(other)" for the values past the palette, gathered in one row). */
export type LegendEntry = { key: string; value: string; label: string; count: number; slot: Slot };

/** Every life cycle stage once, in the order the white paper's processes give them. */
const STAGE_ORDER = [...new Set(Object.values(LIFE_CYCLE).flatMap((p) => p.stages))];
const stageRank = (v: string) => (STAGE_ORDER.includes(v) ? STAGE_ORDER.indexOf(v) : STAGE_ORDER.length);

/** How to read an element's value under a coloring. Tags (M77) count by the first, ignoring case, in the model's first spelling. */
function valueFn(model: Model, by: ColorBy): (n: Node) => string {
  if (by === "layer") return (n) => classById(n.class)?.layer ?? "";
  if (by === "plan") return (n) => n.plan ?? "live";
  if (by === "tag") {
    const spelling = new Map<string, string>();
    for (const n of model.nodes) for (const t of n.tags ?? []) if (!spelling.has(t.toLowerCase())) spelling.set(t.toLowerCase(), t);
    return (n) => {
      const t = n.tags?.[0];
      return t ? (spelling.get(t.toLowerCase()) ?? t) : "";
    };
  }
  return (n) => attrValue(n, by);
}

/** How a value reads in the legend: plan statuses by name, the empty value as Not set (Not tagged for tags). */
const valueLabel = (by: ColorBy, v: string) => (by === "plan" ? (PLAN_LABEL[v as PlanStatus] ?? v) : v || (by === "tag" ? "Not tagged" : "Not set"));

/** Each element's value under a coloring, as the legend names it (for screen reader labels). */
export function valueLabels(model: Model, by: ColorBy): (n: Node) => string {
  const get = valueFn(model, by);
  return (n) => valueLabel(by, get(n));
}

/** The values a coloring uses, in legend order with their slot: set values first, Not set last. */
function slots(model: Model, by: Exclude<ColorBy, "layer">): { value: string; slot: Slot }[] {
  const valueOf = valueFn(model, by);
  // Plan statuses keep one color each, whichever are present.
  if (by === "plan") {
    const present = new Set(model.nodes.map(valueOf));
    return PLAN_STATUSES.filter((p) => present.has(p)).map((p) => ({ value: p, slot: PLAN_STATUSES.indexOf(p) }));
  }
  const counts = new Map<string, number>();
  for (const n of model.nodes) {
    const v = valueOf(n);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const set = [...counts.keys()].sort((a, b) =>
    by === "lifecycle" ? stageRank(a) - stageRank(b) || a.localeCompare(b) : counts.get(b)! - counts.get(a)! || a.localeCompare(b),
  );
  const out: { value: string; slot: Slot }[] = set.map((value, i) => ({ value, slot: i < PALETTE.dark.length ? i : "other" }));
  if (model.nodes.some((n) => !valueOf(n))) out.push({ value: "", slot: "none" });
  return out;
}

/** The legend for a coloring: each value with its slot and how many elements in the view carry it. */
export function legend(model: Model, by: ColorBy, filter: ViewFilter): LegendEntry[] {
  if (by === "layer") return [];
  const valueOf = valueFn(model, by);
  const counts = new Map<string, number>();
  for (const n of model.nodes) if (inView(n, filter, model)) counts.set(valueOf(n), (counts.get(valueOf(n)) ?? 0) + 1);
  const all = slots(model, by);
  const count = (value: string) => counts.get(value) ?? 0;
  // Values past the palette share one color and marker, so they share one row too.
  const others = all.filter((s) => s.slot === "other");
  return [
    ...all.filter((s) => typeof s.slot === "number").map(({ value, slot }) => ({ key: value, value, label: valueLabel(by, value), slot, count: count(value) })),
    ...(others.length ? [{ key: "(other)", value: "", label: `Other (${others.length} values)`, slot: "other" as const, count: others.reduce((a, s) => a + count(s.value), 0) }] : []),
    ...all.filter((s) => s.slot === "none").map(() => ({ key: "", value: "", label: valueLabel(by, ""), slot: "none" as const, count: count("") })),
  ];
}

/** The slot of every element under a coloring, worked out once for the whole model (null when coloring by layer). */
export function slotMap(model: Model, by: ColorBy): ((n: Node) => Slot) | null {
  if (by === "layer") return null;
  const map = new Map(slots(model, by).map((s) => [s.value, s.slot]));
  const valueOf = valueFn(model, by);
  return (n) => map.get(valueOf(n)) ?? "none";
}

/** An element's slot under a coloring (null when coloring by layer). For many elements, use `slotMap`. */
export const slotOf = (model: Model, by: ColorBy, n: Node): Slot | null => slotMap(model, by)?.(n) ?? null;

/** A slot's color in a theme. */
export const slotColor = (slot: Slot, theme: "dark" | "light") => (typeof slot === "number" ? PALETTE[theme][slot]! : PALETTE[slot][theme]);
/** A slot's marker path. */
export const slotMarker = (slot: Slot) => (typeof slot === "number" ? MARKERS.slots[slot]! : MARKERS[slot]);

/** What "color by" reads as, for menus, the legend and image captions. */
export const COLOR_BY_LABEL: Record<ColorBy, string> = { layer: "Layer", lifecycle: "Life cycle stage", environment: "Environment", owner: "Owner", plan: "Plan status", tag: "Tag" };

/** Every coloring, in menu order (M77 adds plan status and tag). */
export const COLORINGS: readonly ColorBy[] = [...COLOR_BY, ...COLOR_BY_EXT];
const isExt = (c: ColorBy): c is (typeof COLOR_BY_EXT)[number] => (COLOR_BY_EXT as readonly string[]).includes(c);
/** A saved view's coloring: its `colorByExt` when set (M77), otherwise `colorBy`. */
export const viewColorBy = (v: Pick<View, "colorBy" | "colorByExt">): ColorBy => v.colorByExt ?? v.colorBy;
/** How a coloring is stored in a view: an M77 one as `colorByExt` beside "layer", which older versions show. */
export const storedColorBy = (c: ColorBy): Pick<View, "colorBy" | "colorByExt"> => (isExt(c) ? { colorBy: "layer", colorByExt: c } : { colorBy: c });
