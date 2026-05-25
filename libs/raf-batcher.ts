/**
 * rAF batcher — coalesce many callbacks into at most one flush per animation frame (~16ms).
 *
 * Why: WebSocket can deliver hundreds/thousands of messages per second.
 * React cannot re-render that often and stay at 60fps.
 *
 * Pattern:
 *   onMessage → update book in ref (always immediate, never stale)
 *             → batcher.schedule()  (don't setState yet)
 *   on flush  → setState(bookRef.current) once per frame
 */

export type RafBatcher = {
  /** Queue a flush on the next animation frame. No-op if already queued. */
  schedule: () => void;
  /** Cancel a pending flush (e.g. on unmount). */
  cancel: () => void;
  /** Whether a flush is waiting for the next frame. */
  readonly isScheduled: boolean;
};

export function createRafBatcher(flush: () => void): RafBatcher {
  let rafId: number | null = null;

  function schedule(): void {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      flush();
    });
  }

  function cancel(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  return {
    schedule,
    cancel,
    get isScheduled() {
      return rafId !== null;
    },
  };
}
