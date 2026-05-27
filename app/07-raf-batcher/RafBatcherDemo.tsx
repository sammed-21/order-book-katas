"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

/** Unbatched flood paints per delta; above this only batching is safe in dev. */
const FLOOD_UNBATCHED_MAX = 500;
/** In-place upserts per animation frame for large synthetic floods. */
const FLOOD_CHUNK = 2_000;

type DisplayRow = { price: string; size: string };
type ParsedL2 = NonNullable<ReturnType<typeof parseL2Book>>;

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

export function RafBatcherDemo() {
  const socketRef = useRef<ReconnectingSocket | null>(null);
  const bookRef = useRef<Book>(emptyBook());
  const prevSnapshotRef = useRef<SnapshotMaps | null>(null);
  const batchedRef = useRef(true);
  const floodRafRef = useRef<number | null>(null);

  const wsMessagesRef = useRef(0);
  const pendingWsBurstRef = useRef(0);

  const [batched, setBatched] = useState(true);
  const [book, setBook] = useState<Book>(() => emptyBook());
  const [wsMessages, setWsMessages] = useState(0);
  const [renderCount, setRenderCount] = useState(0);
  const [status, setStatus] = useState<Status>("closed");
  const [lastBurst, setLastBurst] = useState(0);

  useEffect(() => {
    batchedRef.current = batched;
  }, [batched]);

  const pushToReact = useCallback(() => {
    setBook(bookRef.current);
    setWsMessages(wsMessagesRef.current);
    setRenderCount((n) => n + 1);
    if (pendingWsBurstRef.current > 0) {
      setLastBurst(pendingWsBurstRef.current);
      pendingWsBurstRef.current = 0;
    }
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
    socketRef.current = socket;

    let pendingL2: ParsedL2 | null = null;
    let msgsInBookFrame = 0;
    let bookRafId: number | null = null;

    const scheduleBookFrame = () => {
      if (bookRafId !== null) return;
      bookRafId = requestAnimationFrame(() => {
        bookRafId = null;
        const parsed = pendingL2;
        const burst = msgsInBookFrame;
        pendingL2 = null;
        msgsInBookFrame = 0;
        if (!parsed) return;

        const nextSnap = snapshotFromLevels(parsed.bids, parsed.asks);
        const deltas = diffSnapshot(prevSnapshotRef.current, nextSnap);
        bookRef.current = applyDeltas(bookRef.current, deltas);
        prevSnapshotRef.current = nextSnap;
        pendingWsBurstRef.current = burst;
        requestRender();
      });
    };

    const offStatus = socket.on("status", (st) => {
      setStatus(st);
      if (st === "closed") {
        const fresh = emptyBook();
        bookRef.current = fresh;
        prevSnapshotRef.current = null;
        wsMessagesRef.current = 0;
        pushToReact();
      }
    });

    const offMessage = socket.on("message", (data) => {
      const msg = data as { channel?: string; data?: unknown };
      if (msg.channel !== "l2Book" || msg.data == null) return;

      const parsed = parseL2Book(msg.data);
      if (!parsed) return;

      wsMessagesRef.current += 1;
      msgsInBookFrame += 1;
      pendingL2 = parsed;
      scheduleBookFrame();
    });

    socket.connect();
    socket.subscribe({
      method: "subscribe",
      subscription: { type: "l2Book", coin: "ETH", nLevels: 20 },
    });

    return () => {
      offStatus();
      offMessage();
      if (bookRafId !== null) cancelAnimationFrame(bookRafId);
      batcherRef.current?.cancel();
      socket.close();
    };
  }, [requestRender, pushToReact]);

  useEffect(() => {
    return () => {
      if (floodRafRef.current !== null) {
        cancelAnimationFrame(floodRafRef.current);
      }
    };
  }, []);

  const simulateFlood = useCallback(
    (count: number) => {
      if (floodRafRef.current !== null) {
        cancelAnimationFrame(floodRafRef.current);
        floodRafRef.current = null;
      }

      const paintEach = !batchedRef.current && count <= FLOOD_UNBATCHED_MAX;
      const { bids, asks } = bookRef.current;

      if (paintEach) {
        for (let i = 0; i < count; i++) {
          const price = (2340 + (i % 5) * 0.1).toFixed(1);
          bids.upsert(price, String(1 + (i % 3)));
          bookRef.current = { bids, asks };
          pushToReact();
        }
        wsMessagesRef.current += count;
        pendingWsBurstRef.current = count;
        return;
      }

      let index = 0;

      const finish = () => {
        floodRafRef.current = null;
        bookRef.current = { bids, asks };
        wsMessagesRef.current += count;
        pendingWsBurstRef.current = count;
        requestRender();
      };

      const step = () => {
        const end = Math.min(index + FLOOD_CHUNK, count);
        for (; index < end; index++) {
          const price = (2340 + (index % 5) * 0.1).toFixed(1);
          bids.upsert(price, String(1 + (index % 3)));
        }
        if (index < count) {
          floodRafRef.current = requestAnimationFrame(step);
        } else {
          finish();
        }
      };

      step();
    },
    [pushToReact, requestRender],
  );

  const spread = useMemo(() => getSpread(book), [book]);
  const bidRows = useMemo(() => toRows(book, "bid"), [book]);
  const askRows = useMemo(() => toRows(book, "ask"), [book]);
  const coalesceRatio =
    renderCount > 0 ? (wsMessages / renderCount).toFixed(1) : "—";

  return (
    <article className="w-full rounded-xl border border-neutral-200 bg-neutral-50/80 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-950/40">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium font-mono uppercase ${STATUS_COLOR[status]}`}
        >
          {status}
        </span>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900/60">
          <input
            type="checkbox"
            checked={batched}
            onChange={(e) => setBatched(e.target.checked)}
            className="rounded"
          />
          rAF batching <strong>{batched ? "ON" : "OFF"}</strong>
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="WS messages" value={String(wsMessages)} />
        <StatCard
          label="React renders"
          value={String(renderCount)}
          hint="should stay low when batched"
          accent="orange"
        />
        <StatCard
          label="Msgs / render"
          value={coalesceRatio}
          hint="higher = more coalescing"
          accent="emerald"
        />
        <StatCard label="Last burst" value={String(lastBurst)} />
      </div>

      <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
        Live L2 and large floods are coalesced to one book apply per animation
        frame, then one React paint when batching is on. Counters use refs;{" "}
        <code className="rounded bg-black/10 px-1 text-xs">setState</code> runs
        in <code className="rounded bg-black/10 px-1 text-xs">pushToReact</code>{" "}
        only.
      </p>

      <p className="mt-3 font-mono text-sm text-neutral-600 dark:text-neutral-400">
        Spread: {spread ?? "—"} · bids {book.bids.toArray().length} · asks{" "}
        {book.asks.toArray().length}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <SidePanel
          title="Bids"
          tone="bid"
          rows={bidRows}
          emptyLabel={
            status === "open"
              ? "Waiting for book…"
              : "Flood or wait for live data"
          }
        />
        <SidePanel
          title="Asks"
          tone="ask"
          rows={askRows}
          emptyLabel={
            status === "open"
              ? "Waiting for book…"
              : "Flood or wait for live data"
          }
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!batched}
          title={
            batched
              ? undefined
              : "Turn rAF batching ON — unbatched 10k paints crash dev tooling"
          }
          onClick={() => simulateFlood(10_000)}
          className="rounded-lg border border-violet-600/50 bg-violet-600/15 px-4 py-2 text-sm font-semibold text-violet-950 disabled:opacity-40 dark:text-violet-100"
        >
          Flood 10,000 (1 render)
        </button>
        <button
          type="button"
          onClick={() => simulateFlood(200)}
          className="rounded-lg border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-950 dark:text-violet-100"
        >
          Flood 200 updates
        </button>
        <button
          type="button"
          onClick={() => simulateFlood(50)}
          className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900"
        >
          Flood 50
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

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "orange" | "emerald";
}) {
  const valueClass =
    accent === "orange"
      ? "text-orange-600 dark:text-orange-400"
      : accent === "emerald"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-neutral-900 dark:text-neutral-100";

  return (
    <div className="rounded-lg border border-neutral-200 bg-white/80 p-3 dark:border-neutral-800 dark:bg-neutral-900/50">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          {hint}
        </p>
      )}
    </div>
  );
}

function SidePanel({
  title,
  tone,
  rows,
  emptyLabel,
}: {
  title: string;
  tone: "bid" | "ask";
  rows: DisplayRow[];
  emptyLabel: string;
}) {
  const accent =
    tone === "bid"
      ? "text-emerald-700 dark:text-emerald-400"
      : "text-red-700 dark:text-red-400";

  return (
    <div>
      <h3
        className={`mb-2 text-xs font-semibold uppercase tracking-[0.15em] ${accent}`}
      >
        {title}
      </h3>
      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="grid grid-cols-2 gap-2 border-b border-neutral-200 bg-neutral-100/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/80">
          <span>Price</span>
          <span className="text-right">Size</span>
        </div>
        {rows.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-neutral-500">
            {emptyLabel}
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
            {rows.map((row) => (
              <li
                key={`${title}-${row.price}`}
                className="grid grid-cols-2 gap-2 px-3 py-1.5 font-mono text-xs"
              >
                <span className="tabular-nums">{row.price}</span>
                <span className="text-right tabular-nums text-neutral-500">
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
