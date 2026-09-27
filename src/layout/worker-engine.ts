import ELK from "elkjs/lib/elk-api";
import type { LayoutEngine } from "./layout";

/**
 * A LayoutEngine that runs ELK in a Web Worker (browser only), so the editor stays responsive.
 * The worker script is elkjs's own, bundled as a same-origin static file.
 */
export function createWorkerEngine(): LayoutEngine & { dispose: () => void } {
  const elk = new ELK({ workerFactory: () => new Worker(new URL("elkjs/lib/elk-worker.min.js", import.meta.url)) });
  return { layout: (graph) => elk.layout(graph), dispose: () => elk.terminateWorker() };
}
