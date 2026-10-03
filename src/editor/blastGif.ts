import type { Lens } from "@/frameworks";
import { gifPalette } from "@/io/gif/quantize";
import { modelToSvg, svgColors, type SvgTheme } from "@/io/svg";
import type { BlastRadius, Model } from "@/model";
import { blastAnnouncement, blastProgress, blastView } from "./blast";

/** GIF size caps: the longest side, and the area of one frame. */
export const GIF_MAX_SIDE = 1600;
const GIF_MAX_PIXELS = 1600 * 1200;
/** Time on each hop, and on the last frame before the loop starts again (hundredths of a second). */
const STEP_CS = 150;
const LAST_CS = 300;

export const gifScale = (w: number, h: number) => Math.min(1, GIF_MAX_SIDE / Math.max(w, h), Math.sqrt(GIF_MAX_PIXELS / (w * h)));

/**
 * The frames of a blast radius GIF, one per step (start, then each hop), drawn like the SVG export
 * with the step's highlights and a caption; the palette comes from the theme's colors; the summary
 * names every hop, for the file's comment and the status line.
 */
export function blastFrames(model: Model, r: BlastRadius, theme: SvgTheme, lens: Lens) {
  const nameOf = (id: string) => model.nodes.find((n) => n.id === id)?.name || "Untitled";
  const impact = r.direction === "impact";
  const head = impact ? `If ${nameOf(r.start)} fails` : `What ${nameOf(r.start)} needs`;
  const captions = r.steps.map((_, k) => `${head} · ${blastProgress(r, k)}`);
  // Every frame reserves room for the longest caption, so all frames are the same size.
  const reserve = Math.max(0, ...captions.map((c) => c.length));
  const svgs = r.steps.map((_, k) => {
    const v = blastView(model, r, k);
    return modelToSvg(model, theme, { lens, highlight: { impact, nodes: v.nodes, edges: v.edges, caption: { label: "Blast radius", text: captions[k]!, reserve } } });
  });
  const delaysCs = svgs.map((_, k) => (k === svgs.length - 1 ? LAST_CS : STEP_CS));
  const summary = [blastAnnouncement(r, 0, nameOf), ...r.steps.slice(1).map((s) => `Hop ${s.hop}: ${s.nodeIds.map(nameOf).join(", ")}.`)].join(" ");
  return { svgs, delaysCs, summary, palette: gifPalette(svgColors(theme, lens)) };
}
