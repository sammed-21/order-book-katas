import type { Delta } from "./apply-delta";

export type L2Level = { px: string; sz: string };

export type SnapshotMaps = {
  bids: Map<string, string>;
  asks: Map<string, string>;
};

export function levelsToMap(levels: L2Level[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const level of levels) {
    map.set(level.px, level.sz);
  }
  return map;
}

export function snapshotFromLevels(
  bids: L2Level[],
  asks: L2Level[],
): SnapshotMaps {
  return {
    bids: levelsToMap(bids),
    asks: levelsToMap(asks),
  };
}

export function diffSnapshot(
  prev: SnapshotMaps | null,
  next: SnapshotMaps,
): Delta[] {
  return [
    ...diffSide(prev?.bids ?? new Map(), next.bids, "bid"),
    ...diffSide(prev?.asks ?? new Map(), next.asks, "ask"),
  ];
}

function diffSide(
  prev: Map<string, string>,
  next: Map<string, string>,
  side: "bid" | "ask",
): Delta[] {
  const deltas: Delta[] = [];

  for (const [price, size] of next) {
    if (prev.get(price) !== size) {
      deltas.push({ side, price, size });
    }
  }

  for (const price of prev.keys()) {
    if (!next.has(price)) {
      deltas.push({ side, price, size: "0" });
    }
  }
  return deltas;
}
