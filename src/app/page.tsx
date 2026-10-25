import type { CSSProperties } from "react";
import { HeroDiagram } from "@/components/HeroDiagram";
import { heroFigures } from "@/components/heroFigures";
import { IsoStack } from "@/components/IsoStack";
import { ARCHIMATE_TRADEMARK } from "@/frameworks";
import { site } from "@/lib/site";
import { classById, type ClassId } from "@/metamodel";

/** Each card shows, on hover, the CMDB table of a class in that layer; the color is the layer's (as on the canvas). */
const layers: { code: string; name: string; note: string; cls: ClassId; color: string }[] = [
  { code: "01", name: "Business Capability", note: "what the business does", cls: "business_capability", color: "var(--status)" },
  { code: "02", name: "Business Application", note: "the software that serves it", cls: "business_application", color: "var(--accent)" },
  { code: "03", name: "Application Service", note: "a deployed, running instance", cls: "application_service", color: "var(--ai)" },
  { code: "04", name: "Technology", note: "servers, databases, platforms underneath", cls: "application", color: "var(--ink-soft)" },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <div>
          <p className="font-mono text-sm tracking-[0.14em] text-accent uppercase">{"// Free · in your browser · early preview"}</p>
          <h1 className="mt-4 max-w-3xl text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Model application architecture the CSDM way.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-ink-soft">{site.description}</p>
          <div className="mt-8 flex flex-wrap items-end gap-3">
            <a href="/editor" className="cta-extrude">
              <span>
                Open the modeler <span aria-hidden="true">→</span>
              </span>
            </a>
            <a href="/guide" className="cta-trace inline-flex min-h-11 items-center gap-2 border border-border px-5 font-medium hover:text-accent">
              <svg aria-hidden="true" focusable="false">
                <rect x="0" y="0" width="100%" height="100%" fill="none" stroke="var(--accent)" strokeWidth="2" pathLength={100} strokeDasharray="14 86" />
              </svg>
              Read the class guide
            </a>
          </div>
        </div>
        <figure className="mx-auto w-full max-w-md lg:max-w-none">
          <IsoStack />
        </figure>
      </div>

      <section aria-labelledby="figures" className="mt-16">
        <h2 id="figures" className="font-mono text-sm tracking-[0.14em] text-accent uppercase">
          {"// The same chain, three ways"}
        </h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {heroFigures.map((f, i) => (
            <li key={f.label}>
              {/* The figure in words, as the card's description (its name stays short). */}
              <span id={`fig-desc-${i}`} hidden>
                {f.desc}
              </span>
              <a href={f.href} aria-describedby={`fig-desc-${i}`} className="fig-card flex h-full flex-col border border-border bg-surface-raised text-ink">
                <span className="block overflow-hidden border-b border-border p-3" aria-hidden="true">
                  <span className="fig-tilt hero-sheet block" data-fig={i}>
                    <HeroDiagram id={`fig-${i}`} />
                  </span>
                </span>
                <span className="flex flex-col gap-2 p-5">
                  <span className="font-mono text-xs tracking-[0.12em] text-ink-muted uppercase">Fig. {String(i + 1).padStart(2, "0")}</span>
                  <span className="text-lg font-medium">{f.label}</span>
                  <span className="text-sm text-ink-soft">{f.summary}</span>
                  {f.href === "/guide#archimate" && <span className="text-xs text-ink-muted">{ARCHIMATE_TRADEMARK}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <ol className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {layers.map((l) => (
          <li
            key={l.code}
            className="layer-card bg-surface-raised p-5"
            style={{ "--c": l.color, "--n": classById(l.cls)!.table!.length } as CSSProperties}
          >
            {(["tl", "tr", "bl", "br"] as const).map((at) => (
              <span key={at} aria-hidden="true" className="layer-card-corner" data-at={at} />
            ))}
            <span className="font-mono text-xs text-ink-muted">{l.code}</span>
            <p className="mt-2 font-medium">{l.name}</p>
            <p className="mt-1 text-sm text-ink-muted">{l.note}</p>
            <p className="mt-3 flex min-h-4 items-center font-mono text-xs text-ink-soft">
              <span className="sr-only">CMDB table: </span>
              <span className="layer-card-table">{classById(l.cls)!.table}</span>
              <span aria-hidden="true" className="layer-card-caret" />
            </p>
          </li>
        ))}
      </ol>

      <p className="mt-10 max-w-2xl text-ink-soft">
        Draw the realization chain from capability to infrastructure, connect it with relationship types the model
        allows, and get conformance hints as you go. Everything runs in your browser; export a file to keep or share
        it.
      </p>
    </div>
  );
}
