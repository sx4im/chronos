# The determinism model

Chronos builds on a property of JavaScript engines:

> V8 execution is deterministic given identical inputs. Nondeterminism enters Node programs through external entropy sources.

Entropy enters through four paths:

1. **The wall clock**: `Date.now()`, `performance.now()`, and `process.hrtime()`.
2. **OS scheduling**: thread scheduling, event-loop wakeups, and timer coalescing.
3. **I/O completion order**: network and file system callbacks arriving out of order.
4. **Unseeded randomness**: `Math.random()` and `crypto.getRandomValues()`.

Chronos replaces all four sources:

| Source | Chronos implementation |
| --- | --- |
| Wall clock | **`VirtualClock`**: advances when the scheduler processes an event |
| OS scheduling | **Single thread and event queue**: serializes execution on a min-heap ordered by `(time, seq)` |
| I/O completion order | **Simulated network**: schedules message deliveries through the same heap using the PRNG |
| Unseeded randomness | **Seeded PRNG**: xoshiro256** initialized by SplitMix64 |

The simulation relies on one source of entropy (the seeded PRNG) and one source of time (the virtual clock). Execution is a pure function of the seed and configuration, allowing a capsule containing `{ seed, config }` to reproduce a run bit for bit.

## Finding edge-case failures

In production, rare network conditions occur infrequently and prove difficult to reproduce. In simulation, network timing depends on the seeded PRNG, making seed sweeps a search across execution orderings:

```ts
simTest("safety holds", { seeds: 10_000, nodes: 5, chaos: { /* ... */ } }, body);
```

Ten thousand seeds execute ten thousand distinct, reproducible scenarios under packet drops, duplicates, partitions, and crashes. When a seed violates an invariant, Chronos generates a capsule that reproduces the failure until resolved.

## System boundaries

- Chronos does not reimplement Promises or native microtasks. V8 drains microtasks between scheduler steps.
- Chronos does not intercept system calls at the OS kernel boundary. It uses dependency injection via `SimEnv`.
- Chronos does not simulate CPU execution time. Virtual time advances between events rather than during synchronous code execution.

## Background and testing

This pattern follows the simulation testing approach used by FoundationDB, TigerBeetle, and Turmoil.

The repository verifies determinism with dedicated tests in `packages/core/test/determinism.test.ts`. Tests run multi-node scenarios twice per seed and assert bit-for-bit event trace equality.
