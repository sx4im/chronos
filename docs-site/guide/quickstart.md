# 15-minute quickstart

Chronos runs concurrent or distributed code on a single controlled thread with virtual time, seeded randomness, and a simulated network. Any race condition reproduces consistently from a single integer seed.

This guide covers setup and reproducing your first failure.

## 1. Install

```bash
pnpm add -D @sx4im/chronos-core @sx4im/chronos-net @sx4im/chronos-vitest @sx4im/chronos-cli
```

Requirements: Node 20 or later with ESM support. Chronos integrates with Vitest using the `simTest` helper.

::: tip Working from the repo?
Clone the repository and run `pnpm install && pnpm test`. The test suite and determinism checks will run locally.
:::

## 2. Write a system against `SimEnv`

Code under test reads time, randomness, timers, and network operations from an injected `env: SimEnv` rather than global runtime methods.

```ts
import type { SimEnv } from "@sx4im/chronos-core";

class Counter {
  private value = 0;
  private peers: string[] = [];

  constructor(private env: SimEnv) {
    // Receive increments from peers over the simulated network.
    env.net.onReceive(() => {
      this.value++; // BUG: not idempotent, double-counts duplicates.
    });
  }

  setPeers(p: string[]) {
    this.peers = p;
  }

  increment() {
    this.value++;
    for (const peer of this.peers) this.env.net.send(peer, "inc");
  }

  get count() {
    return this.value;
  }
}
```

The `SimEnv` interface provides these properties:

| Member | Purpose |
| --- | --- |
| `env.now()` | Returns virtual time in milliseconds |
| `env.random()` | Returns floating point values in `[0, 1)` from the seeded PRNG |
| `env.sleep(ms)` | Returns a promise that resolves after virtual delay |
| `env.setTimeout(cb, ms)` | Registers a virtual timer with a `cancel()` handle |
| `env.net.send / onReceive` | Sends and listens for simulated network messages |
| `env.nodeId` | Identifies the current node string ID |

## 3. Sweep seeds with `simTest`

```ts
import { simTest, expectInvariant } from "@sx4im/chronos-vitest";
import { SimNetwork } from "@sx4im/chronos-net";

simTest(
  "counter never loses increments",
  {
    seeds: 100, // sweeps seeds 0 through 99
    nodes: 3,
    netFactory: (ctx) =>
      new SimNetwork({
        ...ctx,
        config: {
          minLatency: 1,
          maxLatency: 10,
          dropProb: 0.05,
          dupProb: 0.05,
        },
      }),
  },
  async (sim) => {
    const ids = sim.nodes.map((n) => n.id);
    const counters = sim.nodes.map((n) => {
      const c = new Counter(n.env);
      c.setPeers(ids);
      return c;
    });
    counters.forEach((c) => c.increment());

    sim.addInvariant({
      name: "all counts equal",
      kind: "safety",
      check: () =>
        sim.scheduler.pendingCount() > 0 ||
        counters.every((c) => c.count === counters[0].count),
    });
  }
);
```

Run tests through Vitest:

```bash
npx vitest run
```

## 4. Failure reproduction

If a seed encounters a duplicated message, the counter double-counts and breaks the invariant. Chronos halts execution, writes a failure capsule file, and reports the test failure:

```
✗ seed 42 violated "all counts equal" (n0=4, n1=5, n2=4)
  -> wrote capsule: .chronos/failures/42.json
  -> replay with:   npx chronos replay .chronos/failures/42.json
```

The failing seed reproduces deterministically:

```bash
npx chronos replay .chronos/failures/42.json   # verify identical execution
npx chronos trace  .chronos/failures/42.json   # print event timeline
npx chronos open   .chronos/failures/42.json   # open visual Inspector UI
```

## Next steps

- [Writing testable systems with DI](/guide/di): using `SimEnv` across test and production paths.
- [Replay and failure capsules](/guide/replay): capsule JSON structures, `replayTest`, and shrinking.
- [The determinism model](/concepts/determinism): execution mechanics and safety constraints.
