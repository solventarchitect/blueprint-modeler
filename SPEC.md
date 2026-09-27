# SPEC.md — Blueprint Modeler (model.mikereams.com)

> Requirements source of truth. Constraints live in `CLAUDE.md`. Update the Status block at every milestone.

## 1. Problem & users

- **Problem:** People learning or applying ServiceNow's Common Service Data Model sketch application
  architectures in general-purpose tools (Visio, Lucid, draw.io, whiteboards) that know nothing about CSDM. They
  draw a business application wired straight to servers, skip the application service, or invent relationship
  types, and only find out when the CMDB import or a governance review pushes back. The free options that
  understand CSDM live inside a licensed ServiceNow instance.
- **Primary users:** enterprise and solution architects, CMDB/platform owners, consultants and students preparing
  for CSDM work. Desktop web for editing; any device for viewing. WCAG 2.2 AA; keyboard-first canvas.
- **Out of scope (v1):** accounts, cloud save, sharing links, collaboration, ServiceNow connectivity or import from
  an instance, AI generation, payments, mobile editing, PNG export (SVG only), any employer content.

## 2. Platforms & surfaces

| Surface | In v1? | Notes |
|---|---|---|
| Web (Next.js static export) | yes | model.mikereams.com |
| Mobile (Expo) | no | responsive web, read-only canvas below md |
| Public API | no | the model file format is the interface |

## 3. Core flows (user stories with acceptance criteria)

| ID | As a… | I want… | So that… | Acceptance (testable) |
|---|---|---|---|---|
| F-01 | Architect | to add CSDM elements from a palette grouped by domain (business, application, service, technology) | I model with the right building blocks | Given the palette, when I add a Business Application, then a node of class `business_application` appears, focused, named inline; keyboard-only path works |
| F-02 | Architect | to connect elements using only relationship types the metamodel allows between those classes | the model stays valid | When I connect two nodes, then I choose from the allowed types for that pair; a disallowed pair shows why and creates nothing |
| F-03 | Architect | conformance hints as I work | I see gaps before a reviewer does | Given a Business Application linked directly to a server, then a hint appears citing its public source and highlighting both nodes; fixing the model clears it |
| F-04 | Anyone | my work saved automatically in this browser | I don't lose it | When I reload, then every model, name and position is restored; a "stored only in this browser" notice is always visible |
| F-05 | Architect | to export and import a model file | I can back up, move and version it in Git | Export JSON → clear → import → deep-equal model + layout; files from older schema versions migrate; invalid files are rejected with a readable error and change nothing |
| F-06 | Architect | to export SVG in light or dark | I can put it in a doc or slide | SVG export matches the canvas, embeds fonts or uses system fonts, and loads nothing remote |
| F-07 | Architect | auto-layout by CSDM layer | a messy sketch becomes readable | One action lays out top-down by domain in a worker; the UI stays responsive; undo restores positions |
| F-08 | Learner | starter examples and a short guide to each class | I learn CSDM while modeling | Each palette class has a description and source link; three example models load from the start screen |

## 4. Data model

- `Model { schema: 1, id, name, created, updated, nodes: Node[], edges: Edge[], layout: Record<id,{x,y}> }`;
  `Node { id, class, name, attrs? }`; `Edge { id, from, to, type }`. Edge identity = `from|type|to`.
- Metamodel (static, in-repo): classes, allowed `(fromClass, type, toClass)` triples, hints — each with `source`.
- Tenancy: single user, single browser. Nothing leaves the device unless the user exports a file.
- Retention: until the user deletes it or clears browser storage. Delete = confirm, then gone.

## 5. Auth & access

- None. No sign-in, no roles, no sessions, no cookies.

## 6. Non-functional requirements

| Area | Target |
|---|---|
| Performance | LCP < 2.5 s mid-tier mobile; 60 fps canvas to 300 nodes; layout of 300 nodes < 1 s off the main thread |
| Accessibility | WCAG 2.2 AA; every canvas action by keyboard; screen-reader outline of the model |
| Availability / backup | static hosting; users back up via export |
| Privacy / compliance | no personal data collected; no cookies; no third-party requests; privacy page says so |
| Cost ceiling | $0/month (Vercel Hobby, existing domain). Anything else needs approval |

## 7. Integrations & dependencies

| Service | Purpose | Tier / cost | Approved by Mike? |
|---|---|---|---|
| Vercel | static hosting, previews | Hobby, $0 | yes (2026-09-26) |
| Netlify DNS | `model` CNAME on mikereams.com | existing | yes (2026-09-26) |
| GitHub `solventarchitect/blueprint-modeler` | source, CI | free, public | yes (2026-09-26) |
| `@xyflow/react`, `elkjs`, `zod` | canvas, layout, file validation | MIT | yes (2026-09-26) |
| Cloudflare Web Analytics | visit counts, cookieless | $0 | **approved 2026-09-27**; production only; token shared with mikereams.com |

## 8. Milestones

