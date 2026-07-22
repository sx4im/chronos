# 03 — Technical Specification (the core)

This is the engineering heart of Chronos. It specifies each core component precisely enough to implement, with reference code where it removes ambiguity. Treat the code as *reference*, not gospel — Claude Code will flesh it out — but the algorithms and invariants here are the contract.

> **The prime directive:** the entire system has exactly one source of entropy — the seeded PRNG — and exactly one source of time — the virtual clock. If any component reads `Date.now()`, `Math.random()`, `process.hrtime()`, or real I/O directly, determinism is broken. Audit for this relentlessly.

---

## 3.1 Seeded PRNG (`@sx4im/chronos-core/random`)

Requirements: deterministic from a 64-bit seed, long period, high statistical quality, fast enough, and **portable** (same output on any machine). Use **xoshiro256\*\*** seeded via **SplitMix64**. JS has no native 64-bit ints, so use `BigInt`.

```ts
const MASK64 = 0xFFFFFFFFFFFFFFFFn;

// SplitMix64 — used only to expand a seed into xoshiro's 256-bit state.
function splitmix64(seed: bigint): () => bigint {
  let z = seed & MASK64;
  return () => {
    z = (z + 0x9E3779B97F4A7C15n) & MASK64;
    let r = z;
    r = ((r ^ (r >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
    r = ((r ^ (r >> 27n)) * 0x94D049BB133111EBn) & MASK64;
    return (r ^ (r >> 31n)) & MASK64;
  };
}

function rotl(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & MASK64;
}

export class Rng {
  private s0: bigint; private s1: bigint; private s2: bigint; private s3: bigint;

  constructor(seed: bigint | number) {
    const sm = splitmix64(BigInt(seed));
    this.s0 = sm(); this.s1 = sm(); this.s2 = sm(); this.s3 = sm();
  }

  /** Raw 64-bit value. */
  nextU64(): bigint {
    const result = (rotl((this.s1 * 5n) & MASK64, 7n) * 9n) & MASK64;
    const t = (this.s1 << 17n) & MASK64;
    this.s2 ^= this.s0; this.s3 ^= this.s1;
    this.s1 ^= this.s2; this.s0 ^= this.s3;
    this.s2 ^= t; this.s3 = rotl(this.s3, 45n);
    return result;
  }

  /** Float in [0, 1) using the top 53 bits (matches IEEE-754 double precision). */
  nextFloat(): number {
    return Number(this.nextU64() >> 11n) / 9007199254740992; // 2^53
  }

  /** Integer in [min, max). */
  nextInt(min: number, max: number): number {
    return min + Math.floor(this.nextFloat() * (max - min));
  }

  /** True with probability p. */
  chance(p: number): boolean { return this.nextFloat() < p; }

  /** Pick one element deterministically. */
  pick<T>(arr: readonly T[]): T { return arr[this.nextInt(0, arr.length)]; }

  /** Snapshot/restore for replay & node-restart determinism. */
  getState(): [bigint, bigint, bigint, bigint] { return [this.s0, this.s1, this.s2, this.s3]; }
  setState(s: [bigint, bigint, bigint, bigint]) { [this.s0, this.s1, this.s2, this.s3] = s; }
}
```

**Notes:**
- `getState`/`setState` are required so the harness can snapshot RNG state (for replay and for restarting a "crashed" node from a checkpoint).
- BigInt is slower than native math; that's acceptable for v1 and is the motivation for the Phase-4 Rust/WASM port. Don't prematurely optimize.
- **Never** add a second RNG. If you need independent streams (e.g., per-node), derive child RNGs deterministically by seeding from `parent.nextU64()`.

---

## 3.2 Virtual Clock (`@sx4im/chronos-core/clock`)

The clock holds the current simulated time (integer milliseconds or nanoseconds — pick **integer milliseconds** for v1 simplicity). It never reads real time. It only advances when the scheduler pops an event scheduled in the future.

```ts
export class VirtualClock {
  private _now = 0; // simulated ms since start
  now(): number { return this._now; }
  // Called only by the Scheduler when it pops a future event.
  advanceTo(t: number): void {
    if (t < this._now) throw new Error("time cannot go backwards");
    this._now = t;
  }
}
```

