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

const TOP = 52;
const LANE = 72;
const NODE_X = 188;
const NODE_W = 208;
const NODE_H = 40;
const nodeY = (i: number) => TOP + i * LANE + (LANE - NODE_H) / 2;
const MID = NODE_X + NODE_W / 2;

/**
 * The landing page's hero: the realization chain from a Business Capability down to a Host, drawn
 * like a figure on a drawing sheet. Inline SVG in the site's color roles, so it follows the theme
 * and stays sharp at any size. The picture is described by its title and description.
 */
export function HeroDiagram() {
  const height = TOP + lanes.length * LANE + 44;
  return (
    <svg viewBox={`0 0 440 ${height}`} role="img" aria-labelledby="hero-title hero-desc" className="h-auto w-full font-mono">
      <title id="hero-title">Figure 1: the realization chain</title>
      <desc id="hero-desc">
        {`A Business Capability, Order Management, is provided by the Business Application Checkout, which uses the Application Service Checkout — production. That service depends on the Application checkout-web, which runs on the Host web-prod-01.`}
      </desc>

      {/* Sheet and title strip. */}
      <rect x="0.5" y="0.5" width="439" height={height - 1} className="fill-surface-raised stroke-border" />
      <line x1="0" x2="440" y1="36.5" y2="36.5" className="stroke-border" />
      <text x="16" y="23" className="fill-ink-soft" fontSize="10" letterSpacing="1.6">
        FIG.01 — THE REALIZATION CHAIN
      </text>
      {["var(--status)", "var(--border)", "var(--border)"].map((c, i) => (
        <circle key={i} cx={400 + i * 12} cy="19" r="3.5" style={{ fill: c }} />
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

      {/* Relationships (labels just under the upper element, clear of the lane line), then a signal that runs down the whole chain. */}
      {chain.slice(0, -1).map((c, i) => {
        const y1 = nodeY(i) + NODE_H;
        const y2 = nodeY(i + 1) - 5;
        return (
          <g key={c.cls} className="hero-node" style={{ ["--i" as string]: i + 0.5 }}>
            <line x1={MID} x2={MID} y1={y1} y2={y2} className="hero-edge stroke-border-strong" strokeWidth="1.5" style={{ ["--i" as string]: i }} />
            <path d={`M${MID - 4} ${y2 - 1} L${MID} ${y2 + 5} L${MID + 4} ${y2 - 1} Z`} className="fill-border-strong" />
            <text x={MID + 10} y={y1 + 12} fontSize="9.5" letterSpacing="0.6" className="fill-ink-soft">
              {c.rel}
            </text>
          </g>
        );
      })}
      <line x1={MID} x2={MID} y1={nodeY(0) + NODE_H} y2={nodeY(chain.length - 1)} className="hero-signal stroke-accent" strokeWidth="2.5" strokeLinecap="round" />

      {/* Elements: class above, name below, left bar in the lane's color (as on the canvas). */}
      {chain.map((c, i) => {
        const y = nodeY(i);
        return (
          <g key={c.cls} className="hero-node" style={{ ["--i" as string]: i }}>
            <rect x={NODE_X + 0.5} y={y + 0.5} width={NODE_W} height={NODE_H} className="fill-surface stroke-border" />
            <rect x={NODE_X} y={y} width="3" height={NODE_H + 1} style={{ fill: lanes[i]!.color }} />
            <text x={NODE_X + 14} y={y + 15} fontSize="8" letterSpacing="1.2" className="fill-ink-muted">
              {classById(c.cls)!.label.toUpperCase()}
            </text>
            <text x={NODE_X + 14} y={y + 30} fontSize="12" className="fill-ink font-sans" fontWeight="500">
              {c.name}
            </text>
          </g>
        );
      })}

      {/* Footer strip. */}
      <line x1="0" x2="440" y1={height - 32.5} y2={height - 32.5} className="stroke-border" />
      <text x="16" y={height - 12} fontSize="10" className="fill-accent">
        Allowed relationships only. Every rule cites its source.
      </text>
    </svg>
  );
}
