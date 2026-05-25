"use client";

/** Reference solution — compare after you finish STEPS.md */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRafBatcher } from "@/libs/raf-batcher";
import { ReconnectingSocket, type Status } from "../03-seq-gap/socket";
import {
  applyDelta,
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

function parseL2Book(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const levels = data.levels;
  if (!Array.isArray(levels) || levels.length < 2) return null;
  const bids = (levels[0] as { px: string; sz: string }[]).filter(
    (l) => typeof l?.px === "string" && typeof l?.sz === "string",
  );
  const asks = (levels[1] as { px: string; sz: string }[]).filter(
    (l) => typeof l?.px === "string" && typeof l?.sz === "string",
  );
  if (bids.length === 0 && asks.length === 0) return null;
  return { bids, asks };
}

function toRows(book: Book, side: "bid" | "ask", limit = 8) {
  const levels =
    side === "bid" ? book.bids.toArray(limit) : book.asks.toArray(limit);
  return levels.map((l) => ({
    price: l.price.toFixed(),
    size: l.size.toFixed(),
  }));
}

export function RafBatcherDemoSolution() {
  const bookRef = useRef<Book>(emptyBook());
  const prevSnapshotRef = useRef<SnapshotMaps | null>(null);
  const batchedRef = useRef(true);

  const [batched, setBatched] = useState(true);
  const [book, setBook] = useState<Book>(() => emptyBook());
  const [wsMessages, setWsMessages] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const [status, setStatus] = useState<Status>("closed");

  useEffect(() => {
    batchedRef.current = batched;
  }, [batched]);

  const pushToReact = useCallback(() => {
    setBook(bookRef.current);
    setRenderCount((n) => n + 1);
  }, []);

  const batcherRef = useRef<ReturnType<typeof createRafBatcher> | null>(null);

  useEffect(() => {
    const batcher = createRafBatcher(pushToReact);
    batcherRef.current = batcher;
    return () => batcher.cancel();
  }, [pushToReact]);

  const requestRender = useCallback(() => {
    if (batchedRef.current) {
      batcherRef.current?.schedule();
    } else {
      pushToReact();
    }
  }, [pushToReact]);

  useEffect(() => {
    const socket = new ReconnectingSocket("wss://api.hyperliquid.xyz/ws");

    const offMessage = socket.on("message", (data) => {
      const msg = data as { channel?: string; data?: unknown };
      if (msg.channel !== "l2Book" || msg.data == null) return;

      const parsed = parseL2Book(msg.data);
      if (!parsed) return;

      setWsMessages((n) => n + 1);

      const nextSnap = snapshotFromLevels(parsed.bids, parsed.asks);
      const deltas = diffSnapshot(prevSnapshotRef.current, nextSnap);
      bookRef.current = applyDeltas(bookRef.current, deltas);
      prevSnapshotRef.current = nextSnap;
      requestRender();
    });

    socket.on("status", setStatus);
    socket.connect();
    socket.subscribe({
      method: "subscribe",
      subscription: { type: "l2Book", coin: "ETH", nLevels: 20 },
    });

    return () => {
      offMessage();
      batcherRef.current?.cancel();
      socket.close();
    };
  }, [requestRender]);

  function simulateFlood(count: number) {
    for (let i = 0; i < count; i++) {
      const price = (2340 + (i % 5) * 0.1).toFixed(1);
      bookRef.current = applyDelta(bookRef.current, {
        side: "bid",
        price,
        size: "1",
      });
      requestRender();
    }
    setWsMessages((n) => n + count);
  }

  const spread = useMemo(() => getSpread(book), [book]);
  const ratio = renderCount > 0 ? (wsMessages / renderCount).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={batched}
          onChange={(e) => setBatched(e.target.checked)}
        />
        rAF batching: <strong>{batched ? "ON" : "OFF"}</strong>
      </label>

      <div className="grid grid-cols-3 gap-3 font-mono text-sm">
        <div className="rounded border p-3">
          <p className="text-neutral-500">WS messages</p>
          <p className="text-xl font-semibold">{wsMessages}</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-neutral-500">React renders</p>
          <p className="text-xl font-semibold text-orange-600">{renderCount}</p>
        </div>
        <div className="rounded border p-3">
          <p className="text-neutral-500">msgs / render</p>
          <p className="text-xl font-semibold text-emerald-600">{ratio}</p>
        </div>
      </div>

      <p className="text-sm text-neutral-500">
        Status: {status} · spread: {spread ?? "—"}
      </p>

      <div className="grid gap-4 md:grid-cols-2 font-mono text-xs">
        <ul className="rounded border divide-y">
          {toRows(book, "bid").map((r) => (
            <li key={r.price} className="grid grid-cols-2 px-2 py-1">
              <span>{r.price}</span>
              <span className="text-right">{r.size}</span>
            </li>
          ))}
        </ul>
        <ul className="rounded border divide-y">
          {toRows(book, "ask").map((r) => (
            <li key={r.price} className="grid grid-cols-2 px-2 py-1">
              <span>{r.price}</span>
              <span className="text-right">{r.size}</span>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="button"
        onClick={() => simulateFlood(200)}
        className="rounded border border-violet-500/50 bg-violet-500/10 px-4 py-2 text-sm"
      >
        Flood 200 updates
      </button>
    </div>
  );
}
