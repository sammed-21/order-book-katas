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

  it("calls flush once on the next animation frame", () => {
    const flush = vi.fn();
    const batcher = createRafBatcher(flush);

    batcher.schedule();
    expect(flush).not.toHaveBeenCalled();

    flushFrame();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("coalesces multiple schedule() calls into one flush per frame", () => {
    const flush = vi.fn();
    const batcher = createRafBatcher(flush);

    batcher.schedule();
    batcher.schedule();
    batcher.schedule();

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    flushFrame();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it("allows a new schedule after the frame flushes", () => {
    const flush = vi.fn();
    const batcher = createRafBatcher(flush);

    batcher.schedule();
    flushFrame();
    batcher.schedule();
    flushFrame();

    expect(flush).toHaveBeenCalledTimes(2);
  });

  it("cancel() prevents the pending flush", () => {
    const flush = vi.fn();
    const batcher = createRafBatcher(flush);

    batcher.schedule();
    batcher.cancel();
    flushFrame();

    expect(flush).not.toHaveBeenCalled();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
  });
});
