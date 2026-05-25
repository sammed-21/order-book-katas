import { RafBatcherDemo } from "./RafBatcherDemo";
import { RafBatcherDemoSolution } from "./RafBatcherDemo.solution";

export default function Page() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Kata 07
        </p>
        <h1 className="text-3xl font-semibold">rAF Batcher</h1>

        <p className="max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">
          WebSocket updates the book in a ref immediately; rAF batches how often
          React repaints. Toggle batching and use Flood 200 to compare render
          counts.
        </p>
      </header>
      {/* <RafBatcherDemoSolution /> */}
      <RafBatcherDemo />
    </section>
  );
}
