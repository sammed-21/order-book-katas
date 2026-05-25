# Kata 7 — type `RafBatcherDemo.tsx` step by step

`libs/raf-batcher.ts` is already built. Your job is to wire it in the demo.

Open `/07-raf-batcher` after each step and test.

---

## Mental model (read once)

```
WS message arrives (fast)
  → bookRef.current = new book     ← always, immediately
  → batcher.schedule()             ← "paint later", not setBook()

Next animation frame (~16ms)
  → pushToReact()
  → setBook(bookRef.current)       ← React renders once
```

---

## STEP 1 — Two homes (already in skeleton)

```typescript
const bookRef = useRef<Book>(emptyBook());
const [book, setBook] = useState<Book>(() => emptyBook());
```

| Where | Role |
|-------|------|
| `bookRef` | Truth. Updated on every WS message. |
| `book` state | Picture for React. Updated only in `pushToReact`. |

**Why:** WS is faster than the screen. Ref never lags; React catches up on rAF.

---

## STEP 2 — `pushToReact` (the flush)

Replace the empty `pushToReact` with:

```typescript
const pushToReact = useCallback(() => {
  setBook(bookRef.current);
  setRenderCount((n) => n + 1);
}, []);
```

**Why:** This is the *only* function allowed to call `setBook`.  
`renderCount` proves how often React actually painted.

---

## STEP 3 — Create batcher + cleanup

Replace the empty `useEffect` with:

```typescript
const batcherRef = useRef(createRafBatcher(pushToReact));

useEffect(() => {
  batcherRef.current = createRafBatcher(pushToReact);
  return () => batcherRef.current.cancel();
}, [pushToReact]);
```

**Why:**

- `createRafBatcher(flush)` — flush runs on next `requestAnimationFrame`
- `schedule()` many times in one frame → flush runs **once**
- `cancel()` on unmount — no `setState` on dead component

Read `libs/raf-batcher.ts` — only ~20 lines. Understand `if (rafId !== null) return`.

---

## STEP 4 — `requestRender` (the toggle)

Replace empty `requestRender` with:

```typescript
const requestRender = useCallback(() => {
  if (batchedRef.current) {
    batcherRef.current.schedule();
  } else {
    pushToReact();
  }
}, [pushToReact]);
```

**Why:**

- **ON** → coalesce to 60fps (production)
- **OFF** → kata 5 behavior, 1 render per message (for comparison)

`batchedRef` mirrors `batched` state so WS handler always sees latest toggle without re-subscribing.

---

## STEP 5 — WebSocket handler (the important change)

Inside `offMessage`, replace the `void deltas` placeholders with:

```typescript
const nextSnap = snapshotFromLevels(parsed.bids, parsed.asks);
const deltas = diffSnapshot(prevSnapshotRef.current, nextSnap);

bookRef.current = applyDeltas(bookRef.current, deltas);
prevSnapshotRef.current = nextSnap;

requestRender(); // ← never setBook() here
```

In cleanup, add:

```typescript
batcherRef.current.cancel();
```

**Compare to kata 5 (wrong for high frequency):**

```typescript
// kata 5 — paints every message
setBook(nextBook);

// kata 7 — paints once per frame
bookRef.current = nextBook;
requestRender();
```

---

## STEP 6 — `simulateFlood`

Replace the loop body with:

```typescript
function simulateFlood(count: number) {
  for (let i = 0; i < count; i++) {
    const price = (2340 + (i % 5) * 0.1).toFixed(1);
    bookRef.current = applyDelta(bookRef.current, {
      side: "bid",
      price,
      size: "1",
    });
    requestRender();
  }
  setWsMessages((n) => n + count);
}
```

**Test:**

1. Batching **OFF** → Flood 200 → `renderCount` ≈ 200
2. Batching **ON** → Flood 200 → `renderCount` +1 or +2
3. Book still looks correct both times

---

## Checklist — you understand it when:

- [ ] You can explain why `bookRef` updates before `setBook`
- [ ] You can explain what `schedule()` does if called 50 times in 2ms
- [ ] You can explain why `cancel()` is on unmount
- [ ] Flood 200 with batching ON gives ~1 render, OFF gives ~200

---

## Full solution (only if stuck)

<details>
<summary>Click to expand</summary>

```typescript
const pushToReact = useCallback(() => {
  setBook(bookRef.current);
  setRenderCount((n) => n + 1);
}, []);

const batcherRef = useRef(createRafBatcher(pushToReact));

useEffect(() => {
  batcherRef.current = createRafBatcher(pushToReact);
  return () => batcherRef.current.cancel();
}, [pushToReact]);

const requestRender = useCallback(() => {
  if (batchedRef.current) {
    batcherRef.current.schedule();
  } else {
    pushToReact();
  }
}, [pushToReact]);

// in offMessage:
bookRef.current = applyDeltas(bookRef.current, deltas);
prevSnapshotRef.current = nextSnap;
requestRender();

// simulateFlood loop:
bookRef.current = applyDelta(bookRef.current, {
  side: "bid",
  price,
  size: "1",
});
requestRender();
```

</details>