| # | Milestone | Deliverable | Verification | Status |
|---|---|---|---|---|
| M0 | Scaffold + CI + deploy | repo, Next static export, tokens, CI, Vercel project, `model.mikereams.com` | preview + custom domain open, CI green | **done 2026-09-26** |
| M1 | Metamodel + model format | typed CSDM subset with sources; model schema v1 + zod; storage wrapper | unit tests: sources present, round-trip, migration stub | **done 2026-09-27** — 13 classes, 16 relationship pairs (first recorded as 17; corrected 2026-09-27), 7 hint definitions; IndexedDB store exercised end-to-end in M2 (autosave) |
| M2 | Canvas | palette, add/rename/delete, allowed-only connections, undo/redo, autosave, keyboard path | F-01, F-02, F-04; Playwright hero flow | **done 2026-09-27** — `/editor`; inspector gives a full keyboard path (rename, add/remove relationships, delete); drag-connect refuses disallowed pairs with a reason; model switcher + New model |
| M3 | Hints + guide | conformance hints with sources and highlighting; class guide; 3 examples | F-03, F-08 | **done 2026-09-27** — `evaluateHints` (8 hint kinds incl. capability depth/cycles); Hints tab scoped to the selection, click to highlight + zoom; `/guide` lists classes, relationships (evidence) and hints with sources; 3 fictional examples from the empty state or toolbar; header nav, side-to-side edges in a lane |
| M4 | Import/export + layout | JSON import/export, SVG export light/dark, ELK layout in a worker | F-05, F-06, F-07 | **done 2026-09-27** — Import… (invalid files refused with a reason, nothing changed; same id → imported as a copy); Export menu: JSON, SVG dark/light (standalone: system fonts, no scripts or remote refs); Auto-layout = elkjs 0.12.0 (EPL-2.0, approved) in its own worker, layered top-down with partitions per CSDM layer, one undo step |
| M5 | Launch | landing, About (not-affiliated notice), privacy, a11y + 5-breakpoint pass, a post on mikereams.com linking to it | preview checks, axe, Lighthouse, live on the domain | **in progress** — app side done 2026-09-27: /about, /privacy, theme toggle (Auto/Light/Dark), Cloudflare beacon (production only), sitemap + robots, axe on every page in forced themes, 320–1536px; fixes: nodes no longer vanish while dragging, subtler canvas grid, stronger edges and labels. mikereams.com Work page + nav link live (PR #35, 2026-09-27). Open: launch post (drafted, awaiting review) |
| M6 | ArchiMate lens | "CSDM + ArchiMate 3.2" lens: mapped element name + notation icon on nodes, palette, inspector; relationship readings; guide section; SVG export follows the lens; view-only (no schema change) | mapping covers every class and pair, exchange-format type names, relationships valid per the ArchiMate 3.2 relationship tables; e2e + axe | **done 2026-09-27** (approved by Mike) |
| M7 | ArchiMate export | Model Exchange File Format (3.1 XSD) export: elements, relationships, one diagram with positions | opens in Archi; XML well-formed; tests | **done 2026-09-27** — Export › ArchiMate model (XML); every example plus edge cases validated against the official 3.1 XSDs with xmllint (dev-time; the XSDs are not vendored); CSDM class and relationship type kept as properties; unmapped pairs export as Association |
| M8 | Kubernetes classes | CMDB Kubernetes classes and relationships from public ServiceNow docs; Kubernetes example uses them; ArchiMate mapping | sources on every entry; tests | **done 2026-09-27** — 6 classes (cluster, node, namespace, workload, service, pod) and 8 relationships with the types Kubernetes discovery documents (reported), plus application service → workload / cluster (conventional, pairing inferred and labeled); ArchiMate mapping for all (validated against the relationship tables); Kubernetes example redrawn in these classes. Also: theme toggle re-applies a saved theme if React rebuilds `<html>` (flaky reload) |

## 9. Open questions

| Q | Owner | Needed by | Answer |
|---|---|---|---|
| Q1 Product name — avoid using "CSDM" in the name | Mike | M0 | **Blueprint Modeler** (Mike, 2026-09-26) |
| Q2 Reuse ArchTruth's DSL package? Copying it here open-sources it under MIT | Mike | M1 | no for v1 — JSON model format (default taken at M1) |
| Q3 Cloudflare Web Analytics on the app? | Mike | M5 | **Yes** (Mike, 2026-09-27) |
| Q4 Approve deps `@xyflow/react`, `elkjs`, `zod`; new Vercel project; GitHub repo; DNS record | Mike | M0 | **Approved** (Mike, 2026-09-26); deps added when first used (M1 zod, M2 xyflow, M4 elkjs) |
| Q5 Link from mikereams.com nav/Work page at launch? | Mike | M5 | **Yes** (Mike, 2026-09-27); theme toggle also approved |

## 10. Status

- **Last deploy:** `1375d84` → https://model.mikereams.com on 2026-09-26 (Vercel `dpl_EsKmcGeCtTwo96toQaHTAHfdfgD9`, TLS valid; CI run 36283442780 green)
- **Done:** plan approved (2026-09-26); M0 scaffold — Next 15 static export, Blueprint tokens + self-hosted Plex, CI, unit + Playwright (axe dark/light, no third-party requests, 5 breakpoints) green locally; M1 metamodel + model format; M2 canvas; M3 hints, guide, examples; M4 import/export, SVG, auto-layout
- **Post-M5 (2026-09-27):** favicon + app icons (BM mark); examples 4–5: Storefront on Kubernetes (cluster = TMSO, workloads = applications, nodes = hosts) and Enterprise AI assistant (planned agent triggers a hint); README v2
- **Post-M8 (2026-09-27):** entity names in Title Case across UI and docs (Mike); live connection feedback — green ✓ + relationship type over a valid target, red dashed ✕ + reason over an invalid one, before release
- **Next:** finish M5 (launch post; its PR also updates the mikereams.com Work page: five examples, class counts) — link from mikereams.com (nav + Work page) and a launch post (draft for Mike's review)
- **Metamodel evidence:** every class, pairing and hint cites the CSDM 5 white paper or a ServiceNow Community thread. Relationship *type labels* are marked `reported` (Business application → Application service: `Uses::Used by`, CSDM 4 `Consumes::Consumed by` kept as legacy) or `conventional` (standard CMDB types the public text does not name for that pair) — conventional labels approved by Mike (2026-09-27)
- **Blocked on Mike:** —
