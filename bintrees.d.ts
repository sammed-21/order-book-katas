declare module "bintrees" {
  export class RBTree<T> {
    constructor(compare: (a: T, b: T) => number);
    each(callback: (value: T) => void): void;
    insert(value: T): boolean;
    min(): T | null;
    remove(value: T): boolean;
  }
}
