import type { CSSProperties } from "react";
import { archimateElements, archimateRelationshipFor } from "@/frameworks";
import { classById, type ClassId } from "@/metamodel";

/** Lane colors, the same roles as the canvas (see editor/LayerOverlay). */
const lanes = [
  { name: "Business", color: "var(--status)" },
  { name: "Design", color: "var(--accent)" },
  { name: "Service", color: "var(--ai)" },
  { name: "Functional", color: "var(--ink-muted)" },
  { name: "Infrastructure", color: "var(--border-strong)" },
] as const;

/** One element per lane, joined by the relationship the metamodel allows between each pair. */
const chain: { cls: ClassId; name: string; rel?: string }[] = [
  { cls: "business_capability", name: "Order Management", rel: "Provided by" },
  { cls: "business_application", name: "Checkout", rel: "Uses" },
  { cls: "application_service", name: "Checkout — production", rel: "Depends on" },
  { cls: "application", name: "checkout-web", rel: "Runs on" },
  { cls: "host", name: "web-prod-01" },
];

/** The three figures' titles and footers. The figure's accessible name and description live in HeroFigures. */
const titles = ["FIG.01 — THE REALIZATION CHAIN", "FIG.02 — CAUGHT EARLY", "FIG.03 — READ IT IN ARCHIMATE"];
const footers: { text: string; color: string }[] = [
  { text: "Allowed relationships only. Every rule cites its source.", color: "var(--accent)" },
  { text: "A Business Application is not related directly to a Host in CSDM.", color: "var(--invalid)" },
  { text: "Same model, read in ArchiMate 3.2: a view-only lens.", color: "var(--ai)" },
];

const TOP = 52;
const LANE = 72;
const NODE_X = 188;
const NODE_W = 208;
const NODE_H = 40;
const nodeY = (i: number) => TOP + i * LANE + (LANE - NODE_H) / 2;
const MID = NODE_X + NODE_W / 2;
const HEIGHT = TOP + lanes.length * LANE + 44;

/** ArchiMate fill token per element (the M26 layer colors). */
const amFill = (cls: ClassId) => (archimateElements[cls].layer === "Strategy" ? "strategy" : archimateElements[cls].layer === "Application" ? "application" : "technology");

/** ArchiMate decoration on one relationship of the chain, drawn where ArchiMate puts it. */
function ArchimateEnd({ from, to, i }: { from: ClassId; to: ClassId; i: number }) {
  const m = archimateRelationshipFor(from, to);
  const top = nodeY(i) + NODE_H; // bottom edge of the upper element
  const bottom = nodeY(i + 1); // top edge of the lower element
  // Reversed mappings run from the lower element up to the upper one, so the decoration sits at the top.
  const tipY = m?.reverse ? top : bottom;
  const dir = m?.reverse ? 1 : -1; // marker body extends down from a top tip, up from a bottom tip
  const shape = (() => {
    switch (m?.type) {
      case "Realization":
        return <path d={`M${MID - 5} ${tipY + dir * 9} L${MID} ${tipY} L${MID + 5} ${tipY + dir * 9} Z`} className="hero-ground stroke-border-strong" strokeWidth="1.25" strokeLinejoin="round" />;
      case "Serving":
        return <path d={`M${MID - 5} ${tipY + dir * 8} L${MID} ${tipY} L${MID + 5} ${tipY + dir * 8}`} fill="none" className="stroke-border-strong" strokeWidth="1.5" strokeLinejoin="round" />;
      case "Aggregation": {
        // The diamond sits at the whole: the node (bottom element) aggregates the system software.
        const y = m.reverse ? bottom : top;
        const d = m.reverse ? -1 : 1;
        return <path d={`M${MID} ${y} L${MID + 5} ${y + d * 7} L${MID} ${y + d * 14} L${MID - 5} ${y + d * 7} Z`} className="hero-ground stroke-border-strong" strokeWidth="1.25" strokeLinejoin="round" />;
      }
      default:
        return null;
    }
  })();
  return (
    <g data-show="2" style={{ "--i": i + 0.5 } as CSSProperties}>
      <line x1={MID} x2={MID} y1={top} y2={bottom} className="stroke-border-strong" strokeWidth="1.5" strokeDasharray={m?.type === "Realization" ? "5 4" : undefined} />
      {shape}
      <text x={MID + 10} y={top + 12} fontSize="9.5" letterSpacing="0.6" className="fill-ink-soft">
        {m?.type ?? "Association"}
      </text>
    </g>
  );
}

