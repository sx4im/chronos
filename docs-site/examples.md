# Examples

All examples live in the repository under [`examples/`](https://github.com/sx4im/chronos/tree/main/examples) and run as part of the test suite.

## `counter`: smallest race condition

A replicated counter with a deliberate bug: the receive handler is not idempotent, so duplicated messages double-count, and dropped messages leave replicas behind.

```ts
env.net.onReceive(() => {
  this.value++; // BUG: not idempotent, double-counts duplicates.
});
```

The test sweeps seeds under 15% drop and 15% duplication probabilities. Chronos finds the violating seed, writes a capsule, and reproduces the trace bit for bit.

```
✗ seed 42 violated "all counts equal" (n0=4, n1=5, n2=4)
  -> wrote capsule: .chronos/failures/42.json
```

Source: [`examples/counter`](https://github.com/sx4im/chronos/tree/main/examples/counter)

## `raft-lite`: consensus safety under chaos

A Raft implementation with leader election and log replication. Nodes rely on `env` for randomized election timeouts (`env.random()`) and heartbeats (`env.setTimeout()`).

Two per-step safety invariants are evaluated after every scheduler step:

1. **Election safety**: at most one leader per term.
2. **Commit agreement**: committed entries never diverge across nodes.

The test suite sweeps 2,000 seeds under network drops, duplicates, partitions, crashes, and restarts.

Source: [`examples/raft-lite`](https://github.com/sx4im/chronos/tree/main/examples/raft-lite)

## `crdt`: state-based LWW register

A state-based Conflict-Free Replicated Data Type (LWW-Register) using timestamp and node ID tiebreakers for concurrent writes.

Two safety properties are verified:

1. **Strong eventual consistency**: when network activity settles, all active nodes reach identical state.
2. **LWW ordering**: the converged value matches the update with the highest timestamp and writer ID.

Source: [`examples/crdt`](https://github.com/sx4im/chronos/tree/main/examples/crdt)

## `twophase-commit`: transaction atomicity

A Two-Phase Commit (2PC) coordinator and participant implementation testing transaction state transitions under network partitions and timeouts.

Invariants verified:

1. **Atomicity**: active participants reach matching transaction outcomes (all committed or all aborted).
2. **Non-spontaneous commit**: no participant commits if any participant voted to abort.

Source: [`examples/twophase-commit`](https://github.com/sx4im/chronos/tree/main/examples/twophase-commit)

## `gossip`: epidemic dissemination

An epidemic gossip protocol where nodes periodically exchange state vectors with randomly selected peers.

Invariants verified:

1. **Gossip consistency**: all active nodes holding a key agree on its value, version, and origin ID.
2. **Monotonicity**: stored record versions never decrease.

Source: [`examples/gossip`](https://github.com/sx4im/chronos/tree/main/examples/gossip)

## Writing your own

The workflow used by these examples:

1. Write your system against `SimEnv` ([DI guide](/guide/di)).
2. Define correctness properties using `expectInvariant`.
3. Sweep seeds with network faults enabled ([quickstart](/guide/quickstart)).
4. Pin failing seeds with `replayTest` ([replay guide](/guide/replay)).
