import type { CSSProperties } from "react";
import { HeroDiagram } from "@/components/HeroDiagram";
import { HeroFigures } from "@/components/HeroFigures";
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
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/editor"
              className="inline-flex min-h-11 items-center gap-2 bg-accent px-5 font-medium text-accent-ink hover:opacity-90"
            >
              Open the modeler <span aria-hidden="true">→</span>
            </a>
            <a
              href="/guide"
              className="inline-flex min-h-11 items-center gap-2 border border-border px-5 font-medium hover:border-accent hover:text-accent"
            >
              Read the class guide
            </a>
          </div>
        </div>
        <figure className="mx-auto w-full max-w-md lg:max-w-none">
          <HeroFigures>
            <HeroDiagram />
          </HeroFigures>
        </figure>
      </div>

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
