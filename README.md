# Order Book Katas

12 small, focused projects to learn how to build a production-grade real-time
orderbook UI — the kind that powers perpetuals exchanges like Hyperliquid,
dYdX, and Aevo.

**Live demo (WIP):** _coming after Kata 12_
**Twitter thread:** _coming after Kata 3_

---

## Why this repo exists

Most React advice doesn't apply to trading UIs.

A trading surface receives **5,000–10,000 state mutations per second** over
WebSocket and must render them at 60fps without dropping frames, without
showing stale prices, without silently rounding numbers, and without locking
up when the network blips.

That's not a "React performance" problem. It's a **distributed systems UI**
problem — and the patterns are different:

- State lives **outside** React (plain class) — never inside `useState`
- Updates are **rAF-coalesced** (decouple input rate from render rate)
- The orderbook lives in a **Web Worker** (main thread stays idle)
- React subscribes via `useSyncExternalStore` (tearing-free reads)
- All prices are `decimal.js` end-to-end (never `parseFloat`)
- WebSocket has **sequence validation** + **snapshot/replay resync**
- Rows are **virtualized** + depth bars update via **CSS variables**, not React

This repo builds each of those primitives in isolation, then composes them
into a full orderbook. One kata = one concept = one working artifact.

---

## The 12 katas

| #   | Kata                                  | Concept                                             | Status      |
| --- | ------------------------------------- | --------------------------------------------------- | ----------- |
| 1   | [WebSocket echo](app/01-ws-echo)      | Connect, subscribe, lifecycle, type-narrow messages | Done        |
| 2   | [Reconnect manager](app/02-reconnect) | Exponential backoff + jitter, AbortController       | In progress |
| 3   | Sequence gap detector                 | Track `U`/`u` from depth stream, log gaps           | Planned     |
| 4   | Sorted side data structure            | RBTree + decimal-safe prices                        | Planned     |
| 5   | Pure `applyDelta` function            | Immutable book updates, fully tested                | Planned     |
| 6   | Snapshot + replay buffer              | THE algorithm of market data engineering            | Planned     |
| 7   | rAF batcher utility                   | Decouple WS rate from render rate                   | Planned     |
| 8   | Web Worker round-trip                 | Offload parsing + book to background thread         | Planned     |
| 9   | `useSyncExternalStore` counter        | External state, no React state                      | Planned     |
| 10  | Virtualized list                      | Render 10k rows with ~30 in DOM                     | Planned     |
| 11  | CSS-variable depth bar                | Update DOM without re-rendering React               | Planned     |
| 12  | Flash-on-change row                   | CSS animation triggered without `useState`          | Planned     |
| ★   | Full orderbook + trades tape          | Wiring all 12 primitives together                   | Planned     |

---

## Stack

| Layer          | Choice                          | Why                                         |
| -------------- | ------------------------------- | ------------------------------------------- |
| Framework      | Next.js 16 (App Router)         | RSC for shell, client islands for the book  |
| Language       | TypeScript (strict)             | Numeric correctness is brutal without types |
| Styling        | Tailwind CSS                    | No runtime cost, fast iteration             |
| Numbers        | `decimal.js`                    | Never `parseFloat` for prices               |
| Sorted maps    | `bintrees` (RBTree)             | O(log n) insert/delete, ordered iteration   |
| External store | React 18 `useSyncExternalStore` | Tearing-free at high update rates           |
| Virtualization | `@tanstack/react-virtual`       | Industry standard                           |
| Tests          | Vitest                          | Fast, native ESM                            |
| Data source    | Hyperliquid public WS           | Real perp DEX data, free, no auth           |

---

## Run locally

`````bash
pnpm install
pnpm dev

````md
# Real-Time Trading UI Katas

A collection of focused frontend katas for learning how modern trading interfaces work — from WebSocket streams and reconnect logic to orderbook rendering and decimal-safe market data handling.

Each kata is implemented as a separate route under `/app`.

---

## Routes

Visit:

```bash
http://localhost:3000/01-ws-echo
http://localhost:3000/02-reconnect
`````

---

# Per-Kata Reflections

## Kata 1 — WebSocket Echo

### What it does

Connects to Hyperliquid's public WebSocket, subscribes to ETH trades, and renders the latest 20 trades with a connection-status indicator.

### What I learned

- WebSocket lifecycle management:
  - `onopen`
  - `onmessage`
  - `onerror`
  - `onclose`

- React Strict Mode double-mount behavior makes cleanup logic essential. Failing to close sockets correctly can create duplicate connections and stale listeners.

- Hyperliquid sends prices and sizes as strings to preserve decimal precision.

  Never blindly parse market data into floating-point numbers.

  This was my first real lesson in decimal safety for trading systems.

- The first message after subscribing is a `subscriptionResponse`, not actual trade data.

  Always validate message type/channel before consuming stream data.

---

## Kata 2 — Reconnect Manager

Reflection added on completion.

---

# About

I'm a frontend engineer building expertise in real-time trading UIs and DeFi infrastructure.

This repository is my public learning journey while exploring:

- trading system UX
- WebSocket architecture
- realtime rendering
- exchange interfaces
- market data handling

If you're building:

- a perpetuals exchange
- DEX aggregator
- trading dashboard
- realtime DeFi infrastructure

and want to talk, my DMs are open on Twitter.

---

# License

MIT
