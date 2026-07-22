// Binary min-heap with a user-supplied comparator.
// Used by the scheduler as its priority queue.

export class MinHeap<T> {
  private data: T[] = [];

  constructor(private cmp: (a: T, b: T) => number) {}

  push(item: T): void {
    this.data.push(item);
    this.bubbleUp(this.data.length - 1);
  }

  pop(): T | undefined {
    if (this.data.length === 0) return undefined;
    const root = this.data[0]!;
    const last = this.data.pop()!;
    if (this.data.length > 0) {
      this.data[0] = last;
      this.bubbleDown(0);
    }
    return root;
  }

  peek(): T | undefined {
    return this.data[0];
  }

  isEmpty(): boolean {
    return this.data.length === 0;
  }

  get size(): number {
    return this.data.length;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (const item of this.data) yield item;
  }

  // ------------------------------------------------------------------
  // internals
  // ------------------------------------------------------------------
  private swap(i: number, j: number): void {
    const tmp = this.data[i]!;
    this.data[i] = this.data[j]!;
    this.data[j] = tmp;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.cmp(this.data[i]!, this.data[parent]!) < 0) {
        this.swap(i, parent);
        i = parent;
      } else {
        break;
      }
    }
  }

  private bubbleDown(i: number): void {
    const length = this.data.length;
    while (true) {
      const left = i * 2 + 1;
      const right = left + 1;
      let smallest = i;
      if (left < length && this.cmp(this.data[left]!, this.data[smallest]!) < 0) {
        smallest = left;
      }
      if (right < length && this.cmp(this.data[right]!, this.data[smallest]!) < 0) {
        smallest = right;
      }
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
  }
}
