import Link from "next/link";

const routes = [
  {
    title: "WebSocket Echo",
    href: "/01-ws-echo",
    description:
      "Connects to Hyperliquid's WebSocket API and echoes recent ETH trades.",
  },
  {
    title: "Reconnect",
    href: "/02-reconnect",
    description:
      "Wraps the WebSocket with reconnect handling and a simulated drop flow.",
  },
];

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 font-sans">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          WebSocket katas
        </p>
        <h1 className="font-serif text-4xl font-semibold">Order Book</h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-300">
          A small collection of order book exercises for streaming market data,
          handling connection state, and practicing resilient WebSocket clients.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {routes.map((route) => (
          <Link
            key={route.href}
            href={route.href}
            className="rounded-2xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
          >
            <h2 className="text-lg font-semibold">{route.title}</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {route.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
