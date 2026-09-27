import type { Layer } from "@/metamodel";

/** Left-border colour per canvas lane; shared by nodes, the palette and the guide (server-safe). */
export const layerAccent: Record<Layer, string> = {
  business: "border-l-status",
  design: "border-l-accent",
  service: "border-l-ai",
  functional: "border-l-ink-muted",
  infrastructure: "border-l-border-strong",
};
