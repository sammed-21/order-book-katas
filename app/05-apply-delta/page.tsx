import { ApplyDelta } from "./ApplyDelta";

export default function Page() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Kata 05
        </p>
        <h1 className="text-3xl font-semibold">Apply Delta</h1>

        <div className="max-w-2xl space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
          <p>
            Exchanges do not send the whole order book on every tick. They send{" "}
            <strong>deltas</strong>: small updates like “bid 2340.1 → size 8.4”.
            Your UI must turn each delta into the next book state.
          </p>
          <p>
            <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">
              applyDelta(book, delta)
            </code>{" "}
            is the single function that does that. It uses your Kata 4{" "}
            <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">
              Side
            </code>{" "}
            trees and returns a <strong>new</strong> book so the old one is
            never mutated — required for replay, debugging, and Kata 6 snapshot
            sync.
          </p>
          <ul className="list-inside list-disc space-y-1 text-neutral-500 dark:text-neutral-400">
            <li>
              <code>size: &quot;0&quot;</code> removes that price level
            </li>
            <li>Same price again overwrites size</li>
            <li>Bids and asks stay independent</li>
          </ul>
        </div>
      </header>

      <ApplyDelta />
    </section>
  );
}
