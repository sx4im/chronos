import { describe, it, expect } from "vitest";
import { MinHeap } from "../src/heap.js";

describe("MinHeap", () => {
  it("pops in sorted order", () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    const values = [5, 3, 8, 1, 9, 2, 7, 4, 6, 0];
    for (const v of values) heap.push(v);
    const out: number[] = [];
    while (!heap.isEmpty()) out.push(heap.pop()!);
    expect(out).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("breaks ties in insertion (FIFO) order via a seq tiebreaker", () => {
    // Simulate the scheduler's (time, seq) ordering.
    type E = { time: number; seq: number };
    const heap = new MinHeap<E>((a, b) =>
      a.time !== b.time ? a.time - b.time : a.seq - b.seq,
    );
    heap.push({ time: 5, seq: 0 });
    heap.push({ time: 3, seq: 1 });
    heap.push({ time: 5, seq: 2 }); // same time as first, later seq
    heap.push({ time: 3, seq: 3 }); // same time as second, later seq
    const out = [heap.pop()!, heap.pop()!, heap.pop()!, heap.pop()!];
    expect(out).toEqual([
      { time: 3, seq: 1 },
      { time: 3, seq: 3 },
      { time: 5, seq: 0 },
      { time: 5, seq: 2 },
    ]);
  });

  it("peek returns the min without removing", () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    heap.push(5);
    heap.push(1);
    heap.push(3);
    expect(heap.peek()).toBe(1);
    expect(heap.size).toBe(3);
  });

  it("isEmpty and size behave", () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    expect(heap.isEmpty()).toBe(true);
    heap.push(42);
    expect(heap.isEmpty()).toBe(false);
    expect(heap.size).toBe(1);
    heap.pop();
    expect(heap.isEmpty()).toBe(true);
  });

  it("iterates over remaining elements", () => {
    const heap = new MinHeap<number>((a, b) => a - b);
    heap.push(2);
    heap.push(4);
    const seen = [...heap].sort((a, b) => a - b);
    expect(seen).toEqual([2, 4]);
  });
});
