import { describe, it, expect } from "vitest";
import { applyDelta, applyDeltas, emptyBook } from "./apply-delta";

function bestPrice(
  book: ReturnType<typeof emptyBook>,
  side: "bid" | "ask",
): string | null {
  const level = side === "bid" ? book.bids.best() : book.asks.best();
  return level?.price.toFixed() ?? null;
}

describe("applyDelta", () => {
  it("adds a bid level", () => {
    const book0 = emptyBook();
    const book1 = applyDelta(book0, { side: "bid", price: "100", size: "2" });

    expect(bestPrice(book1, "bid")).toBe("100");
    expect(bestPrice(book0, "bid")).toBeNull();
  });

  it("adds an ask level", () => {
    const book1 = applyDelta(emptyBook(), {
      side: "ask",
      price: "101",
      size: "1",
    });
    expect(bestPrice(book1, "ask")).toBe("101");
  });

  it("updates size at same price", () => {
    const book1 = applyDelta(emptyBook(), {
      side: "bid",
      price: "100",
      size: "2",
    });
    const book2 = applyDelta(book1, {
      side: "bid",
      price: "100",
      size: "5",
    });

    expect(book2.bids.best()!.size.toFixed()).toBe("5");
  });

  it("removes level when size is 0", () => {
    const book1 = applyDelta(emptyBook(), {
      side: "bid",
      price: "100",
      size: "2",
    });
    const book2 = applyDelta(book1, {
      side: "bid",
      price: "100",
      size: "0",
    });

    expect(book2.bids.best()).toBeNull();
    expect(book1.bids.best()).not.toBeNull();
  });

  it("does not mutate the previous book", () => {
    const book0 = emptyBook();
    const book1 = applyDelta(book0, { side: "bid", price: "100", size: "1" });

    expect(book0.bids.toArray()).toHaveLength(0);
    expect(book1.bids.toArray()).toHaveLength(1);
  });

  it("keeps bid and ask sides independent", () => {
    const book = applyDelta(emptyBook(), {
      side: "ask",
      price: "200",
      size: "3",
    });
    expect(book.bids.best()).toBeNull();
    expect(book.asks.best()!.price.toFixed()).toBe("200");
  });
});

describe("applyDeltas", () => {
  it("chains multiple deltas from an array", () => {
    const book = applyDeltas(emptyBook(), [
      { side: "bid", price: "100", size: "1" },
      { side: "bid", price: "101", size: "1" },
      { side: "ask", price: "102", size: "1" },
    ]);

    expect(bestPrice(book, "bid")).toBe("101");
    expect(bestPrice(book, "ask")).toBe("102");
  });
});
