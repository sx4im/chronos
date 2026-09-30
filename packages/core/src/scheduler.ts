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

// The real macrotask primitives, captured at MODULE LOAD — before any run can
// install the strict-mode guards. The guards replace `globalThis.setTimeout`
// with one that schedules into the simulator, so a barrier that looked the
// global up at call time would, on the `setTimeout` fallback path, enqueue its
// own resolution as a simulated event that only this loop can run: a deadlock
// in the one function the whole scheduler awaits every step. Binding the
// originals here makes that unreachable regardless of what is patched.
const realSetImmediate: typeof setImmediate | undefined =
  typeof setImmediate === "function" ? setImmediate : undefined;
const realSetTimeout = globalThis.setTimeout;

/** Flush microtasks using a single real macrotask barrier per step.
 *  This is the ONLY allowed real macrotask primitive. It introduces no
 *  nondeterminism because no user-visible timing flows through it. */
export function drainMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => {
    if (realSetImmediate) {
      realSetImmediate(resolve);
    } else if (typeof MessageChannel !== "undefined") {
      const channel = new MessageChannel();
      channel.port1.addEventListener("message", () => resolve(), { once: true });
      channel.port1.start?.();
      channel.port2.postMessage(null);
    } else {
      realSetTimeout(resolve, 0);
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

/** Outcome of a scheduler run. `completed: false` means the step budget was
 *  exhausted while events were still pending — the simulation was truncated,
 *  NOT finished, so end-of-run semantics (liveness checks, "system settled")
 *  must not fire downstream. The return value is the load-bearing signal that
 *  replaces the old silent truncation. */
export interface SchedulerRunResult {
  /** true ⇔ the heap drained (the system reached quiescence). */
  completed: boolean;
  /** Number of events actually executed. */
  steps: number;
}

export class Scheduler {
  private heap = new MinHeap<SimEvent>(cmp);
  private seqCounter = 0;
  private asyncError: unknown = null;

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
    if (time < this.clock.now()) {
      throw new Error(
        `cannot schedule event in the past (now=${this.clock.now()}, attempted=${time})`,
      );
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

  /** Run until the queue drains, a step budget is hit, or an invariant throws.
   *  Returns whether the run actually completed (heap drained) or was truncated
   *  by the step budget — the Simulator turns that into the `timeout` status. */
  async run(opts: RunOptions = {}): Promise<SchedulerRunResult> {
    let steps = 0;
    while (!this.heap.isEmpty()) {
      if (opts.maxSteps !== undefined && steps >= opts.maxSteps) {
        return { completed: false, steps };
      }
      const ev = this.heap.pop()!;
      if (ev.canceled) continue;
      this.clock.advanceTo(ev.time); // time jumps forward
      opts.onStep?.(ev); // hook for logging
      const ret = ev.run() as unknown; // user continuation runs (to its next await / completion)
      if (ret != null && typeof (ret as Promise<unknown>).then === "function") {
        (ret as Promise<unknown>).catch((err) => {
          this.asyncError = err;
        });
      }
      await drainMicrotasks(); // let Promise continuations settle (§3.4)
      if (this.asyncError) {
        const err = this.asyncError;
        this.asyncError = null;
        throw err;
      }
      opts.onStepEnd?.(ev); // hook for safety-invariant checks
      steps++;
    }
    return { completed: true, steps };
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