/**
 * The landing page's hero: one drawing sheet that steps through three figures without cutting.
 * FIG.01 is the realization chain from a Business Capability down to a Host; FIG.02 catches a
 * shortcut from the Business Application straight to the Host, the line the editor refuses; FIG.03
 * reads the same elements in ArchiMate 3.2. Every element stays where it is and changes in place,
 * cascading down the chain behind the accent signal; the parent's `data-fig` picks the figure
 * (see `.hero-sheet` in globals.css). Decorative to assistive tech: HeroFigures names and describes
 * the current figure in text.
 */
export function HeroDiagram() {
  const yA = nodeY(1) + NODE_H / 2;
  const yH = nodeY(4) + NODE_H / 2;
  const shortcut = `M${NODE_X + NODE_W + 1} ${yA} C${NODE_X + NODE_W + 40} ${yA} ${NODE_X + NODE_W + 40} ${yH} ${NODE_X + NODE_W + 16} ${yH}`;
  return (
    <svg viewBox={`0 0 440 ${HEIGHT}`} aria-hidden="true" focusable="false" className="h-auto w-full font-mono">
      <defs>
        <mask id="hero-shortcut-mask" maskUnits="userSpaceOnUse">
          <path d={shortcut} pathLength={100} className="hero-reveal" fill="none" stroke="white" strokeWidth="8" />
        </mask>
      </defs>

      {/* Sheet and title strip; the three dots mark the figure. */}
      <rect x="0.5" y="0.5" width="439" height={HEIGHT - 1} className="fill-surface-raised stroke-border" />
      <line x1="0" x2="440" y1="36.5" y2="36.5" className="stroke-border" />
      {titles.map((t, f) => (
        <text key={t} data-show={String(f)} x="16" y="23" className="fill-ink-soft" fontSize="10" letterSpacing="1.6">
          {t}
        </text>
      ))}
      {titles.map((t, f) => (
        <circle key={t} cx={400 + f * 12} cy="19" r="3.5" className="hero-dot" data-dot={f} />
      ))}

      {/* Lanes. */}
      {lanes.map((l, i) => (
        <g key={l.name}>
          {i > 0 && <line x1="16" x2="424" y1={TOP + i * LANE + 0.5} y2={TOP + i * LANE + 0.5} className="stroke-border" strokeDasharray="2 4" />}
          <text x="16" y={TOP + i * LANE + 20} fontSize="9" letterSpacing="1.4" style={{ fill: l.color === "var(--border-strong)" || l.color === "var(--ink-muted)" ? "var(--ink-soft)" : l.color }}>
            {l.name.toUpperCase()}
          </text>
        </g>
      ))}

      {/* Relationships: CSDM (FIG.01–02), then their ArchiMate reading (FIG.03), in the same place. */}
      {chain.slice(0, -1).map((c, i) => {
        const y1 = nodeY(i) + NODE_H;
        const y2 = nodeY(i + 1) - 5;
        return (
          <g key={c.cls}>
            <g className="hero-node" style={{ "--i": i + 0.5 } as CSSProperties}>
              <g data-show="0 1" style={{ "--i": i + 0.5 } as CSSProperties}>
                <line x1={MID} x2={MID} y1={y1} y2={y2} className="hero-edge stroke-border-strong" strokeWidth="1.5" style={{ "--i": i } as CSSProperties} />
                <path d={`M${MID - 4} ${y2 - 1} L${MID} ${y2 + 5} L${MID + 4} ${y2 - 1} Z`} className="fill-border-strong" />
                <text x={MID + 10} y={y1 + 12} fontSize="9.5" letterSpacing="0.6" className="fill-ink-soft">
                  {c.rel}
                </text>
              </g>
              <ArchimateEnd from={c.cls} to={chain[i + 1]!.cls} i={i} />
            </g>
          </g>
        );
      })}
      <line x1={MID} x2={MID} y1={nodeY(0) + NODE_H} y2={nodeY(chain.length - 1)} className="hero-signal stroke-accent" strokeWidth="2.5" strokeLinecap="round" />

      {/* FIG.02: the shortcut the editor refuses, drawn in, marked ✕, then the route it should take. */}
      <g data-show="1" style={{ "--d": "0.2s" } as CSSProperties}>
        <path d={shortcut} mask="url(#hero-shortcut-mask)" fill="none" strokeWidth="1.75" strokeDasharray="5 4" style={{ stroke: "var(--invalid)" }} />
      </g>
      <g data-show="1" style={{ "--d": "1.2s" } as CSSProperties}>
        <circle cx={NODE_X + NODE_W + 16} cy={yH} r="7" style={{ fill: "var(--invalid)" }} />
        <path d={`M${NODE_X + NODE_W + 13} ${yH - 3} l6 6 M${NODE_X + NODE_W + 19} ${yH - 3} l-6 6`} className="stroke-surface-raised" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <g data-show="1" style={{ "--d": "2.2s" } as CSSProperties}>
        <rect x={NODE_X - 3} y={nodeY(2) - 3} width={NODE_W + 7} height={NODE_H + 6} fill="none" strokeWidth="1.5" strokeDasharray="4 3" style={{ stroke: "var(--valid)" }} />
        <text x={NODE_X - 10} y={nodeY(2) + NODE_H / 2 + 3} textAnchor="end" fontSize="9" style={{ fill: "var(--valid)" }}>
          ✓ route through here
        </text>
      </g>

      {/* Elements: class above, name below, left bar in the lane's color (as on the canvas). FIG.03 swaps
          the CSDM class for the ArchiMate type and fills the box with its ArchiMate layer color. */}
      {chain.map((c, i) => {
        const y = nodeY(i);
        return (
          <g key={c.cls} className="hero-node" style={{ "--i": i } as CSSProperties}>
            <rect x={NODE_X + 0.5} y={y + 0.5} width={NODE_W} height={NODE_H} className="hero-box stroke-border" data-am={amFill(c.cls)} style={{ "--i": i } as CSSProperties} />
            <rect x={NODE_X} y={y} width="3" height={NODE_H + 1} style={{ fill: lanes[i]!.color }} />
            <text data-show="0 1" x={NODE_X + 14} y={y + 15} fontSize="8" letterSpacing="1.2" className="fill-ink-muted" style={{ "--i": i } as CSSProperties}>
              {classById(c.cls)!.label.toUpperCase()}
            </text>
            <text data-show="2" x={NODE_X + 14} y={y + 15} fontSize="8" letterSpacing="1.2" className="hero-am-ink" style={{ "--i": i } as CSSProperties}>
              {archimateElements[c.cls].label.toUpperCase()}
            </text>
            <text x={NODE_X + 14} y={y + 30} fontSize="12" className="fill-ink font-sans" fontWeight="500">
              {c.name}
            </text>
          </g>
        );
      })}

      {/* Footer strip, one line per figure. */}
      <line x1="0" x2="440" y1={HEIGHT - 32.5} y2={HEIGHT - 32.5} className="stroke-border" />
      {footers.map((f, n) => (
        <text key={f.text} data-show={String(n)} x="16" y={HEIGHT - 12} fontSize="10" style={{ fill: f.color, "--i": 4.5 } as CSSProperties}>
          {f.text}
        </text>
      ))}
    </svg>
  );
}
