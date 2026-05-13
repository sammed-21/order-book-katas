"use client";

import { useEffect, useRef, useState } from "react";
import Decimal from "decimal.js";
import {
  ReconnectingSocket,
  type Status,
} from "../03-seq-gap/socket";
import { Side, type Direction, type Level } from "./side";

type DisplayLevel = {
  price: string;
  size: string;
};

type BookView = {
  asks: DisplayLevel[];
  bids: DisplayLevel[];
  bestAsk: DisplayLevel | null;
  bestBid: DisplayLevel | null;
  lastAction: string;
  spread: string | null;
};

type L2Level = {
  px: string;
  sz: string;
  n: number;
};

type LiveSnapshotMeta = {
  askCount: number;
  bidCount: number;
  coin: string;
  receivedAt: number;
};

const EMPTY_VIEW: BookView = {
  asks: [],
  bids: [],
  bestAsk: null,
  bestBid: null,
  lastAction:
    "Waiting for a live book snapshot or a manual sample update.",
  spread: null,
};

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

function isL2Level(v: unknown): v is L2Level {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;

  return (
    typeof o.px === "string" &&
    typeof o.sz === "string" &&
    typeof o.n === "number"
  );
}

function parseL2BookPayload(
  raw: unknown,
): Omit<LiveSnapshotMeta, "receivedAt"> & { asks: L2Level[]; bids: L2Level[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const levels = data.levels;

  if (!Array.isArray(levels) || levels.length < 2) return null;

  const rawBids = levels[0];
  const rawAsks = levels[1];
  if (!Array.isArray(rawBids) || !Array.isArray(rawAsks)) return null;

  const bids = rawBids.filter(isL2Level);
  const asks = rawAsks.filter(isL2Level);
  if (bids.length === 0 && asks.length === 0) return null;

  return {
    asks,
    askCount: asks.length,
    bids,
    bidCount: bids.length,
    coin: typeof data.coin === "string" ? data.coin : "?",
  };
}

function levelToDisplay(level: Level | null): DisplayLevel | null {
  if (!level) return null;

  return {
    price: level.price.toFixed(),
    size: level.size.toFixed(),
  };
}

function sampleBook(bids: Side, asks: Side): void {
  bids.clear();
  asks.clear();

  bids.upsert("2340.2", "12.75");
  bids.upsert("2340.1", "8.40");
  bids.upsert("2340.0", "5.00");
  bids.upsert("2339.8", "2.25");

  asks.upsert("2340.3", "9.15");
  asks.upsert("2340.4", "6.20");
  asks.upsert("2340.5", "3.95");
  asks.upsert("2340.8", "1.10");
}

function applyLiveSnapshot(
  bids: Side,
  asks: Side,
  snapshot: { asks: L2Level[]; bids: L2Level[] },
): void {
  bids.clear();
  asks.clear();

  snapshot.bids.forEach((level) => {
    bids.upsert(level.px, level.sz);
  });
  snapshot.asks.forEach((level) => {
    asks.upsert(level.px, level.sz);
  });
}

function buildBookView(bids: Side, asks: Side, lastAction: string): BookView {
  const bidRows = bids.toArray(12).map((level) => ({
    price: level.price.toFixed(),
    size: level.size.toFixed(),
  }));
  const askRows = asks.toArray(12).map((level) => ({
    price: level.price.toFixed(),
    size: level.size.toFixed(),
  }));
  const bestBid = bids.best();
  const bestAsk = asks.best();

  return {
    asks: askRows,
    bids: bidRows,
    bestAsk: levelToDisplay(bestAsk),
    bestBid: levelToDisplay(bestBid),
    lastAction,
    spread:
      bestBid && bestAsk ? bestAsk.price.minus(bestBid.price).toFixed() : null,
  };
}

function LevelTable({
  emptyLabel,
  rows,
  title,
  tone,
}: {
  emptyLabel: string;
  rows: DisplayLevel[];
  title: string;
  tone: "ask" | "bid";
}) {
  const accent =
    tone === "bid"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-red-700 dark:text-red-400";

  return (
    <div className="min-w-0 flex-1">
      <h3
        className={`mb-2 text-xs font-semibold uppercase tracking-[0.15em] ${accent}`}
      >
        {title}
      </h3>
      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="grid grid-cols-2 gap-2 border-b border-neutral-200 bg-neutral-100/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400">
          <span>Price</span>
          <span className="text-right">Size</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
            {emptyLabel}
          </div>
        ) : (
          <ul className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {rows.map((row) => (
              <li
                key={`${title}-${row.price}`}
                className="grid grid-cols-2 gap-2 bg-white/80 px-3 py-2 font-mono text-xs text-neutral-900 dark:bg-neutral-950/50 dark:text-neutral-100"
              >
                <span className="tabular-nums">{row.price}</span>
                <span className="text-right tabular-nums text-neutral-600 dark:text-neutral-300">
                  {row.size}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function SortedSide() {
  const socketRef = useRef<ReconnectingSocket | null>(null);
  const bidSideRef = useRef(new Side("bid"));
  const askSideRef = useRef(new Side("ask"));

  const [status, setStatus] = useState<Status>("closed");
  const [attemptInfo, setAttemptInfo] = useState<{
    delayMs: number;
    n: number;
  } | null>(null);
  const [snapshotMeta, setSnapshotMeta] = useState<LiveSnapshotMeta | null>(
    null,
  );
  const [form, setForm] = useState({
    direction: "bid" as Direction,
    price: "2340.2",
    size: "10",
  });
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<BookView>(EMPTY_VIEW);

  const refreshView = (lastAction: string) => {
    setView(buildBookView(bidSideRef.current, askSideRef.current, lastAction));
    setError(null);
  };

  useEffect(() => {
    const socket = new ReconnectingSocket("wss://api.hyperliquid.xyz/ws");
    socketRef.current = socket;

    const offStatus = socket.on("status", (nextStatus) => {
      setStatus(nextStatus);
      if (nextStatus === "open") setAttemptInfo(null);
    });
    const offAttempt = socket.on("attempt", (n, delayMs) => {
      setAttemptInfo({ n, delayMs });
    });
    const offMessage = socket.on("message", (message) => {
      const payload = message as { channel?: string; data?: unknown };
      if (payload.channel !== "l2Book" || payload.data == null) return;

      const parsed = parseL2BookPayload(payload.data);
      if (!parsed) return;

      applyLiveSnapshot(bidSideRef.current, askSideRef.current, parsed);
      setSnapshotMeta({
        askCount: parsed.askCount,
        bidCount: parsed.bidCount,
        coin: parsed.coin,
        receivedAt: Date.now(),
      });
      refreshView(
        `Applied live ${parsed.coin} snapshot (${parsed.bidCount} bids / ${parsed.askCount} asks).`,
      );
    });

    socket.connect();
    socket.subscribe({
      method: "subscribe",
      subscription: { type: "l2Book", coin: "ETH" },
    });

    return () => {
      offStatus();
      offAttempt();
      offMessage();
      socket.close();
    };
  }, []);

  const handleSeed = () => {
    sampleBook(bidSideRef.current, askSideRef.current);
    setSnapshotMeta(null);
    refreshView("Seeded both sides with sample levels around the mid price.");
  };

  const handleClear = () => {
    bidSideRef.current.clear();
    askSideRef.current.clear();
    setSnapshotMeta(null);
    refreshView("Cleared both sides.");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const side =
        form.direction === "bid" ? bidSideRef.current : askSideRef.current;
      const size = new Decimal(form.size);

      if (size.isNegative()) {
        setError("Size must be zero or greater.");
        return;
      }

      side.upsert(form.price, form.size);
      setSnapshotMeta(null);
      refreshView(
        size.isZero()
          ? `Removed ${form.direction} level at ${form.price}.`
          : `Upserted ${form.direction} ${form.price} -> ${form.size}.`,
      );
    } catch {
      setError("Enter valid decimal price and size values.");
    }
  };

  return (
    <article className="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/40 dark:shadow-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            RBTree-backed live order book side
          </h2>
          <p className="max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
            Live Hyperliquid{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 text-[13px] dark:bg-neutral-800">
              l2Book
            </code>{" "}
            snapshots are reapplied into the{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 text-[13px] dark:bg-neutral-800">
              Side
            </code>{" "}
            trees, so bids stay highest-first and asks stay lowest-first. Disconnect
            if you want to experiment with manual updates without live snapshots
            replacing them.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span
            className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium font-mono uppercase tracking-wide ${STATUS_COLOR[status]}`}
          >
            {status}
          </span>
          <div className="rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-right dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
              Spread
            </p>
            <p className="font-mono text-sm text-neutral-900 dark:text-neutral-100">
              {view.spread ?? "--"}
            </p>
          </div>
        </div>
      </div>

      {attemptInfo && status === "reconnecting" && (
        <p
          className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-mono text-orange-950 dark:text-orange-200"
          role="status"
        >
          Reconnect attempt #{attemptInfo.n} — retrying in{" "}
          {(attemptInfo.delayMs / 1000).toFixed(1)}s
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={status === "closed"}
          onClick={() => socketRef.current?.close()}
          className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
        >
          Disconnect
        </button>
        <button
          type="button"
          disabled={
            status === "open" ||
            status === "connecting" ||
            status === "reconnecting"
          }
          onClick={() => socketRef.current?.connect()}
          className="inline-flex items-center justify-center rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-500/15 disabled:pointer-events-none disabled:opacity-40 dark:text-emerald-100 dark:hover:bg-emerald-500/20"
        >
          Reconnect
        </button>
        <button
          type="button"
          disabled={status !== "open"}
          onClick={() => socketRef.current?.simulateDrop()}
          className="inline-flex items-center justify-center rounded-lg border border-orange-500/40 bg-orange-500/10 px-3 py-2 text-sm font-medium text-orange-950 shadow-sm transition hover:bg-orange-500/15 disabled:pointer-events-none disabled:opacity-40 dark:text-orange-100 dark:hover:bg-orange-500/20"
        >
          Simulate drop
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-neutral-200 bg-white/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
            Best Bid
          </p>
          <p className="mt-1 font-mono text-sm text-emerald-700 dark:text-emerald-400">
            {view.bestBid ? `${view.bestBid.price} x ${view.bestBid.size}` : "--"}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
            Best Ask
          </p>
          <p className="mt-1 font-mono text-sm text-red-700 dark:text-red-400">
            {view.bestAsk ? `${view.bestAsk.price} x ${view.bestAsk.size}` : "--"}
          </p>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-white/70 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
            Live Snapshot
          </p>
          <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">
            {snapshotMeta
              ? `${snapshotMeta.coin} · ${snapshotMeta.bidCount} bids / ${snapshotMeta.askCount} asks`
              : "No live snapshot applied yet."}
          </p>
          {snapshotMeta && (
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Updated {new Date(snapshotMeta.receivedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white/60 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300">
        {view.lastAction}
      </div>

      <div className="mt-6 rounded-lg border border-neutral-200 bg-white/80 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSeed}
            className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Seed sample book
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-950 shadow-sm transition hover:bg-red-500/15 dark:text-red-100 dark:hover:bg-red-500/20"
          >
            Clear book
          </button>
        </div>

        <form
          className="grid gap-3 md:grid-cols-[140px_1fr_1fr_auto]"
          onSubmit={handleSubmit}
        >
          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Side
            </span>
            <select
              value={form.direction}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  direction: event.target.value as Direction,
                }))
              }
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none ring-0 dark:border-neutral-700 dark:bg-neutral-950"
            >
              <option value="bid">Bid</option>
              <option value="ask">Ask</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Price
            </span>
            <input
              value={form.price}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  price: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-mono outline-none ring-0 dark:border-neutral-700 dark:bg-neutral-950"
              inputMode="decimal"
              placeholder="2340.2"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Size
            </span>
            <input
              value={form.size}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  size: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-mono outline-none ring-0 dark:border-neutral-700 dark:bg-neutral-950"
              inputMode="decimal"
              placeholder="10"
            />
          </label>

          <button
            type="submit"
            className="mt-auto inline-flex items-center justify-center rounded-lg border border-emerald-600/40 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-950 shadow-sm transition hover:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/20"
          >
            Apply update
          </button>
        </form>

        <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
          Live snapshots overwrite local edits while connected. Set size to{" "}
          <code className="rounded bg-neutral-200 px-1 py-0.5 dark:bg-neutral-800">
            0
          </code>{" "}
          to remove a level at that price.
        </p>
        {error && (
          <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-900 dark:text-red-200">
            {error}
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-6 md:flex-row">
        <LevelTable
          emptyLabel="No bid levels yet."
          rows={view.bids}
          title="Bids"
          tone="bid"
        />
        <LevelTable
          emptyLabel="No ask levels yet."
          rows={view.asks}
          title="Asks"
          tone="ask"
        />
      </div>
    </article>
  );
}
