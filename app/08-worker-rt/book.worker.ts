/**
 * Runs off the main thread — parse + diff + applyDeltas live here.
 * Posts plain JSON snapshots back (no RBTree / Decimal classes).
 */
import { applyDelta, applyDeltas, emptyBook, getSpread } from "../05-apply-delta/apply-delta";
import {
  diffSnapshot,
  snapshotFromLevels,
  type SnapshotMaps,
} from "../05-apply-delta/snapshot-diff";
import type { BookSnapshot, MainToWorker, WorkerToMain } from "./worker-protocol";

let book = emptyBook();
let prevSnapshot: SnapshotMaps | null = null;
let wsMessages = 0;
let workerJobs = 0;

function isL2Level(v: unknown): v is { px: string; sz: string } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.px === "string" && typeof o.sz === "string";
}

function parseL2Data(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const levels = data.levels;
  if (!Array.isArray(levels) || levels.length < 2) return null;

  const bids = (levels[0] as unknown[]).filter(isL2Level);
  const asks = (levels[1] as unknown[]).filter(isL2Level);
  if (bids.length === 0 && asks.length === 0) return null;

  return { bids, asks };
}

function toSnapshot(): BookSnapshot {
  const limit = 12;
  return {
    bids: book.bids.toArray(limit).map((l) => ({
      price: l.price.toFixed(),
      size: l.size.toFixed(),
    })),
    asks: book.asks.toArray(limit).map((l) => ({
      price: l.price.toFixed(),
      size: l.size.toFixed(),
    })),
    spread: getSpread(book),
    wsMessages,
    workerJobs,
  };
}

function postSnapshot(): void {
  const msg: WorkerToMain = { type: "SNAPSHOT", snapshot: toSnapshot() };
  self.postMessage(msg);
}

function handleL2(data: unknown): void {
  const parsed = parseL2Data(data);
  if (!parsed) return;

  wsMessages += 1;
  workerJobs += 1;

  const nextSnap = snapshotFromLevels(parsed.bids, parsed.asks);
  const deltas = diffSnapshot(prevSnapshot, nextSnap);
  book = applyDeltas(book, deltas);
  prevSnapshot = nextSnap;

  postSnapshot();
}

function handleFlood(count: number): void {
  for (let i = 0; i < count; i++) {
    workerJobs += 1;
    const price = (2340 + (i % 5) * 0.1).toFixed(1);
    book = applyDelta(book, {
      side: "bid",
      price,
      size: String(1 + (i % 3)),
    });
  }
  wsMessages += count;
  postSnapshot();
}

function reset(): void {
  book = emptyBook();
  prevSnapshot = null;
  wsMessages = 0;
  workerJobs = 0;
  postSnapshot();
}

self.onmessage = (event: MessageEvent<MainToWorker>) => {
  try {
    const msg = event.data;
    switch (msg.type) {
      case "WS_L2":
        handleL2(msg.data);
        break;
      case "FLOOD":
        handleFlood(msg.count);
        break;
      case "RESET":
        reset();
        break;
      default:
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Worker error";
    const out: WorkerToMain = { type: "ERROR", message };
    self.postMessage(out);
  }
};