Key property: **time is event-driven**, not real. A `sleep(3_600_000)` just schedules a wake-up at `now + 3.6M`; if nothing else is pending, the clock jumps straight there. Tests with long timeouts run instantly.

---

## 3.3 Scheduler (`@sx4im/chronos-core/scheduler`)

The scheduler is the controlled single-threaded event loop. It owns a **min-priority queue** of events ordered by `(time, seq)`. `seq` is a monotonic counter that breaks ties deterministically (FIFO among same-time events) — this is critical for reproducibility.

### Event model
```ts
interface SimEvent {
  time: number;     // virtual time at which to run
  seq: number;      // tiebreaker — assigned at insert
  kind: string;     // "timer" | "deliver" | "wake" | "fault" | ... (for the log)
  nodeId?: string;  // owning node, if any (for crash cancellation & the log)
  run: () => void;  // the continuation
  canceled?: boolean;
}
```

### Priority queue
Use a real **binary min-heap** (O(log n) insert/pop), not a sorted array. Comparison: earlier `time` first; if equal, smaller `seq` first.

### The loop
```ts
export class Scheduler {
  private heap = new MinHeap<SimEvent>(cmp); // cmp by (time, seq)
  private seqCounter = 0;
  constructor(private clock: VirtualClock, private rng: Rng) {}

  schedule(time: number, run: () => void, meta: Partial<SimEvent> = {}): SimEvent {
    const ev: SimEvent = { time, seq: this.seqCounter++, run, kind: meta.kind ?? "timer", nodeId: meta.nodeId };
    this.heap.push(ev);
    return ev;
  }

  /** Run until the queue drains, a step budget is hit, or an invariant throws. */
  async run(opts: { maxSteps?: number; onStep?: (ev: SimEvent) => void } = {}): Promise<void> {
    let steps = 0;
    while (!this.heap.isEmpty()) {
      if (opts.maxSteps && steps >= opts.maxSteps) break;
      const ev = this.heap.pop()!;
      if (ev.canceled) continue;
      this.clock.advanceTo(ev.time);   // time jumps forward
      opts.onStep?.(ev);               // hook for logging
      ev.run();                        // user continuation runs to next await
      await drainMicrotasks();         // let Promise continuations settle (see §3.4)
      steps++;
    }
  }

  cancelNode(nodeId: string): void {
    for (const ev of this.heap) if (ev.nodeId === nodeId) ev.canceled = true; // lazy cancel
  }
}
```

**Determinism invariants of the scheduler:**
1. Pop order is a pure function of inserted `(time, seq)` — no ambiguity ever.
2. `seq` is assigned at insertion in program order; never reuse or reorder.
3. Any "randomness" in *what* gets scheduled (e.g., a fault) must draw from `rng`, never elsewhere.

---

## 3.4 Async / Promise integration (`drainMicrotasks`) — the subtle part

Recall §2.3: Chronos doesn't reimplement Promises; it removes external entropy and lets V8's already-deterministic microtask draining happen between scheduler steps. The bridge is `drainMicrotasks()`: after each event's synchronous body runs (up to its next `await`), we must let pending Promise continuations flush before advancing simulated time.

A robust way to flush the microtask queue from within a controlled loop is to yield to it explicitly. In Node, `await Promise.resolve()` flushes one microtask "turn"; to fully drain, flush until empty. A pragmatic, correct-enough implementation:

```ts
// Flush microtasks. Using setImmediate gives us a libuv "check" tick that runs
// after the current microtask queue is fully drained, so awaiting it guarantees
// all queued microtasks have run. We keep one real macrotask primitive (setImmediate)
// purely as a microtask-drain barrier — it does NOT introduce nondeterminism
// because no user timing depends on it.
export function drainMicrotasks(): Promise<void> {
  return new Promise<void>((resolve) => setImmediate(resolve));
}
```

**Why this is safe:** `setImmediate`'s callback runs after the microtask queue is empty for the current loop iteration. We use exactly one such barrier per step, deterministically, so it adds no entropy. All *user-visible* timing flows through the virtual clock, not through `setImmediate`.

