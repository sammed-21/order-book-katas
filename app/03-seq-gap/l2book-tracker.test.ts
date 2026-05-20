import { describe, it, expect } from "vitest";
import { L2BookTracker } from "./l2book-tracker";

describe("L2BookTracker", () => {
  it("accepts the first message without anomaly", () => {
    const tracker = new L2BookTracker();
    expect(tracker.observe(1000)).toBeNull();
    expect(tracker.getStats().processed).toBe(1);
  });

  it("detects time regression", () => {
    const tracker = new L2BookTracker();
    tracker.observe(2000);
    const anomaly = tracker.observe(1500);

    expect(anomaly?.type).toBe("TIME_REGRESSION");
    expect(tracker.getStats().regressions).toBe(1);
  });

  it("detects long gaps over 5s", () => {
    const tracker = new L2BookTracker();
    tracker.observe(1000);
    const anomaly = tracker.observe(7000);

    expect(anomaly?.type).toBe("LONG_GAP");
    expect(tracker.getStats().longGaps).toBe(1);
  });

  it("resetStream clears lastTime but keeps stats", () => {
    const tracker = new L2BookTracker();
    tracker.observe(1000);
    tracker.resetStream();
    tracker.observe(500);

    expect(tracker.getStats().processed).toBe(2);
    expect(tracker.getStats().regressions).toBe(0);
  });
});
