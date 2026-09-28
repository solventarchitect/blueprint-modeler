# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: **[Report a vulnerability](https://github.com/solventarchitect/blueprint-modeler/security/advisories/new)** (the repository's Security tab). Don't open a public issue for them.

Include what you found, how to reproduce it, and what it could affect. You'll get a reply within a week. Once a fix is released, you'll be credited in the advisory unless you'd rather not be.

## Scope

Blueprint Modeler is a static site: no server, no accounts, no database. Models stay in the visitor's browser (IndexedDB), and import, export and auto-layout run on their device. The most relevant issues are therefore in the browser: for example script injection through an imported model file, a model name or an exported file (SVG, draw.io, ArchiMate XML, Excel), or anything that sends a model off the device.

## Supported versions

Only the latest release and the live site at [model.mikereams.com](https://model.mikereams.com) receive fixes.
