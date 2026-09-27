# Blueprint Modeler

A free, browser-only canvas for modeling application architecture with ServiceNow's Common Service Data Model
(CSDM): capability → business application → application service → technology. No sign-up, no server; your models
stay in your browser and in files you export.

**Status:** M0 — scaffold. Live at https://model.mikereams.com. Plan and requirements: [`SPEC.md`](SPEC.md);
constraints: [`CLAUDE.md`](CLAUDE.md).

## Develop

```pwsh
pnpm install
pnpm dev
```

## Verify (same as CI)

```pwsh
pnpm verify   # typecheck, lint, unit, static build, Playwright (axe, no third-party requests, 5 breakpoints)
```

## License

[MIT](LICENSE) © 2026 Mike Reams. IBM Plex fonts: SIL Open Font License (see `src/fonts/README.md`).

Not affiliated with or endorsed by ServiceNow. ServiceNow and CSDM are trademarks of ServiceNow, Inc., used here
only to describe what the tool models.
