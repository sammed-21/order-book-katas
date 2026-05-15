"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ReconnectingSocket, type Status } from "../03-seq-gap/socket";
import {
  applyDelta,
  applyDeltas,
  emptyBook,
  getSpread,
  type Book,
  type Delta,
} from "./apply-delta";
import {
  diffSnapshot,
  snapshotFromLevels,
  type SnapshotMaps,
} from "./snapshot-diff";

type DisplayRow = { price: string; size: string };

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

  return {
    coin: typeof data.coin === "string" ? data.coin : "?",
    bids,
    asks,
  };
}

function toRows(book: Book, side: "bid" | "ask", limit = 12): DisplayRow[] {
  const levels =
    side === "bid" ? book.bids.toArray(limit) : book.asks.toArray(limit);
  return levels.map((l) => ({
    price: l.price.toFixed(),
    size: l.size.toFixed(),
  }));
}

export function ApplyDelta() {
  const socketRef = useRef<ReconnectingSocket | null>(null);
  const bookRef = useRef<Book>(emptyBook());
  const prevSnapshotRef = useRef<SnapshotMaps | null>(null);

  const [status, setStatus] = useState<Status>("closed");
  const [book, setBook] = useState<Book>(() => emptyBook());
  const [lastDeltaCount, setLastDeltaCount] = useState(0);
  const [history, setHistory] = useState<string[]>([
    "Connecting to Hyperliquid l2Book…",
  ]);

  const spread = useMemo(() => getSpread(book), [book]);
  const bidRows = useMemo(() => toRows(book, "bid"), [book]);
  const askRows = useMemo(() => toRows(book, "ask"), [book]);

  useEffect(() => {
    const socket = new ReconnectingSocket("wss://api.hyperliquid.xyz/ws");
    socketRef.current = socket;

    function resetBook(reason: string) {
      const fresh = emptyBook();
      bookRef.current = fresh;
      prevSnapshotRef.current = null;
      setBook(fresh);
      setLastDeltaCount(0);
      setHistory([reason]);
    }

    const offStatus = socket.on("status", (st) => {
      setStatus(st);
      if (st !== "open") {
        resetBook("Disconnected — book cleared until next snapshot.");
      }
    });

    const offMessage = socket.on("message", (data) => {
      const msg = data as { channel?: string; data?: unknown };
      if (msg.channel !== "l2Book" || msg.data == null) return;

      const parsed = parseL2Book(msg.data);
      if (!parsed) return;

      const nextSnap = snapshotFromLevels(parsed.bids, parsed.asks);
      const deltas = diffSnapshot(prevSnapshotRef.current, nextSnap);
      const nextBook = applyDeltas(bookRef.current, deltas);

      bookRef.current = nextBook;
      prevSnapshotRef.current = nextSnap;
      setBook(nextBook);
      setLastDeltaCount(deltas.length);

      if (deltas.length > 0) {
        const preview = deltas
          .slice(0, 2)
          .map((d) => `${d.side} ${d.price}→${d.size}`)
          .join(" · ");
        const more = deltas.length > 2 ? ` · +${deltas.length - 2}` : "";
        setHistory((prev) =>
          [`${deltas.length} Δ: ${preview}${more}`, ...prev].slice(0, 8),
        );
      }
    });

    socket.connect();
    socket.subscribe({
      method: "subscribe",
      subscription: { type: "l2Book", coin: "ETH", nLevels: 20 },
    });

    return () => {
      offStatus();
      offMessage();
      socket.close();
    };
  }, []);

  /** Manual demo: one delta at a time (same as live, but single item). */
  function applyOne(delta: Delta) {
    const next = applyDelta(bookRef.current, delta);
    bookRef.current = next;
    setBook(next);
    setLastDeltaCount(1);
    setHistory((prev) =>
      [`manual: ${delta.side} ${delta.price} → ${delta.size}`, ...prev].slice(
        0,
        8,
      ),
    );
  }

  function reset() {
    const fresh = emptyBook();
    bookRef.current = fresh;
    prevSnapshotRef.current = null;
    setBook(fresh);
    setLastDeltaCount(0);
    setHistory(["Reset to empty book."]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium font-mono uppercase ${STATUS_COLOR[status]}`}
        >
          {status}
        </span>
        <span className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          live l2Book · last tick {lastDeltaCount} deltas
        </span>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        <strong>applyDelta</strong> = one change.{" "}
        <strong>diffSnapshot</strong> = array of changes from two snapshots.{" "}
        <strong>applyDeltas(book, deltas)</strong> = apply that array.
      </p>

      <p className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
        Spread: {spread ?? "—"} · bids {book.bids.toArray().length} · asks{" "}
        {book.asks.toArray().length}
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <SidePanel title="Bids" tone="bid" rows={bidRows} />
        <SidePanel title="Asks" tone="ask" rows={askRows} />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            applyOne({ side: "bid", price: "2340.1", size: "8.4" })
          }
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs dark:border-neutral-600 dark:bg-neutral-900"
        >
          Manual Δ bid
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-neutral-400 px-3 py-2 text-xs"
        >
          Reset
        </button>
        <button
          type="button"
          disabled={status !== "open"}
          onClick={() => socketRef.current?.simulateDrop()}
          className="rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-xs disabled:opacity-40"
        >
          Simulate drop
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Delta log
        </p>
        <ul className="space-y-1 font-mono text-xs text-neutral-700 dark:text-neutral-300">
          {history.map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SidePanel({
  title,
  tone,
  rows,
}: {
  title: string;
  tone: "bid" | "ask";
  rows: DisplayRow[];
}) {
  const accent =
    tone === "bid"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div>
      <h3
        className={`mb-2 text-xs font-semibold uppercase tracking-wide ${accent}`}
      >
        {title}
      </h3>
      <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
        {rows.length === 0 ? (
          <li className="px-3 py-4 text-center text-xs text-neutral-500">
            Waiting for book…
          </li>
        ) : (
          rows.map((row) => (
            <li
              key={row.price}
              className="grid grid-cols-2 gap-2 px-3 py-1.5 font-mono text-xs"
            >
              <span>{row.price}</span>
              <span className="text-right text-neutral-500">{row.size}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
