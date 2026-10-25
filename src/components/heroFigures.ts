/**
 * The three figures of the realization chain, each shown on its own card below the hero: what it
 * shows in words (its accessible description), a one-line summary, and the guide section it opens.
 */
export const heroFigures = [
  {
    label: "The realization chain",
    summary: "Allowed relationships only. Every rule cites its source.",
    href: "/guide#relationships",
    desc: "A Business Capability, Order Management, is provided by the Business Application Checkout, which uses the Application Service Checkout — production. That service depends on the Application checkout-web, which runs on the Host web-prod-01.",
  },
  {
    label: "Caught early",
    summary: "A Business Application is not related directly to a Host in CSDM.",
    href: "/guide#hints",
    desc: "The same chain, with a line drawn straight from the Business Application Checkout to the Host web-prod-01. The editor refuses it: a Business Application is not related directly to a Host in CSDM. The route goes through the Application Service Checkout — production instead.",
  },
  {
    label: "Read it in ArchiMate",
    summary: "Same model, read in ArchiMate 3.2: a view-only lens.",
    href: "/guide#archimate",
    desc: "The same elements read in ArchiMate 3.2: Order Management is a Capability realized by the Application Component Checkout, which is realized by the Application Component Checkout — production. The System Software checkout-web serves it, and the Node web-prod-01 aggregates the system software. Elements take their ArchiMate layer colors; the model itself stays in CSDM.",
  },
] as const;
