"use client";

import { useEffect, useRef, useState } from "react";
import {
  ReconnectingSocket,
  type Status,
} from "../02-reconnect/reconnecting-socket";

type HlTrade = {
  coin: string;
  side: "A" | "B";
  px: string;
  sz: string;
  tid: number;
  time: number;
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

export const WsEchoClient = () => {
  const socketRef = useRef<ReconnectingSocket | null>(null);
  const [status, setStatus] = useState<Status>("closed");
  const [attemptInfo, setAttemptInfo] = useState<{
    n: number;
    delayMs: number;
  } | null>(null);
  const [messages, setMessages] = useState<HlTrade[]>([]);

  useEffect(() => {
    const s = new ReconnectingSocket("wss://api.hyperliquid.xyz/ws");
    socketRef.current = s;

    const offStatus = s.on("status", (st) => {
      setStatus(st);
      if (st === "open") setAttemptInfo(null);
    });
    const offAttempt = s.on("attempt", (n, delayMs) => {
      setAttemptInfo({ n, delayMs });
    });
    const offMessage = s.on("message", (data) => {
      const msg = data as { channel?: string; data?: HlTrade[] };
      if (msg.channel !== "trades" || !msg.data) return;
      setMessages((prev) => [...prev, ...msg.data!].slice(-20));
    });

    s.connect();
    s.subscribe({
      method: "subscribe",
      subscription: { type: "trades", coin: "ETH" },
    });

    return () => {
      offStatus();
      offAttempt();
      offMessage();
      s.close();
    };
  }, []);

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">Hyperliquid Trade Stream</h2>
        <span
          className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium font-mono uppercase tracking-wide ${STATUS_COLOR[status]}`}
        >
          {status}
        </span>
      </div>

      {attemptInfo && status === "reconnecting" && (
        <p
          className="mb-4 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-950 dark:text-orange-200 font-mono"
          role="status"
        >
          Reconnect attempt #{attemptInfo.n} — retrying in{" "}
          {(attemptInfo.delayMs / 1000).toFixed(1)}s
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
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

      <div className="space-y-2">
        {messages.map((msg: HlTrade) => (
          <pre
            key={msg.tid}
            className="overflow-auto rounded bg-black p-2 text-xs text-green-400"
          >
            {JSON.stringify(msg, null, 2)}
          </pre>
        ))}
      </div>
    </div>
  );
};
