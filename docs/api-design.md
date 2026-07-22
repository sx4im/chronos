# 04 — API Design (what users actually type)

The API is the product's "face." It must make the *right* thing (DI of the simulated environment) the *easy* thing, integrate cleanly with Vitest, and make replay a one-liner. Below is the target surface with realistic examples. Build toward this.

> Design principle: **the same business logic runs in tests and in production.** Only the injected `env` differs (simulated vs. real adapter). If a user has to write two versions of their logic, the API has failed.

---

## 4.1 The 15-minute first experience

A new user should be able to write this and watch a race get caught and replayed:

```ts
import { simTest, expectInvariant } from "@sx4im/chronos-vitest";

// Their system under test takes an `env` (clock/random/network) — that's the contract.
import { Counter } from "./counter";

simTest("distributed counter never loses increments", {
  seeds: 100,            // run 100 different seeds
  nodes: 3,              // 3 simulated nodes
  network: { minLatency: 1, maxLatency: 50, dropProb: 0.05 },
  chaos: { crashProb: 0.01, partitionProb: 0.02, maxPartitionMs: 200 },
}, async (sim) => {
  const counters = sim.nodes.map((node) => new Counter(node.env));

  // Drive some concurrent work
  await Promise.all(counters.map((c, i) => c.increment(i + 1)));
  await sim.settle();   // let all messages/timers flush

  // Invariant: the merged total equals the sum of all increments
  expectInvariant("no lost increments", () => {
    const total = counters.reduce((s, c) => s + c.localValue(), 0);
    return total === counters.length; // example property
  });
});
```

When a seed violates the invariant, Chronos prints the failing seed and writes a capsule:

```
✗ seed 8273461 violated "no lost increments" at t=142ms
  → wrote capsule: .chronos/failures/8273461.json
  → replay with: npx chronos replay .chronos/failures/8273461.json
```

And replay reproduces it **exactly**, every time. That moment — "it failed once in CI and I can now replay it deterministically on my laptop" — is the whole pitch.

---

## 4.2 Core programmatic API (`@sx4im/chronos-core`)

For users who want full control without the Vitest wrapper:

```ts
import { Simulator } from "@sx4im/chronos-core";

const sim = new Simulator({
  seed: 8273461n,
  nodes: 3,
  network: { minLatency: 1, maxLatency: 50, dropProb: 0.05, dupProb: 0 },
  chaos: { crashProb: 0.01 },
});

// Each node exposes a SimEnv to inject into user logic.
const [a, b, c] = sim.nodes.map((n) => n.env);

const app = new MyDistributedThing([a, b, c]);

sim.addInvariant("safety: at most one leader", (world) => {
  return world.nodes.filter((n) => app.isLeader(n.id)).length <= 1;
});

const result = await sim.run({ maxSteps: 100_000 });
// result: { status: "ok" | "violation", trace, capsulePath? }

if (result.status === "violation") {
  console.log("Reproduce with seed", result.trace.seed);
}
```

### `Simulator` shape (target)
```ts
class Simulator {
  constructor(opts: SimulatorOptions);
  readonly nodes: SimNode[];                 // each has { id, env }
  readonly clock: VirtualClock;              // read-only now()
  addInvariant(name: string, check: (w: WorldView) => boolean): void;
  run(opts?: { maxSteps?: number }): Promise<RunResult>;
  settle(): Promise<void>;                   // run until queue empty (no maxSteps)
  // chaos controls (manual, for targeted tests):
  crash(nodeId: string): void;
  restart(nodeId: string): void;
  partition(groups: string[][], durationMs?: number): void;
  heal(): void;
}

interface SimulatorOptions {
  seed: bigint | number;
  nodes: number | string[];
  network?: Partial<NetworkConfig>;
  chaos?: ChaosConfig;
}
```

### `SimEnv` — the dependency users inject
```ts
interface SimEnv {
  readonly nodeId: string;
  now(): number;
  random(): number;
  sleep(ms: number): Promise<void>;
  setTimeout(cb: () => void, ms: number): { cancel(): void };
  net: {
    send(to: string, payload: unknown): void;
    onReceive(handler: (from: string, payload: unknown) => void): void;
  };
}
```

This is the *only* surface user code touches at runtime. In production they pass a `RealEnv` with the same shape (real clock, `Math.random` or crypto, real transport). That symmetry is the key to "write once, run in sim or prod."

---

## 4.3 The production adapter (`@sx4im/chronos-core/real`)

Ship a `RealEnv` so users can run the identical logic for real:

```ts
import { RealEnv } from "@sx4im/chronos-core/real";

const env = new RealEnv({
  nodeId: "node-prod-1",
  transport: myWebSocketTransport, // user supplies a real send/receive
});
const app = new MyDistributedThing([env]);
```

`RealEnv.now()` → `Date.now()`, `RealEnv.sleep` → real `setTimeout`, `RealEnv.net.send` → the user's transport. This proves the abstraction is real, not a test-only toy — a point reviewers will appreciate.

---

## 4.4 Vitest integration (`@sx4im/chronos-vitest`)

```ts
simTest(name, options, body)        // runs `body` across N seeds; fails on any violation
simTest.only / simTest.skip
expectInvariant(name, predicate)    // assert a property inside a sim body
replayTest(capsulePath)             // re-run a saved capsule as a focused test
```

`simTest` should:
- run each seed, and on the **first** failing seed, stop that scenario, write a capsule, and fail the Vitest test with the seed + capsule path in the message;
- support a `CHRONOS_SEED` env var to force a single seed (for replay in CI);
- support `seeds: number` (count, derived deterministically from a base seed) or `seeds: bigint[]` (explicit list).

---

## 4.5 CLI (`@sx4im/chronos-cli`)

```
chronos replay <capsule.json>     # re-run a saved failure deterministically
chronos trace <capsule.json>      # pretty-print the event timeline to the terminal
chronos open <capsule.json>       # open the trace in the web Inspector (Phase 3)
chronos sweep <test> --seeds 10000  # brute-force many seeds looking for violations
```

`replay` and `trace` are the must-haves; `open` and `sweep` come with later phases.

---

## 4.6 Inspector input contract (Phase 3)

The Inspector is a static React app that loads a `Trace` (§3.8 schema) and renders:
- a horizontal **timeline** of events (zoom/scrub by virtual time);
- a **message-sequence diagram** between nodes (sends → deliveries, with dropped/duplicated/partitioned ones styled distinctly);
- a **node state panel** (if the user opts to log state snapshots);
- the **violation** highlighted with the events leading up to it.

It reads a single JSON file — no backend — so it can be hosted free on GitHub Pages and opened on any capsule. (Your frontend strength makes this the visual "wow" that Rust DST tools lack.)

---

## 4.7 API stability & versioning

- Pre-1.0: API may change; document breaking changes in the changelog.
- The **`SimEnv` interface and the `Trace` schema are the two contracts to stabilize first**, because user code and the Inspector depend on them respectively. Treat changes to these as semver-major once you have users.
- Export everything from a single `@sx4im/chronos-core` entry plus subpath exports (`/real`, `/trace`). Keep `@sx4im/chronos-vitest`, `@sx4im/chronos-net`, `@sx4im/chronos-cli`, `@sx4im/chronos-inspector` as separate packages so users install only what they need.

Next: where every file lives — `05-REPO-STRUCTURE.md`.
