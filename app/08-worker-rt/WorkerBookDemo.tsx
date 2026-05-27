"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRafBatcher } from "@/libs/raf-batcher";
import { ReconnectingSocket, type Status } from "../03-seq-gap/socket";
import {
  applyDeltas,
  emptyBook,
  getSpread,
  type Book,
} from "../05-apply-delta/apply-delta";
import {
  diffSnapshot,
  snapshotFromLevels,
  type SnapshotMaps,
} from "../05-apply-delta/snapshot-diff";
import {
  emptySnapshot,
  type BookSnapshot,
  type WorkerToMain,
} from "./worker-protocol";

const STATUS_COLOR: Record<Status, string> = {
  connecting:
    "bg-yellow-500/15 text-yellow-900 dark:bg-yellow-500/20 dark:text-yellow-300",
  open: "bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300",
  closed:
    "bg-neutral-500/15 text-neutral-800 dark:bg-zinc-500/20 dark:text-zinc-300",
  reconnecting:
    "bg-orange-500/15 text-orange-900 dark:bg-orange-500/20 dark:text-orange-300",
  error: "bg-red-500/15 text-red-900 dark:bg-red-500/20 dark:text-red-300",
};

function isL2Level(v: unknown): v is { px: string; sz: string } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.px === "string" && typeof o.sz === "string";
}

function parseL2Book(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const levels = data.levels;
  if (!Array.isArray(levels) || levels.length < 2) return null;
  const bids = (levels[0] as unknown[]).filter(isL2Level);
  const asks = (levels[1] as unknown[]).filter(isL2Level);
  if (bids.length === 0 && asks.length === 0) return null;
  return { bids, asks };
}

