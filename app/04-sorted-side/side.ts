import { RBTree } from "bintrees";
import Decimal from "decimal.js";

export type Direction = "bid" | "ask";

export type Level = {
  price: Decimal;
  size: Decimal;
};

function compareLevels(direction: Direction, a: Level, b: Level): number {
  if (a.price.eq(b.price)) return 0;

  if (direction === "bid") {
    return a.price.gt(b.price) ? -1 : 1;
  }

  return a.price.lt(b.price) ? -1 : 1;
}

function toDecimal(value: Decimal | string): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export class Side {
  private tree: RBTree<Level>;

  constructor(private direction: Direction) {
    this.tree = this.createTree();
  }

  upsert(price: Decimal | string, size: Decimal | string): void {
    const nextLevel = {
      price: toDecimal(price),
      size: toDecimal(size),
    };

    this.remove(nextLevel.price);
    if (!nextLevel.size.isZero()) {
      this.tree.insert(nextLevel);
    }
  }

  remove(price: Decimal | string): void {
    this.tree.remove({
      price: toDecimal(price),
      size: new Decimal(0),
    });
  }

  clear(): void {
    this.tree = this.createTree();
  }

  best(): Level | null {
    return this.tree.min() ?? null;
  }

  toArray(limit?: number): Level[] {
    const rows: Level[] = [];

    this.tree.each((level) => {
      if (limit == null || rows.length < limit) {
        rows.push(level);
      }
    });

    return rows;
  }

  private createTree(): RBTree<Level> {
    return new RBTree<Level>((a, b) => compareLevels(this.direction, a, b));
  }
}
