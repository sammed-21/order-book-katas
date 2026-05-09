"use client";

import { useEffect, useRef, useState } from "react";
import { ReconnectingSocket, type Status } from "./reconnecting-socket";

type HlTrade = {
  coin: string;
  side: "A" | "B";
  px: string;
  sz: string;
  tid: number;
  time: number;
};

const STATUS_COLOR: Record<Status, string> = {
  connecting: "bg-yellow-500/20 text-yellow-300",
  open: "bg-green-500/20 text-green-300",
  closed: "bg-zinc-500/20 text-zinc-300",
  reconnecting: "bg-orange-500/20 text-orange-300",
  error: "bg-red-500/20 text-red-300",
};

export const Reconnect = () => {
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
    <div className="p-6 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">
          Reconnecting Socket — Hyperliquid ETH Trades
        </h1>
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-mono ${STATUS_COLOR[status]}`}
        >
          {status}
        </span>
      </div>

      {attemptInfo && status === "reconnecting" && (
        <p className="mb-4 text-sm text-orange-300 font-mono">
          Reconnect attempt #{attemptInfo.n} — retrying in{" "}
          {(attemptInfo.delayMs / 1000).toFixed(1)}s
        </p>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => socketRef.current?.close()}
          className="px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-sm"
        >
          Disconnect
        </button>
        <button
          onClick={() => socketRef.current?.simulateDrop()}
          className="px-3 py-1 rounded bg-orange-700 hover:bg-orange-600 text-sm"
        >
          Simulate Drop
        </button>
      </div>

      <div className="space-y-1">
        {messages.map((m) => (
          <div
            key={m.tid}
            className="font-mono text-xs grid grid-cols-4 gap-2 bg-zinc-900 px-2 py-1 rounded"
          >
            <span
              className={m.side === "B" ? "text-green-400" : "text-red-400"}
            >
              {m.side === "B" ? "BUY" : "SELL"}
            </span>
            <span>{m.px}</span>
            <span>{m.sz}</span>
            <span className="text-zinc-500">
              {new Date(m.time).toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
