import { WorkerBookDemo } from "./WorkerBookDemo";

export default function Page() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Kata 08
        </p>
        <h1 className="text-3xl font-semibold">Web Worker round-trip</h1>
        <p className="max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">
          Type along with{" "}
          <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">
            app/08-worker-rt/STEPS.md
          </code>
          . Main thread owns the socket and screen; the worker owns book math.
        </p>
      </header>
      <WorkerBookDemo />
    </section>
  );
}
