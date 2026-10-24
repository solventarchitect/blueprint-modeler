/**
 * Views (M54): which elements a filter keeps, and how elements are colored. Pure, shared by the
 * canvas, the legend and image export, so all three agree. A value's color is fixed by the whole
 * model (not the filtered part), so filtering never recolors anything.
 */
import { classById, LIFE_CYCLE } from "@/metamodel";
import type { ColorBy, Model, Node, ViewFilter } from "./schema";

export const ALL_ELEMENTS: { filter: ViewFilter; colorBy: ColorBy } = { filter: {}, colorBy: "layer" };

/** An element's value for a view property, trimmed; "" when not set. */
export const attrValue = (n: Node, key: "lifecycle" | "environment" | "owner") => (n.attrs?.[key] ?? "").trim();

const dims = (f: ViewFilter) => [
  [f.layers, (n: Node) => classById(n.class)?.layer ?? ""],
  [f.classes, (n: Node) => n.class],
  [f.lifecycle, (n: Node) => attrValue(n, "lifecycle")],
  [f.environment, (n: Node) => attrValue(n, "environment")],
  [f.owner, (n: Node) => attrValue(n, "owner")],
] as const;

/** Whether the filter narrows anything. */
export const filterActive = (f: ViewFilter) => dims(f).some(([vals]) => !!vals?.length);

/** Whether an element is in the view: every dimension that lists values must contain the element's. */
export const inView = (n: Node, f: ViewFilter) => dims(f).every(([vals, get]) => !vals?.length || vals.includes(get(n)));

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
export type LegendEntry = { value: string; label: string; count: number; slot: Slot };

/** Every life cycle stage once, in the order the white paper's processes give them. */
const STAGE_ORDER = [...new Set(Object.values(LIFE_CYCLE).flatMap((p) => p.stages))];
const stageRank = (v: string) => (STAGE_ORDER.includes(v) ? STAGE_ORDER.indexOf(v) : STAGE_ORDER.length);

function valueOf(n: Node, by: ColorBy) {
  return by === "layer" ? (classById(n.class)?.layer ?? "") : attrValue(n, by);
}

/** The values a coloring uses, in legend order with their slot: set values first, Not set last. */
function slots(model: Model, by: Exclude<ColorBy, "layer">): { value: string; slot: Slot }[] {
  const counts = new Map<string, number>();
  for (const n of model.nodes) {
    const v = valueOf(n, by);
    if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const set = [...counts.keys()].sort((a, b) =>
    by === "lifecycle" ? stageRank(a) - stageRank(b) || a.localeCompare(b) : counts.get(b)! - counts.get(a)! || a.localeCompare(b),
  );
  const out: { value: string; slot: Slot }[] = set.map((value, i) => ({ value, slot: i < PALETTE.dark.length ? i : "other" }));
  if (model.nodes.some((n) => !valueOf(n, by))) out.push({ value: "", slot: "none" });
  return out;
}

/** The legend for a coloring: each value with its slot and how many elements in the view carry it. */
export function legend(model: Model, by: ColorBy, filter: ViewFilter): LegendEntry[] {
  if (by === "layer") return [];
  const shown = model.nodes.filter((n) => inView(n, filter));
  return slots(model, by).map(({ value, slot }) => ({
    value,
    label: value || "Not set",
    slot,
    count: shown.filter((n) => valueOf(n, by) === value).length,
  }));
}

/** An element's slot under a coloring (null when coloring by layer). */
export function slotOf(model: Model, by: ColorBy, n: Node): Slot | null {
  if (by === "layer") return null;
  const v = valueOf(n, by);
  return slots(model, by).find((s) => s.value === v)?.slot ?? "none";
}

/** A slot's color in a theme. */
export const slotColor = (slot: Slot, theme: "dark" | "light") => (typeof slot === "number" ? PALETTE[theme][slot]! : PALETTE[slot][theme]);
/** A slot's marker path. */
export const slotMarker = (slot: Slot) => (typeof slot === "number" ? MARKERS.slots[slot]! : MARKERS[slot]);

/** What "color by" reads as, for menus, the legend and image captions. */
export const COLOR_BY_LABEL: Record<ColorBy, string> = { layer: "Layer", lifecycle: "Life cycle stage", environment: "Environment", owner: "Owner" };
