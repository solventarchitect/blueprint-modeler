import type { Metadata } from "next";
import { classById, classes, hints, isCsdmCore, isExtended, relationships, sources, type Layer, type SourceRef } from "@/metamodel";
import { layerAccent } from "@/editor/layerAccent";
import { ARCHIMATE_TRADEMARK, archimateElements, archimateRelationshipFor, archimateSources, type ElementMapping } from "@/frameworks";
import { ArchimateGlyph } from "@/frameworks/ArchimateGlyph";

export const metadata: Metadata = {
  title: "Class guide",
  description: "The CSDM classes, relationships and conformance hints Blueprint Modeler uses, each with its public source.",
  alternates: { canonical: "/guide" },
};

const layerOrder: { id: Layer; name: string }[] = [
  { id: "business", name: "Business" },
  { id: "design", name: "Design" },
  { id: "service", name: "Service" },
  { id: "functional", name: "Functional" },
  { id: "infrastructure", name: "Infrastructure" },
];

function Source({ src }: { src: SourceRef }) {
  const s = sources[src.id];
  return (
    <a className="text-accent underline underline-offset-4" href={s.url} target="_blank" rel="noopener noreferrer">
      {s.title}
      {src.page ? `, p. ${src.page}` : ""}
    </a>
  );
}

