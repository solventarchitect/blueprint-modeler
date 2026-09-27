export * from "./archimate";

/** Which framework's names to show alongside CSDM. A viewing preference, never part of the model. */
export type Lens = "csdm" | "archimate";
export const LENS_KEY = "bm-lens";
export const lenses: { id: Lens; label: string }[] = [
  { id: "csdm", label: "CSDM" },
  { id: "archimate", label: "CSDM + ArchiMate 3.2" },
];

export function readLens(): Lens {
  try {
    return localStorage.getItem(LENS_KEY) === "archimate" ? "archimate" : "csdm";
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
