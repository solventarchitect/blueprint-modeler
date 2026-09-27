import type { Model } from "@/model";

/**
 * Lucidchart plan limits that decide whether an exported diagram is usable on a Free account.
 * Plan terms change: every figure carries its public source and the date we checked it.
 * Checked 2026-09-27.
 */
export const LUCID_FREE = {
  /** Objects per document on Lucidchart Free. Shapes, lines and text boxes all count. */
  objectLimit: 60,
  /** Editable documents on Lucidchart Free. */
  editableDocuments: 3,
  checked: "2026-09-27",
  sources: {
    objectLimit: "https://community.lucid.co/product-questions-3/lucidchart-free-plan-60-shape-restriction-122",
    importEditing: "https://help.lucid.co/hc/en-us/articles/16389149809428-Import-files-into-Lucidchart",
  },
} as const;

export type LucidFit = {
  /** Objects Lucid will count after import: one per element, one per relationship (its label rides on the line). */
  objects: number;
  limit: number;
  fitsFree: boolean;
};

export function lucidFit(model: Pick<Model, "nodes" | "edges">): LucidFit {
  const objects = model.nodes.length + model.edges.length;
  return { objects, limit: LUCID_FREE.objectLimit, fitsFree: objects <= LUCID_FREE.objectLimit };
}

/** One line for the Export menu. */
export function lucidFitNote(fit: LucidFit): string {
  return fit.fitsFree
    ? `${fit.objects} Lucid objects · within Free's ${fit.limit}`
    : `${fit.objects} Lucid objects · over Free's ${fit.limit}, needs a paid plan`;
}

/** The status message after a draw.io export. */
export function lucidFitMessage(fit: LucidFit): string {
  const size = fit.fitsFree
    ? `${fit.objects} Lucid objects, within the Free plan's ${fit.limit} per document.`
    : `${fit.objects} Lucid objects, over the Free plan's ${fit.limit} per document: use a paid Lucid plan or split the model.`;
  return `${size} Lucid Free can import and view it; editing an imported diagram needs a paid Lucid plan.`;
}
