import { WsEchoClient } from "./WsEchoClient";

export default function Page() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Kata 01
        </p>
        <h1 className="text-3xl font-semibold">WebSocket Echo</h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-300">
          Opens a direct Hyperliquid WebSocket subscription and displays the
          latest ETH trade messages as they arrive.
        </p>
      </header>
      <WsEchoClient />
    </section>
  );
}
