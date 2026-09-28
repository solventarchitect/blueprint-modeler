export * from "./archimate";

/** Which framework's names to show alongside CSDM. A viewing preference, never part of the model. */
export type Lens = "csdm" | "archimate" | "archimate-only";
export const LENS_KEY = "bm-lens";
export const lenses: { id: Lens; label: string }[] = [
  { id: "csdm", label: "CSDM" },
  { id: "archimate", label: "CSDM + ArchiMate 3.2" },
  { id: "archimate-only", label: "ArchiMate 3.2 only" },
];

/** Whether a lens shows ArchiMate names (alongside CSDM, or instead of it). */
export const showsArchimate = (lens: Lens) => lens !== "csdm";

export function readLens(): Lens {
  try {
    const v = localStorage.getItem(LENS_KEY);
    return v === "archimate" || v === "archimate-only" ? v : "csdm";
  } catch {
    return "csdm";
  }
}

export function saveLens(lens: Lens) {
  try {
    if (lens === "csdm") localStorage.removeItem(LENS_KEY);
    else localStorage.setItem(LENS_KEY, lens);
  } catch {
    // Storage blocked: the lens still applies until the page is closed.
  }
}
