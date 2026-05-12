"use client";

import { useEffect, useRef, useState } from "react";
import { ReconnectingSocket, type Status } from "./socket";
import {
  type TrackerStats,
  type Anomaly,
  L2BookTracker,
} from "./l2book-tracker";

/** One price level in Hyperliquid `l2Book` messages. */
type L2Level = {
  px: string;
  sz: string;
  n: number;
};

type BookSnapshot = {
  coin: string;
  bids: L2Level[];
  asks: L2Level[];
  receivedAt: number;
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
): Omit<BookSnapshot, "receivedAt"> | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const levels = d.levels;
  if (!Array.isArray(levels) || levels.length < 2) return null;
  const rawBids = levels[0];
  const rawAsks = levels[1];
  if (!Array.isArray(rawBids) || !Array.isArray(rawAsks)) return null;
  const bids = rawBids.filter(isL2Level);
  const asks = rawAsks.filter(isL2Level);
  const coin = typeof d.coin === "string" ? d.coin : "?";
  if (bids.length === 0 && asks.length === 0) return null;
  return { coin, bids, asks };
}

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

function LevelTable({
  title,
  side,
  rows,
}: {
  title: string;
  side: "bid" | "ask";
  rows: L2Level[];
}) {
  const accent =
    side === "bid"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-red-700 dark:text-red-400";

  return (
    <div className="min-w-0 flex-1">
      <h4
        className={`mb-2 text-xs font-semibold uppercase tracking-[0.15em] ${accent}`}
      >
        {title}
      </h4>
      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-neutral-200 bg-neutral-100/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80 dark:text-neutral-400">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right font-mono normal-case">n</span>
        </div>
        <ul className="max-h-[min(50vh,22rem)] overflow-y-auto">
          {rows.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-neutral-500">
              No levels
            </li>
          ) : (
            rows.map((row) => (
              <li
                key={`${side}-${row.px}`}
                className="grid grid-cols-[1fr_1fr_auto] gap-2 border-b border-neutral-100 px-3 py-1.5 font-mono text-xs last:border-b-0 dark:border-neutral-900/80"
              >
                <span className="tabular-nums text-neutral-900 dark:text-neutral-100">
                  {row.px}
                </span>
                <span className="text-right tabular-nums text-neutral-700 dark:text-neutral-300">
                  {row.sz}
                </span>
                <span className="text-right tabular-nums text-neutral-500">
                  {row.n}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

const EMPTY_STATS: TrackerStats = {
  processed: 0,
  regressions: 0,
  longGaps: 0,
  lastTime: null,
};

export const SeqGap = () => {
  const socketRef = useRef<ReconnectingSocket | null>(null);
  const [status, setStatus] = useState<Status>("closed");
  const trackerRef = useRef(new L2BookTracker());
  const [stats, setStats] = useState<TrackerStats>(EMPTY_STATS);
  const [attemptInfo, setAttemptInfo] = useState<{
    n: number;
    delayMs: number;
  } | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [snapshot, setSnapshot] = useState<BookSnapshot | null>(null);

  useEffect(() => {
    const s = new ReconnectingSocket("wss://api.hyperliquid.xyz/ws");
    socketRef.current = s;

    const offStatus = s.on("status", (st) => {
      setStatus(st);
      if (st === "open") setAttemptInfo(null);
      if (st !== "open") trackerRef.current.resetStream();
    });
    const offAttempt = s.on("attempt", (n, delayMs) => {
      setAttemptInfo({ n, delayMs });
    });
    const offMessage = s.on("message", (data) => {
      const msg = data as { channel?: string; data?: unknown };
      if (msg.channel !== "l2Book" || msg.data == null) return;

      const raw = msg.data;
      if (typeof (raw as { time?: unknown }).time !== "number") return;
      const msgTime = (raw as { time: number }).time;

      const anomaly = trackerRef.current.observe(msgTime);
      setStats(trackerRef.current.getStats());
      if (anomaly) setAnomalies(trackerRef.current.recentAnomalies());

      const parsed = parseL2BookPayload(msg.data);
      if (!parsed) return;
      setSnapshot({ ...parsed, receivedAt: Date.now() });
    });

    s.connect();
    s.subscribe({
      method: "subscribe",
      subscription: { type: "l2Book", coin: "ETH" },
    });

    return () => {
      offStatus();
      offAttempt();
      offMessage();
      s.close();
    };
  }, []);

  return (
    <article className="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/40 dark:shadow-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Hyperliquid ETH · L2 book
          </h2>
          <p className="max-w-xl text-sm text-neutral-600 dark:text-neutral-400">
            Each message replaces the top-N levels snapshot (default 20 per
            side, configurable via{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 text-[13px] dark:bg-neutral-800">
              nLevels
            </code>
            ) — not the full book.{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 text-[13px] dark:bg-neutral-800">
              data.levels[0]
            </code>{" "}
            is bids,{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 text-[13px] dark:bg-neutral-800">
              levels[1]
            </code>{" "}
            is asks; each row is{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 text-[13px] dark:bg-neutral-800">
              {"{ px, sz, n }"}
            </code>{" "}
            where{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 text-[13px] dark:bg-neutral-800">
              n
            </code>{" "}
            is the number of orders aggregated at that price (not a sequence).
            Hyperliquid does not publish a per-message seq, so the tracker uses{" "}
            <code className="rounded bg-neutral-200 px-1 py-0.5 text-[13px] dark:bg-neutral-800">
              data.time
            </code>{" "}
            monotonicity to detect anomalies after drops.
          </p>
        </div>
        <span
          className={`inline-flex w-fit shrink-0 rounded-md px-2.5 py-1 text-xs font-medium font-mono uppercase tracking-wide ${STATUS_COLOR[status]}`}
        >
          {status}
        </span>
      </div>

      {attemptInfo && status === "reconnecting" && (
        <p
          className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-950 dark:text-orange-200 font-mono"
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

      <div className="mt-4 rounded-lg border border-neutral-200 bg-white/60 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-400">
        <p className="font-mono">
          Tracker: {stats.processed} updates · {stats.regressions} time
          regressions · {stats.longGaps} long gaps
          {stats.lastTime != null && (
            <span className="text-neutral-500"> · last t={new Date(stats.lastTime).toLocaleTimeString()}</span>
          )}
        </p>
        {anomalies.length > 0 && (
          <ul className="mt-2 max-h-24 space-y-1 overflow-y-auto border-t border-neutral-200 pt-2 font-mono dark:border-neutral-800">
            {anomalies.slice(-5).map((a, i) => (
              <li key={`${a.type}-${a.at}-${i}`}>
                {a.type === "TIME_REGRESSION"
                  ? `TIME_REGRESSION cur=${a.cur} prev=${a.prev}`
                  : `LONG_GAP ${a.gapMs}ms`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400">
            Live snapshot
          </h3>
          {snapshot && (
            <span className="text-xs text-neutral-500 dark:text-neutral-500">
              {snapshot.coin} · updated{" "}
              {new Date(snapshot.receivedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {!snapshot ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white/60 px-4 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/30 dark:text-neutral-400">
            {status === "open" || status === "connecting"
              ? "Waiting for L2 book messages…"
              : "Connect the socket to see book updates."}
          </div>
        ) : (
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <LevelTable title="Bids" side="bid" rows={snapshot.bids} />
            <LevelTable title="Asks" side="ask" rows={snapshot.asks} />
          </div>
        )}
      </div>
    </article>
  );
};