function bookToSnapshot(book: Book, wsMessages: number, workerJobs: number): BookSnapshot {
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

export function WorkerBookDemo() {
  const socketRef = useRef<ReconnectingSocket | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const useWorkerRef = useRef(true);

  // Main-thread fallback (kata 7 path)
  const bookRef = useRef<Book>(emptyBook());
  const prevSnapshotRef = useRef<SnapshotMaps | null>(null);
  const wsMessagesRef = useRef(0);
  const workerJobsRef = useRef(0);

  const snapshotRef = useRef<BookSnapshot>(emptySnapshot());

  const [useWorker, setUseWorker] = useState(true);
  const [snapshot, setSnapshot] = useState<BookSnapshot>(emptySnapshot);
  const [renderCount, setRenderCount] = useState(0);
  const [status, setStatus] = useState<Status>("closed");
  const [workerReady, setWorkerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useWorkerRef.current = useWorker;
  }, [useWorker]);

  const pushToReact = useCallback(() => {
    setSnapshot(snapshotRef.current);
    setRenderCount((n) => n + 1);
  }, []);

  const batcherRef = useRef<ReturnType<typeof createRafBatcher> | null>(null);

  useEffect(() => {
    const batcher = createRafBatcher(pushToReact);
    batcherRef.current = batcher;
    return () => batcher.cancel();
  }, [pushToReact]);

  const requestRender = useCallback(() => {
    batcherRef.current?.schedule();
  }, []);

  // Spawn worker once on mount
  useEffect(() => {
    const worker = new Worker(new URL("./book.worker.ts", import.meta.url));
    workerRef.current = worker;
    setWorkerReady(true);

    worker.onmessage = (event: MessageEvent<WorkerToMain>) => {
      const msg = event.data;
      if (msg.type === "ERROR") {
        setError(msg.message);
        return;
      }
      if (msg.type === "SNAPSHOT") {
        snapshotRef.current = msg.snapshot;
        requestRender();
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      setWorkerReady(false);
    };
  }, [requestRender]);

  useEffect(() => {
    const socket = new ReconnectingSocket("wss://api.hyperliquid.xyz/ws");

    const offStatus = socket.on("status", (st) => {
      setStatus(st);
      if (st === "closed") {
        wsMessagesRef.current = 0;
        workerJobsRef.current = 0;
        bookRef.current = emptyBook();
        prevSnapshotRef.current = null;
        snapshotRef.current = emptySnapshot();
        workerRef.current?.postMessage({ type: "RESET" });
        pushToReact();
      }
    });

    const offMessage = socket.on("message", (data) => {
      const msg = data as { channel?: string; data?: unknown };
      if (msg.channel !== "l2Book" || msg.data == null) return;

      if (useWorkerRef.current && workerRef.current) {
        workerRef.current.postMessage({ type: "WS_L2", data: msg.data });
        return;
      }

      // Main thread path (compare with kata 7)
      const parsed = parseL2Book(msg.data);
      if (!parsed) return;

      wsMessagesRef.current += 1;
      workerJobsRef.current += 1;

      const nextSnap = snapshotFromLevels(parsed.bids, parsed.asks);
      const deltas = diffSnapshot(prevSnapshotRef.current, nextSnap);
      bookRef.current = applyDeltas(bookRef.current, deltas);
      prevSnapshotRef.current = nextSnap;

      snapshotRef.current = bookToSnapshot(
        bookRef.current,
        wsMessagesRef.current,
        workerJobsRef.current,
      );
      requestRender();
    });

    socket.connect();
    socket.subscribe({
      method: "subscribe",
      subscription: { type: "l2Book", coin: "ETH", nLevels: 20 },
    });

    socketRef.current = socket;

    return () => {
      offStatus();
      offMessage();
      batcherRef.current?.cancel();
      socket.close();
    };
  }, [pushToReact, requestRender]);

  function simulateFlood(count: number) {
    if (useWorkerRef.current && workerRef.current) {
      workerRef.current.postMessage({ type: "FLOOD", count });
      return;
    }

    const { bids, asks } = bookRef.current;
    for (let i = 0; i < count; i++) {
      const price = (2340 + (i % 5) * 0.1).toFixed(1);
      bids.upsert(price, "1");
    }
    bookRef.current = { bids, asks };
    workerJobsRef.current += count;
    wsMessagesRef.current += count;
    snapshotRef.current = bookToSnapshot(
      bookRef.current,
      wsMessagesRef.current,
      workerJobsRef.current,
    );
    requestRender();
  }

  const ratio =
    renderCount > 0
      ? (snapshot.workerJobs / renderCount).toFixed(1)
      : "—";

  return (
    <article className="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/40">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium font-mono uppercase ${STATUS_COLOR[status]}`}
        >
          {status}
        </span>
        <span
          className={`rounded-md px-2 py-1 text-xs font-mono ${
            workerReady
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
              : "bg-neutral-200 text-neutral-600"
          }`}
        >
          worker {workerReady ? "ready" : "…"}
        </span>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900/60">
          <input
            type="checkbox"
            checked={useWorker}
            onChange={(e) => setUseWorker(e.target.checked)}
          />
          Book math on <strong>{useWorker ? "Worker" : "Main"}</strong>
        </label>
      </div>

      <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        Main thread: WebSocket + rAF paint only. Worker: parse, diff,{" "}
        <code className="rounded bg-neutral-200 px-1 text-xs dark:bg-neutral-800">
          applyDeltas
        </code>
        , then sends a plain JSON snapshot back.
      </p>

      {error && (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
          {error}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label="WS / jobs" value={String(snapshot.wsMessages)} />
        <Stat
          label="Worker jobs"
          value={String(snapshot.workerJobs)}
          accent="violet"
        />
        <Stat
          label="React renders"
          value={String(renderCount)}
          accent="orange"
        />
        <Stat label="Jobs / render" value={ratio} accent="emerald" />
      </div>

      <p className="mt-3 font-mono text-sm text-neutral-500">
        Spread: {snapshot.spread ?? "—"}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Side title="Bids" tone="bid" rows={snapshot.bids} />
        <Side title="Asks" tone="ask" rows={snapshot.asks} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => simulateFlood(200)}
          className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium"
        >
          Flood 200 (worker or main)
        </button>
        <button
          type="button"
          disabled={status !== "open"}
          onClick={() => socketRef.current?.simulateDrop()}
          className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm disabled:opacity-40"
        >
          Simulate drop
        </button>
      </div>
    </article>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "orange" | "emerald" | "violet";
}) {
  const c =
    accent === "orange"
      ? "text-orange-600"
      : accent === "emerald"
        ? "text-emerald-600"
        : accent === "violet"
          ? "text-violet-600"
          : "text-neutral-900 dark:text-neutral-100";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${c}`}>
        {value}
      </p>
    </div>
  );
}

function Side({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "bid" | "ask";
  rows: BookSnapshot["bids"];
}) {
  const accent =
    tone === "bid" ? "text-emerald-600" : "text-red-600";

  return (
    <div>
      <h3 className={`mb-2 text-xs font-semibold uppercase ${accent}`}>
        {title}
      </h3>
      <ul className="divide-y rounded-lg border border-neutral-200 dark:border-neutral-800">
        {rows.length === 0 ? (
          <li className="px-3 py-6 text-center text-xs text-neutral-500">
            Waiting…
          </li>
        ) : (
          rows.map((r) => (
            <li
              key={`${title}-${r.price}`}
              className="grid grid-cols-2 gap-2 px-3 py-1.5 font-mono text-xs"
            >
              <span>{r.price}</span>
              <span className="text-right text-neutral-500">{r.size}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