> Claude Code task: validate this against edge cases (nested awaits that schedule new sim events mid-drain). If a continuation schedules a new event at the *current* virtual time, it must be picked up on a subsequent loop iteration in `seq` order. Add tests for this in Phase 1.

### Deterministic async primitives
User code never calls raw `setTimeout`. It uses:

```ts
export interface SimEnv {
  now(): number;
  random(): number;                    // [0,1) from the sim RNG
  sleep(ms: number): Promise<void>;    // resolves after virtual ms
  setTimeout(cb: () => void, ms: number): { cancel(): void };
  net: SimNetwork;                     // §3.6
  nodeId: string;
}
```

`sleep` is the canonical example:
```ts
function makeSleep(scheduler: Scheduler, clock: VirtualClock, nodeId: string) {
  return (ms: number) => new Promise<void>((resolve) => {
    scheduler.schedule(clock.now() + ms, resolve, { kind: "wake", nodeId });
  });
}
```

That's the whole trick: `await env.sleep(1000)` parks the continuation as a future event; the scheduler resumes it when virtual time reaches it.

---

## 3.5 Strict-mode guards (`@sx4im/chronos-core/strict`)

To catch *accidental* nondeterminism (user code that calls globals directly), Chronos can, during a simulation, replace globals so they route through the simulator or throw. This is the safety net, not the primary mechanism.

```ts
export function installGuards(env: SimEnv): () => void {
  const realNow = Date.now, realRandom = Math.random, realSetTimeout = globalThis.setTimeout;
  Date.now = () => env.now();
  Math.random = () => env.random();
  // global setTimeout → route through sim (so forgotten timers still behave)
  (globalThis as any).setTimeout = (cb: () => void, ms = 0) => env.setTimeout(cb, ms);
  // Reading a real socket / fs in strict mode should THROW with a helpful message.
  return () => { // restore
    Date.now = realNow; Math.random = realRandom; (globalThis as any).setTimeout = realSetTimeout;
  };
}
```

Provide two strictness levels: **`route`** (silently redirect globals to the sim) and **`throw`** (throw on any global entropy use, forcing users onto the DI path). Default to `route` for onboarding; recommend `throw` in CI.

---

## 3.6 Virtual Network (`@sx4im/chronos-net`)

Nodes communicate only through the simulated network. Sending a message schedules a delivery event at `now + latency`, with latency and faults drawn from the RNG.

```ts
export interface Message<T = unknown> { from: string; to: string; payload: T; }

export interface NetworkConfig {
  minLatency: number;   // ms
  maxLatency: number;   // ms
  dropProb: number;     // 0..1
  dupProb: number;      // 0..1
  // partitions managed separately (§3.7)
}

export class SimNetwork {
  constructor(
    private scheduler: Scheduler,
    private clock: VirtualClock,
    private rng: Rng,
    private cfg: NetworkConfig,
    private partitions: PartitionManager,
    private inbox: (m: Message) => void, // routes to the destination node's handler
  ) {}

  send(from: string, to: string, payload: unknown): void {
    if (this.partitions.isBlocked(from, to, this.clock.now())) return; // partitioned → swallow
    if (this.rng.chance(this.cfg.dropProb)) return;                    // dropped
    const deliver = () => this.inbox({ from, to, payload });
    const latency = this.rng.nextInt(this.cfg.minLatency, this.cfg.maxLatency + 1);
    this.scheduler.schedule(this.clock.now() + latency, deliver, { kind: "deliver", nodeId: to });
    if (this.rng.chance(this.cfg.dupProb)) {                           // duplicate
      const extra = this.rng.nextInt(this.cfg.minLatency, this.cfg.maxLatency + 1);
      this.scheduler.schedule(this.clock.now() + extra, deliver, { kind: "deliver", nodeId: to });
    }
  }
}
```

Because delivery is scheduled through the same `(time, seq)` queue with RNG-drawn latencies, **message reordering emerges naturally and deterministically** — exactly the conditions that expose distributed bugs.

---

## 3.7 Fault injection (`@sx4im/chronos-net/faults`)

The faults that make DST valuable. All decisions draw from the RNG.

