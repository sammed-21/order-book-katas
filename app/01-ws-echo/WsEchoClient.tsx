"use client";

import { useEffect, useState } from "react";

type HlTrade = {
  coin: string;
  side: "A" | "B";
  px: string;
  sz: string;
  tid: number;
  time: number;
};
export const WsEchoClient = () => {
  const [messages, setMessages] = useState<HlTrade[]>([]);
  const [status, setStatus] = useState<
    "connecting" | "open" | "closed" | "error"
  >("connecting");

  useEffect(() => {
    const socket = new WebSocket("wss://api.hyperliquid.xyz/ws");

    socket.onopen = () => {
      console.log("connected to the hyperliquid websocket");
      setStatus("open");
      socket.send(
        JSON.stringify({
          method: "subscribe",
          subscription: {
            type: "trades",
            coin: "ETH",
          },
        }),
      );
    };
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.channel !== "trades") return;

      console.log(data.data);
      setMessages((prev) => [...prev, ...data.data].slice(-20));
    };
    socket.onerror = (event) => {
      setStatus("error");
      console.error("Error connecting to the hyperliquid websocket", event);
    };
    socket.onclose = () => {
      setStatus("closed");
      console.log("WebSocket disconnected");
    };

    return () => {
      socket.close();
    };
  }, []);

  const statusColor = {
    connecting: "bg-yellow-500/20 text-yellow-300",
    open: "bg-green-500/20 text-green-300",
    closed: "bg-zinc-500/20 text-zinc-300",
    error: "bg-red-500/20 text-red-300",
  }[status];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Hyperliquid Trade Stream</h2>
      <span
        className={`inline-block rounded px-2 py-0.5 text-xs font-mono ${statusColor}`}
      >
        {status}
      </span>
      <div className="space-y-2">
        {messages.map((msg: HlTrade) => (
          <pre
            key={msg.tid}
            className="bg-black text-green-400 p-2 rounded text-xs overflow-auto"
          >
            {JSON.stringify(msg, null, 2)}
          </pre>
        ))}
      </div>
    </div>
  );
};
