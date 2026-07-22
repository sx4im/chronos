// The Scheduler: a controlled single-threaded event loop.
// It owns a min-heap of SimEvent ordered by (time, seq) and pops the earliest,
// advances the virtual clock to it, runs it, then drains microtasks before the next step.

import { MinHeap } from "./heap.js";
import type { VirtualClock } from "./clock.js";
import type { Rng } from "./random.js";

export interface SimEvent {
  time: number; // virtual time at which to run
  seq: number; // tiebreaker — assigned at insertion (monotonic, never reused)
  kind: string; // "timer" | "wake" | "deliver" | "crash" | "restart" | ... (for the log)
  nodeId?: string; // owning node, if any (for crash cancellation & the log)
  run: () => void; // the continuation
  canceled?: boolean;
  // trace-only extras, used when kind === "deliver":
  from?: string;
  to?: string;
  summary?: string;
}

/** Metadata you may pass when scheduling an event. */
export interface ScheduleMeta {
  kind?: string;
  nodeId?: string;
  from?: string;
  to?: string;
  summary?: string;
}

/** Flush microtasks using a single real macrotask barrier per step.
 *  This is the ONLY allowed real macrotask primitive. It introduces no
 *  nondeterminism because no user-visible timing flows through it. */
export function drainMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (typeof setImmediate === "function") {
      setImmediate(resolve);
    } else if (typeof MessageChannel !== "undefined") {
      const channel = new MessageChannel();
      channel.port1.addEventListener("message", () => resolve(), { once: true });
      channel.port1.start?.();
      channel.port2.postMessage(null);
    } else {
      setTimeout(resolve, 0);
    }
  });
}

const cmp = (a: SimEvent, b: SimEvent): number =>
  a.time !== b.time ? a.time - b.time : a.seq - b.seq;

export interface RunOptions {
  maxSteps?: number;
  onStep?: (ev: SimEvent) => void; // fired before ev.run(), with the virtual clock advanced
  onStepEnd?: (ev: SimEvent) => void; // fired after ev.run() + microtask drain (safety invariants live here)
}

export class Scheduler {
  private heap = new MinHeap<SimEvent>(cmp);
  private seqCounter = 0;

  // The clock and rng are exposed for the env/network to read/write.
  constructor(
    public readonly clock: VirtualClock,
    public readonly rng: Rng,
  ) {}

  schedule(time: number, run: () => void, meta: ScheduleMeta = {}): SimEvent {
    // Fail fast on a non-finite scheduled time. If a `time` of NaN reached the
    // heap, the `(time, seq)` comparator would return NaN even on reaches with
    // other finite events and break the ordering — events would fire out of
    // virtual-time order and the run would no longer be deterministic. A NaN
    // time typically enters via a scenario's `env.sleep(NaN)`/`env.setTimeout(NaN)`
    // or a malformed capsule config (e.g. `network.minLatency: NaN`), so this is
    // the load-bearing boundary between "weird input" and "corrupted run".
    if (!Number.isFinite(time)) {
      throw new Error(`scheduled time must be finite (got ${time})`);
    }
    const ev: SimEvent = {
      time,
      seq: this.seqCounter++,
      run,
      kind: meta.kind ?? "timer",
      ...(meta.nodeId !== undefined ? { nodeId: meta.nodeId } : {}),
      ...(meta.from !== undefined ? { from: meta.from } : {}),
      ...(meta.to !== undefined ? { to: meta.to } : {}),
      ...(meta.summary !== undefined ? { summary: meta.summary } : {}),
    };
    this.heap.push(ev);
    return ev;
  }

  /** Run until the queue drains, a step budget is hit, or an invariant throws. */
  async run(opts: RunOptions = {}): Promise<void> {
    let steps = 0;
    while (!this.heap.isEmpty()) {
      if (opts.maxSteps !== undefined && steps >= opts.maxSteps) break;
      const ev = this.heap.pop()!;
      if (ev.canceled) continue;
      this.clock.advanceTo(ev.time); // time jumps forward
      opts.onStep?.(ev); // hook for logging
      ev.run(); // user continuation runs (to its next await / completion)
      await drainMicrotasks(); // let Promise continuations settle (§3.4)
      opts.onStepEnd?.(ev); // hook for safety-invariant checks
      steps++;
    }
  }

  /** Lazy-cancel all pending events owned by a node (used on crash). */
  cancelNode(nodeId: string): void {
    for (const ev of this.heap) {
      if (ev.nodeId === nodeId) ev.canceled = true;
    }
  }

  pendingCount(): number {
    return this.heap.size;
  }

  hasPending(): boolean {
    return !this.heap.isEmpty();
  }
}
