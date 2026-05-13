import { SortedSide } from "./SortedSide";

export default function Page() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Kata 04
        </p>
        <h1 className="text-3xl font-semibold">Sorted Side Data Structure</h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-300">
          Uses Hyperliquid ETH L2 snapshots to populate RBTree-backed bid and
          ask sides with decimal-safe prices. You can also disconnect and apply
          manual updates to see the sorted structure react in real time.
        </p>
      </header>
      <SortedSide />
    </section>
  );
}
