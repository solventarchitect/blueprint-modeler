# Contributing to Blueprint Modeler

Thanks for helping. Bug reports, rule corrections and pull requests are all welcome.

## The one rule: public source, in your own words

Every class, relationship and hint in `src/metamodel/` links to public ServiceNow material (mainly the CSDM 5 white paper, ServiceNow Community posts and product documentation), and a test fails the build if one doesn't. When you propose a metamodel change:

- Link the public source and the page (or section) it comes from.
- Describe the rule in your own words. Don't paste text from the source beyond a short quote.
- Don't use anything from an employer, a customer, a ServiceNow instance or any non-public material.
- Say whether the source names the relationship type (**reported**) or you're proposing a standard CMDB type for the pair (**conventional**).

The [rule correction](https://github.com/solventarchitect/blueprint-modeler/issues/new?template=rule_correction.yml) issue form asks for exactly this.

## Develop

Needs Node 22.12 or later and pnpm 11.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm verify     # typecheck, lint, unit tests, static build, Playwright
```

`pnpm verify` runs the same gates as CI. A pull request should keep it green, and a new behavior should come with a test.

## Pull requests

- Keep a pull request to one change, and say what it changes and why.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:` …).
- UI changes must keep WCAG 2.2 AA: keyboard access, visible focus, and text contrast of at least 4.5:1 in both themes (the e2e suite checks these).
- No new runtime dependency without discussing it in an issue first. The app is a static site with no server, accounts or tracking, and it stays that way.

## Conduct

Everyone taking part agrees to the [Code of Conduct](CODE_OF_CONDUCT.md). Security problems go through [SECURITY.md](SECURITY.md), not public issues.
