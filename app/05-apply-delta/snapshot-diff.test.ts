import { describe, it, expect } from "vitest";
import { diffSnapshot, snapshotFromLevels } from "./snapshot-diff";

describe("snapshotFromLevels", () => {
  it("builds price→size maps from L2 rows", () => {
    const snap = snapshotFromLevels(
      [{ px: "100", sz: "2" }],
      [{ px: "101", sz: "1" }],
    );

    expect(snap.bids.get("100")).toBe("2");
    expect(snap.asks.get("101")).toBe("1");
  });
});

describe("diffSnapshot", () => {
  it("treats null prev as empty book — all levels become deltas", () => {
    const next = snapshotFromLevels([{ px: "100", sz: "1" }], []);
    expect(diffSnapshot(null, next)).toEqual([
      { side: "bid", price: "100", size: "1" },
    ]);
  });

  it("detects new and changed levels", () => {
    const prev = snapshotFromLevels(
      [{ px: "100", sz: "2" }],
      [{ px: "101", sz: "1" }],
    );
    const next = snapshotFromLevels(
      [{ px: "100", sz: "5" }, { px: "99", sz: "1" }],
      [{ px: "101", sz: "1" }],
    );

    const deltas = diffSnapshot(prev, next);

    expect(deltas).toContainEqual({
      side: "bid",
      price: "100",
      size: "5",
    });
    expect(deltas).toContainEqual({
      side: "bid",
      price: "99",
      size: "1",
    });
    expect(deltas.filter((d) => d.side === "ask")).toHaveLength(0);
  });

  it("emits size 0 for removed levels", () => {
    const prev = snapshotFromLevels(
      [{ px: "100", sz: "2" }, { px: "99", sz: "1" }],
      [],
    );
    const next = snapshotFromLevels([{ px: "100", sz: "2" }], []);

    const deltas = diffSnapshot(prev, next);

    expect(deltas).toContainEqual({
      side: "bid",
      price: "99",
      size: "0",
    });
  });
});
