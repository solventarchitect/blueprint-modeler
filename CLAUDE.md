# CLAUDE.md — Blueprint Modeler (model.mikereams.com)

> Read `SPEC.md` first — it is the requirements source of truth. This file is constraints & conventions only.
> Workspace rules in `../../CLAUDE.md` still apply; this file only narrows them.
> Decision record: project doc `claude/archify-csdm-app-assessment-2026-09-26.md` (why a new free app, not ArchTruth).

## Never break these (hard constraints)

1. **Deployment target:** static export (`output: 'export'`) deployed by Vercel Git integration, project
   `blueprint-modeler`, personal team "Mike Reams' projects"; push to `main` = production. Public host
   `https://model.mikereams.com` (CNAME in Netlify DNS → Vercel). Vercel Hobby is non-commercial use only, which
   matches rule 3.
2. **Data contract: there is no server.** No database, no accounts, no API routes, no server actions. A user's
   models live in their browser (IndexedDB) and in files they export. The app makes no network requests except for
   its own static assets.
3. **Personal, free, clean-room.** Remote `solventarchitect` only, commits with the personal identity (repo-local
   `user.email`). No payments, ads, sign-up, email capture or tracking cookies. **Nothing from Sherwin-Williams**:
   no code, CSS, reference models, rule IDs or rule text, metamodel files, screenshots, brand or data from
   `sherwin-williams-co/*` or any employer system. CSDM content comes only from ServiceNow's **public**
   documentation, and every metamodel class, relationship and conformance hint in `src/metamodel/` cites its public
   source URL. No ServiceNow connectivity of any kind (no instance, no Table API, no OAuth). A paid tier, or any
   ServiceNow connection, requires Mike's employment-agreement check first — stop and ask.
4. **Framework lock:** Next.js 15 App Router + TypeScript strict, static export. Canvas = `@xyflow/react` behind a
   `CanvasRenderer` interface; ELK layout in a Web Worker. No second canvas library, no CSS-in-JS.
5. **No new runtime dependency, paid service, or storage provider without Mike's explicit approval.** Approved set
   (2026-09-26): `@xyflow/react`, `elkjs`, `zod` (all MIT), added when first used. Analytics (Cloudflare Web Analytics, cookie-less,
   $0) only if approved.
6. **Not affiliated.** "ServiceNow" and "CSDM" are used nominatively; the footer and About page carry a
   not-affiliated notice. No ServiceNow logos.

## Stack & conventions (deltas from workspace default only)

| Concern | Convention |
|---|---|
| Web | Next.js 15 static export · TypeScript strict · Tailwind v4 + tokens copied from `../../tokens/mikereams/` (Blueprint) |
| Mobile | none (responsive web; canvas editing ≥ md, read-only view below) |
| Backend | none |
| Storage | IndexedDB via a small in-repo wrapper; import/export = JSON model file (versioned schema), SVG |
| Model | `src/model/` typed JSON: nodes `{id, class, name, attrs}`, edges `{id, from, to, type}`; layout is a sidecar keyed by id |
| Metamodel | `src/metamodel/` — CSDM classes, allowed relationship types, conformance hints; each entry has `source` (public URL) |
| Tests | Vitest (model, metamodel, hints, import/export round-trip) · Playwright (hero flow, keyboard, axe) |
| License | MIT, © Mike Reams |
| Commits | Conventional Commits; verify + commit after each SPEC milestone |

## Regression gates

- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green locally and in CI
- Playwright smoke: open → add Business Application + Application Service → connect with an allowed relationship →
  hint list updates → export JSON → clear → import → model and layout restored
- Every canvas action reachable by keyboard; axe clean; contrast verified by script on token changes
- Responsive at all five breakpoints; built artifact verified on the Vercel preview URL
- `src/metamodel/` test: every class, relationship and hint has a `source` URL on a ServiceNow public domain
- No network requests at runtime other than same-origin static assets (Playwright asserts)

## Stop-and-ask tripwires

- Anything that adds a server, account, database, API route or third-party request
- Any new dependency, paid service, analytics or storage provider
- Any metamodel content without a public source, or anything resembling employer material
- A change to the model file schema that breaks files users already exported (bump the version, write a migration)
- Anything that would make it commercial (pricing, payments, gated features)

## Identifiers (fill in — no secrets here)

| Item | Value |
|---|---|
| Ownership | **personal** — GitHub `solventarchitect`, personal Vercel team |
| Repo | `github.com/solventarchitect/blueprint-modeler` (public, MIT) — not created yet |
| Vercel project / root dir | `blueprint-modeler` / repo root — not created yet |
| Supabase | none |
| Production URL | `https://model.mikereams.com` — DNS not configured yet |
