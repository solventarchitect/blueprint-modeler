import { site } from "@/lib/site";

const layers = [
  { code: "01", name: "Business Capability", note: "what the business does" },
  { code: "02", name: "Business Application", note: "the software that serves it" },
  { code: "03", name: "Application Service", note: "a deployed, running instance" },
  { code: "04", name: "Technology", note: "servers, databases, platforms underneath" },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="font-mono text-sm tracking-[0.14em] text-accent uppercase">{"// Free · in your browser · early preview"}</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
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

      <ol className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {layers.map((l) => (
          <li key={l.code} className="bg-surface-raised p-5">
            <span className="font-mono text-xs text-ink-muted">{l.code}</span>
            <p className="mt-2 font-medium">{l.name}</p>
            <p className="mt-1 text-sm text-ink-muted">{l.note}</p>
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
