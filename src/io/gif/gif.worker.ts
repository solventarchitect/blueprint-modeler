import { encodeGif, type GifFrame } from "./encode";
import { quantize } from "./quantize";

/**
 * GIF encoding off the main thread. Frames arrive one at a time as RGBA (transferred, not copied) and
 * are reduced to palette indices at once, so only one byte a pixel is held per frame.
 */
export type GifWorkerRequest =
  | { type: "start"; width: number; height: number; palette: number[]; comment?: string }
  | { type: "frame"; rgba: ArrayBuffer; delayCs: number }
  | { type: "end" };
export type GifWorkerReply = { type: "done"; gif: ArrayBuffer } | { type: "error"; message: string };

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<GifWorkerRequest>) => void) | null;
  postMessage: (m: GifWorkerReply, transfer?: Transferable[]) => void;
};

let job: { width: number; height: number; palette: number[]; comment?: string; frames: GifFrame[] } | null = null;

scope.onmessage = (e) => {
  try {
    const m = e.data;
    if (m.type === "start") job = { width: m.width, height: m.height, palette: m.palette, comment: m.comment, frames: [] };
    else if (!job) throw new Error("No GIF started.");
    else if (m.type === "frame") job.frames.push({ indices: quantize(new Uint8ClampedArray(m.rgba), job.palette), delayCs: m.delayCs });
    else {
      const bytes = encodeGif(job);
      job = null;
      scope.postMessage({ type: "done", gif: bytes.buffer as ArrayBuffer }, [bytes.buffer as ArrayBuffer]);
    }
  } catch (err) {
    job = null;
    scope.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
