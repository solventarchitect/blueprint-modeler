import type { GifWorkerReply, GifWorkerRequest } from "./gif.worker";

const sizeOf = (svg: string) => /<svg[^>]* width="([\d.]+)" height="([\d.]+)"/.exec(svg);

/**
 * Turns SVG frames into a GIF in the browser: each frame is drawn onto a canvas from a blob URL (local,
 * never a network request) and sent to the encoding worker. All frames share the first frame's size.
 */
export async function renderGif(input: { svgs: string[]; delaysCs: number[]; palette: number[]; comment?: string; scale: (w: number, h: number) => number; signal?: AbortSignal }) {
  const first = sizeOf(input.svgs[0] ?? "");
  if (!first) throw new Error("No frames to draw.");
  // Stretching a frame to fit would distort it: every frame must be the first frame's size.
  if (input.svgs.some((svg) => sizeOf(svg)?.[0] !== first[0])) throw new Error("Frames differ in size.");
  const s = input.scale(Number(first[1]), Number(first[2]));
  const width = Math.max(1, Math.round(Number(first[1]) * s));
  const height = Math.max(1, Math.round(Number(first[2]) * s));

  const worker = new Worker(new URL("./gif.worker.ts", import.meta.url));
  const send = (m: GifWorkerRequest, transfer: Transferable[] = []) => worker.postMessage(m, transfer);
  try {
    const result = new Promise<Uint8Array>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<GifWorkerReply>) => (e.data.type === "done" ? resolve(new Uint8Array(e.data.gif)) : reject(new Error(e.data.message)));
      worker.onerror = (e) => reject(new Error(e.message || "The GIF worker failed."));
    });
    // A worker error while frames are still being drawn is reported by the await below.
    result.catch(() => undefined);
    send({ type: "start", width, height, palette: input.palette, comment: input.comment });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("This browser cannot draw the frames.");
    for (let i = 0; i < input.svgs.length; i++) {
      if (input.signal?.aborted) throw new Error("Stopped.");
      const url = URL.createObjectURL(new Blob([input.svgs[i]!], { type: "image/svg+xml" }));
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      } finally {
        URL.revokeObjectURL(url);
      }
      const rgba = ctx.getImageData(0, 0, width, height).data;
      send({ type: "frame", rgba: rgba.buffer as ArrayBuffer, delayCs: input.delaysCs[i] ?? 0 }, [rgba.buffer as ArrayBuffer]);
    }
    send({ type: "end" });
    const bytes = await result;
    if (input.signal?.aborted) throw new Error("Stopped.");
    return { bytes, width, height };
  } finally {
    worker.terminate();
  }
}