const label = (id: string) => classById(id)?.label ?? id;

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="font-mono text-sm tracking-[0.14em] text-accent uppercase">{"// Reference"}</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Class guide</h1>
      <p className="mt-4 max-w-2xl text-ink-soft">
        Every class, relationship and hint the modeler knows, written in our own words from ServiceNow&apos;s public
        material: the CSDM white paper, and the product documentation for the Kubernetes classes. Each entry links to its source so you can check it.
      </p>
      <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <a className="text-accent underline underline-offset-4" href="#classes">Classes</a>
        <a className="text-accent underline underline-offset-4" href="#relationships">Relationships</a>
        <a className="text-accent underline underline-offset-4" href="#hints">Hints</a>
        <a className="text-accent underline underline-offset-4" href="#archimate">ArchiMate mapping</a>
      </nav>

      <section aria-labelledby="classes" className="mt-12">
        <h2 id="classes" className="text-2xl font-semibold tracking-tight">Classes</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Grouped by the lane they sit in on the canvas, top to bottom. Lanes are a drawing aid, not CSDM domains: the white
          paper organizes CSDM 5 into seven domains (p. 14). Classes marked CMDB come from ServiceNow&apos;s product
          documentation rather than the white paper. Classes marked Extended (strategy, value streams, SDLC, product models and AI) appear in the
          palette when you turn on View › Extended classes.
        </p>
        {layerOrder.map((layer) => {
          const inLayer = classes.filter((c) => c.layer === layer.id);
          if (inLayer.length === 0) return null;
          return (
            <div key={layer.id} className="mt-8">
              <h3 className="font-mono text-xs tracking-[0.14em] text-ink-muted uppercase">{layer.name}</h3>
              <ul className="mt-3 grid gap-3 md:grid-cols-2">
                {inLayer.map((c) => (
                  <li key={c.id} className={`min-w-0 border border-border border-l-4 bg-surface-raised p-4 ${layerAccent[c.layer]}`}>
                    <p className="flex items-center gap-2 font-medium">
                      {c.label}
                      {!isCsdmCore(c) && <span className="border border-border-strong px-1 font-mono text-[0.6rem] tracking-[0.08em] text-ink-muted">CMDB</span>}
                      {isExtended(c) && <span className="border border-border-strong px-1 font-mono text-[0.6rem] tracking-[0.08em] text-ink-muted">Extended</span>}
                    </p>
                    {"table" in c && c.table && <p className="mt-0.5 font-mono text-xs break-all text-ink-muted">{c.table}</p>}
                    <p className="mt-2 text-sm text-ink-soft">{c.description}</p>
                    <p className="mt-2 text-xs text-ink-muted">
                      Source: <Source src={c.source} />
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="relationships" className="mt-16">
        <h2 id="relationships" className="text-2xl font-semibold tracking-tight">Relationships</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          <strong className="font-medium text-ink-soft">Reported</strong> type labels appear in ServiceNow material we
          cite. <strong className="font-medium text-ink-soft">Conventional</strong> labels are standard CMDB types
          commonly used for the pairing; the pairing is sourced, the label is a suggestion.
        </p>
        <div className="mt-6 overflow-x-auto border border-border" tabIndex={0} role="region" aria-label="Relationships table">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="bg-surface-raised font-mono text-xs tracking-[0.1em] text-ink-muted uppercase">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-medium">From</th>
                <th scope="col" className="px-3 py-2.5 font-medium">To</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Type</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Evidence</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map((r) => (
                <tr key={`${r.from}-${r.to}`} className="border-t border-border align-top">
                  <td className="px-3 py-2.5">{label(r.from)}</td>
                  <td className="px-3 py-2.5">{label(r.to)}</td>
                  <td className="px-3 py-2.5">
                    <span className="font-mono text-xs">{r.types.join(", ")}</span>
                    {"legacyTypes" in r && r.legacyTypes && (
                      <span className="mt-1 block text-xs text-ink-muted">Legacy: {r.legacyTypes.join(", ")}</span>
                    )}
                    {"legacyReverse" in r && r.legacyReverse && (
                      <span className="mt-1 block text-xs text-ink-muted">Older files, other direction: {r.legacyReverse.join(", ")}</span>
                    )}
                    {"note" in r && r.note && <span className="mt-1 block text-xs text-ink-muted">{r.note}</span>}
                  </td>
                  <td className="px-3 py-2.5 capitalize">{r.typeEvidence}</td>
                  <td className="px-3 py-2.5 text-xs">
                    <Source src={r.source} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="hints" className="mt-16">
        <h2 id="hints" className="text-2xl font-semibold tracking-tight">Hints</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">Hints advise; they never block you from drawing.</p>
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {hints.map((h) => (
            <li key={h.id} className="border border-border bg-surface-raised p-4">
              <p className="flex items-center gap-2 font-medium">
                <span
                  className={`inline-flex h-5 items-center px-1.5 font-mono text-[0.65rem] tracking-[0.1em] uppercase ${
                    h.severity === "warning" ? "bg-status text-surface" : "border border-border-strong text-ink-soft"
                  }`}
                >
                  {h.severity}
                </span>
                {h.title}
              </p>
              <p className="mt-2 text-sm text-ink-soft">{h.explanation}</p>
              <p className="mt-2 text-xs text-ink-muted">
                Source: <Source src={h.source} />
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="archimate" className="mt-16" data-testid="archimate-section">
        <h2 id="archimate" className="text-2xl font-semibold tracking-tight">ArchiMate® 3.2 mapping</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Switch the editor&apos;s lens to <strong className="font-medium text-ink-soft">CSDM + ArchiMate 3.2</strong> to see
          these names on the canvas. The mapping is our interpretation; each element links to the chapter of the{" "}
          <a className="text-accent underline underline-offset-4" href={archimateSources.spec.url} target="_blank" rel="noopener noreferrer">
            public specification
          </a>{" "}
          that defines it, and every relationship is an allowed ArchiMate relationship. {ARCHIMATE_TRADEMARK}
        </p>
        <div className="mt-6 max-w-2xl text-sm text-ink-muted" data-testid="togaf-note">
          <h3 className="text-base font-semibold text-ink">Working with the TOGAF® standard</h3>
          <p className="mt-2">
            ArchiMate and the TOGAF standard are both published by The Open Group, and teams that follow the TOGAF standard
            often draw their models in ArchiMate. Blueprint Modeler can feed that work from the CSDM side:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              Switch the lens to <strong className="font-medium text-ink-soft">ArchiMate 3.2 only</strong> to review a model in
              ArchiMate notation and layer colors.
            </li>
            <li>
              Use <strong className="font-medium text-ink-soft">Export › ArchiMate model (XML)</strong> to hand the model to an
              ArchiMate tool or architecture repository; each element keeps its CSDM class as a property.
            </li>
            <li>Use the SVG or draw.io exports for documents and slides.</li>
          </ul>
          <p className="mt-2">
            Blueprint Modeler does not implement the TOGAF standard: it has no method phases, governance, catalogs or matrices,
            and it makes no claim of TOGAF conformance or certification. TOGAF is a registered trademark of The Open Group.
          </p>
        </div>
        <div className="mt-6 overflow-x-auto border border-border" tabIndex={0} role="region" aria-label="ArchiMate element mapping">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-raised font-mono text-xs tracking-[0.1em] text-ink-muted uppercase">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-medium">CSDM class</th>
                <th scope="col" className="px-3 py-2.5 font-medium">ArchiMate element</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Layer</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => {
                const m: ElementMapping = archimateElements[c.id];
                return (
                  <tr key={c.id} className="border-t border-border align-top">
                    <td className="px-3 py-2.5">{c.label}</td>
                    <td className="px-3 py-2.5">
                      <a
                        className="inline-flex items-center gap-1.5 text-accent underline underline-offset-4"
                        href={archimateSources[m.source].url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ArchimateGlyph type={m.type} />
                        {m.label}
                      </a>
                    </td>
                    <td className="px-3 py-2.5">{m.layer}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-soft">{m.note ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 overflow-x-auto border border-border" tabIndex={0} role="region" aria-label="ArchiMate relationship mapping">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-surface-raised font-mono text-xs tracking-[0.1em] text-ink-muted uppercase">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-medium">CSDM relationship</th>
                <th scope="col" className="px-3 py-2.5 font-medium">ArchiMate relationship</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Reads as</th>
              </tr>
            </thead>
            <tbody>
              {relationships.map((r) => {
                const m = archimateRelationshipFor(r.from, r.to);
                return (
                  <tr key={`${r.from}-${r.to}`} className="border-t border-border align-top">
                    <td className="px-3 py-2.5">
                      {label(r.from)} → {label(r.to)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">{m ? `${m.type}${m.reverse ? " (reversed)" : ""}` : "—"}</td>
                    <td className="px-3 py-2.5 text-xs text-ink-soft">{m?.reads ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
