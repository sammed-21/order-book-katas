import { Side } from "../04-sorted-side/side";

export type Delta = {
  side: "bid" | "ask";
  price: string;
  size: string;
};

export type Book = {
  bids: Side;
  asks: Side;
};

export function emptyBook(): Book {
  return {
    bids: new Side("bid"),
    asks: new Side("ask"),
  };
}

function cloneSide(source: Side, direction: "bid" | "ask"): Side {
  const copy = new Side(direction);
  for (const level of source.toArray()) {
    copy.upsert(level.price.toFixed(), level.size.toFixed());
  }
  return copy;
}

export function applyDelta(book: Book, delta: Delta): Book {
  const bids = cloneSide(book.bids, "bid");
  const asks = cloneSide(book.asks, "ask");
  const side = delta.side === "bid" ? bids : asks;
  side.upsert(delta.price, delta.size);
  return { bids, asks };
}

export function applyDeltas(book: Book, deltas: Delta[]): Book {
  let next = book;
  for (const delta of deltas) {
    next = applyDelta(next, delta);
  }
  return next;
}

export function getSpread(book: Book): string | null {
  const bestBid = book.bids.best();
  const bestAsk = book.asks.best();
  if (!bestBid || !bestAsk) return null;
  return bestAsk.price.minus(bestBid.price).toFixed();
}