- **Partitions** — a `PartitionManager` holds active partitions: sets of node groups that can't talk, each with a `[startTime, endTime)` window. The harness can schedule random partitions (heal after a random duration). `isBlocked(a, b, t)` checks membership.
- **Node crash** — `scheduler.cancelNode(id)` cancels the node's pending events; mark it down so the network swallows messages to it. Optionally snapshot its state.
- **Node restart** — recreate the node, optionally restoring persisted state; new events resume. Tests recovery/idempotency.
- **Clock skew** (later) — give a node a per-node offset added to `env.now()`.
- **Slow disk** (later) — model storage ops as scheduled events with RNG latency.

Expose these as a high-level "chaos" config the harness applies probabilistically each step:
```ts
interface ChaosConfig {
  partitionProb?: number;     // chance per step to start a partition
  crashProb?: number;         // chance per step to crash a live node
  maxPartitionMs?: number;
  // ...
}
```

---

## 3.8 Event log & trace schema (`@sx4im/chronos-core/trace`)

The event log is the source of truth for **replay** and the **inspector**. Define it now and keep it stable.

```ts
type TraceEvent =
  | { t: number; seq: number; kind: "timer";   nodeId?: string }
  | { t: number; seq: number; kind: "wake";    nodeId: string }
  | { t: number; seq: number; kind: "deliver"; from: string; to: string; summary: string }
  | { t: number; seq: number; kind: "send";    from: string; to: string; summary: string }
  | { t: number; seq: number; kind: "crash";   nodeId: string }
  | { t: number; seq: number; kind: "restart"; nodeId: string }
  | { t: number; seq: number; kind: "partition"; groups: string[][]; healAt: number }
  | { t: number; seq: number; kind: "invariant-violation"; name: string; detail: string };

interface Trace {
  seed: string;            // stringified BigInt
  config: unknown;         // network + chaos config used
  nodes: string[];
  events: TraceEvent[];
  result: "ok" | "violation";
}
```

The **failure capsule** is just `{ seed, config }` (the minimum to reproduce) plus the `Trace` (for human reading). Replaying = constructing a Simulator with the same `seed` + `config` and running again; it will reproduce identically.

---

## 3.9 Replay & shrinking

- **Replay (v1):** given a capsule, reconstruct and re-run. Must produce an identical trace. This is the headline feature — make it a one-liner: `chronos replay ./capsule.json`.
- **Shrinking (stretch, Phase 5):** when a seed fails, search for a *simpler* failing scenario (fewer faults, fewer steps) to make debugging easier — analogous to property-test shrinking. Strategy: re-run with subsets/reductions of the injected faults and keep the smallest still-failing config. Mark clearly as advanced.

---

## 3.10 Invariants / property checking (`@sx4im/chronos-core/invariants`)

Users assert properties that must hold throughout (safety) or eventually (liveness).

```ts
interface Invariant {
  name: string;
  check(world: WorldView): void; // throw or return false to signal violation
}
```

- **Safety** invariants are checked after every step (e.g., "at most one leader," "no two nodes commit different values at the same log index").
- **Liveness** invariants are checked at end-of-run or after the system "settles" (e.g., "all nodes eventually agree").

On violation: stop, record an `invariant-violation` trace event, and write the failure capsule.

---

## 3.11 Determinism guard (non-negotiable)

Chronos must prove its own determinism. The guard: run a scenario with seed `S`, capture `traceA`; run again with `S`, capture `traceB`; assert `deepEqual(traceA, traceB)`. Repeat across many seeds and in CI. **If this ever fails, it is the top-priority bug.** This test is the soul of the project; see `testing-strategy.md`.

---

## 3.12 Performance considerations (don't over-index early)

- v1 target: simulate thousands of events per scenario in well under a second. The binary heap + BigInt RNG easily meets this.
- The known slow spot is BigInt RNG. **Phase 4** ports the RNG (and optionally the heap/scheduler core) to **Rust → WASM** or **napi-rs** for a large speedup, enabling millions of events and exhaustive seed sweeps. This is the deliberate "beyond your current stack" stretch and a great talking point.
- Avoid allocations in the hot loop; reuse event objects where safe; keep the trace log append-only and optionally sample it for very long runs.

Next: the public surface in `api-design.md`.
