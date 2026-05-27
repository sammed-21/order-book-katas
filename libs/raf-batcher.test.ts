import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRafBatcher } from "./raf-batcher";

describe("createRafBatcher", () => {
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    rafCallback = null;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        rafCallback = cb;
        return 42;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn(() => {
      rafCallback = null;
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function flushFrame(time = 0): void {
    rafCallback?.(time);
    rafCallback = null;
  }

  it("coalesces 10,000 schedule() calls into one flush per frame", () => {
    const flush = vi.fn();
    const batcher = createRafBatcher(flush);

    for (let i = 0; i < 10_000; i++) {
      batcher.schedule();
    }

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    flushFrame();
    expect(flush).toHaveBeenCalledTimes(1);
  });
});
