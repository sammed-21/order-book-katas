"use client";

import { useEffect, useRef, useState } from "react";

type WsStatus = "connecting" | "open" | "closed" | "error";

type HlTrade = {
  coin: string;
  side: "A" | "B";
  px: string;
  sz: string;
  tid: number;
  time: number;
};

const HL_WS = "wss://api.hyperliquid.xyz/ws";

const STATUS_COLOR: Record<WsStatus, string> = {
  connecting:
    "bg-yellow-500/15 text-yellow-900 dark:bg-yellow-500/20 dark:text-yellow-300",
  open: "bg-emerald-500/15 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300",
  closed:
    "bg-neutral-500/15 text-neutral-800 dark:bg-zinc-500/20 dark:text-zinc-300",
  error: "bg-red-500/15 text-red-900 dark:bg-red-500/20 dark:text-red-300",
};

function isTradeMessage(data: unknown): data is { channel: "trades"; data: HlTrade[] } {
  if (!data || typeof data !== "object") return false;
  const msg = data as Record<string, unknown>;
  return msg.channel === "trades" && Array.isArray(msg.data);
}

export const WsEchoClient = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WsStatus>("closed");
  const [messages, setMessages] = useState<HlTrade[]>([]);
  const [messageCount, setMessageCount] = useState(0);

  useEffect(() => {
    const ws = new WebSocket(HL_WS);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      setStatus("open");
      ws.send(
        JSON.stringify({
          method: "subscribe",
          subscription: { type: "trades", coin: "ETH" },
        }),
      );
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!isTradeMessage(data)) return;
        setMessageCount((n) => n + 1);
        setMessages((prev) => [...prev, ...data.data].slice(-20));
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => setStatus("error");

    ws.onclose = () => {
      wsRef.current = null;
      setStatus("closed");
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, []);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex rounded-md px-2.5 py-1 text-xs font-medium font-mono uppercase tracking-wide ${STATUS_COLOR[status]}`}
        >
          {status}
        </span>
        <span className="font-mono text-sm text-neutral-600 dark:text-neutral-400">
          {messageCount} trade messages received
        </span>
      </div>

      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Plain <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">WebSocket</code>{" "}
        — connect on mount, subscribe in{" "}
        <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">onopen</code>, close on
        unmount. Prices and sizes stay as strings (never{" "}
        <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">parseFloat</code>).
      </p>

      <div className="space-y-1">
        {messages.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-700">
            {status === "open" || status === "connecting"
              ? "Waiting for ETH trades…"
              : "Disconnected."}
          </p>
        ) : (
          messages.map((trade) => (
            <div
              key={trade.tid}
              className="grid grid-cols-4 gap-2 rounded bg-zinc-900 px-2 py-1 font-mono text-xs"
            >
              <span className={trade.side === "B" ? "text-green-400" : "text-red-400"}>
                {trade.side === "B" ? "BUY" : "SELL"}
              </span>
              <span>{trade.px}</span>
              <span>{trade.sz}</span>
              <span className="text-zinc-500">
                {new Date(trade.time).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
