import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";
import { Side } from "./side";

function prices(levels: { price: Decimal }[]): string[] {
  return levels.map((l) => l.price.toFixed());
}

describe("Side — bid", () => {
  it("starts empty", () => {
    const bids = new Side("bid");
    expect(bids.best()).toBeNull();
    expect(bids.toArray()).toEqual([]);
  });

  it("inserts one level and best() returns it", () => {
    const bids = new Side("bid");
    bids.upsert("100", "2");

    const best = bids.best();
    expect(best).not.toBeNull();
    expect(best!.price.toFixed()).toBe("100");
    expect(best!.size.toFixed()).toBe("2");
  });

  it("overwrites size at the same price", () => {
    const bids = new Side("bid");
    bids.upsert("100", "2");
    bids.upsert("100", "5");

    expect(bids.best()!.size.toFixed()).toBe("5");
  });

  it("removes a level when size is zero", () => {
    const bids = new Side("bid");
    bids.upsert("100", "2");
    bids.upsert("100", "0");

    expect(bids.best()).toBeNull();
    expect(bids.toArray()).toEqual([]);
  });

  it("sorts bids highest price first", () => {
    const bids = new Side("bid");
    bids.upsert("100", "1");
    bids.upsert("101", "1");
    bids.upsert("99", "1");

    expect(prices(bids.toArray())).toEqual(["101", "100", "99"]);
  });

  it("toArray(limit) returns only N rows", () => {
    const bids = new Side("bid");
    for (let p = 90; p <= 99; p++) {
      bids.upsert(String(p), "1");
    }
    expect(bids.toArray(3)).toHaveLength(3);
    expect(prices(bids.toArray(3))).toEqual(["99", "98", "97"]);
  });

  it("clear() removes everything", () => {
    const bids = new Side("bid");
    bids.upsert("100", "1");
    bids.clear();
    expect(bids.best()).toBeNull();
  });
});

describe("Side — ask", () => {
  it("sorts asks lowest price first", () => {
    const asks = new Side("ask");
    asks.upsert("100", "1");
    asks.upsert("101", "1");
    asks.upsert("99", "1");

    expect(prices(asks.toArray())).toEqual(["99", "100", "101"]);
  });

  it("best ask is the lowest price", () => {
    const asks = new Side("ask");
    asks.upsert("100", "1");
    asks.upsert("99", "1");
    asks.upsert("101", "1");

    expect(asks.best()!.price.toFixed()).toBe("99");
  });
});

describe("Side — decimal precision", () => {
  it("treats 1.1 and 1.10000000001 as different prices", () => {
    const bids = new Side("bid");
    bids.upsert("1.1", "1");
    bids.upsert("1.10000000001", "2");

    expect(bids.toArray()).toHaveLength(2);
    const sorted = prices(bids.toArray());
    expect(sorted).toContain("1.1");
    expect(sorted).toContain("1.10000000001");
  });
});
