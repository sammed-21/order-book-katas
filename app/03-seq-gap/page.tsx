import { SeqGap } from "./SeqGap";

export default function Page() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Kata 03
        </p>
        <h1 className="text-3xl font-semibold">Sequence Gap Detector</h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-300">
          Subscribes to the ETH L2 book over a reconnecting WebSocket. After a
          simulated drop, the client reconnects with backoff so you can reason
          about sequence gaps and resync strategies against a live feed.
        </p>
      </header>
      <SeqGap />
    </section>
  );
}
