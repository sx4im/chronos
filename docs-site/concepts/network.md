# Simulated network and chaos

`@sx4im/chronos-net` provides a simulated network that models latency, packet drops, message duplication, network partitions, and node crashes.

## Message delivery scheduling

Calling `env.net.send(to, payload)` performs two operations:

1. Draws latency from the seeded PRNG: `latency` in `[minLatency, maxLatency]`.
2. Schedules a `deliver` event at `now + latency` on the event min-heap.

Message reordering occurs when two messages draw different latency values, allowing the second message to arrive before the first. Execution remains deterministic because latency values derive from the seeded PRNG.

## Fault injection: `SimNetwork`

`SimNetwork` evaluates fault parameters per message:

| Fault | Configuration option | Behavior |
| --- | --- | --- |
| **Drop** | `dropProb` | Records a `dropped` event and skips delivery |
| **Duplicate** | `dupProb` | Schedules an additional `deliver` event with an independent latency value |
| **Partition** | via `PartitionManager` | Swallows messages sent across an active partition boundary |
| **Crash** | via chaos engine | Drops messages directed to crashed nodes at send and delivery time |

Example configuration:

```ts
import { SimNetwork } from "@sx4im/chronos-net";

simTest(
  "handles network faults",
  {
    seeds: 1000,
    nodes: 3,
    netFactory: (ctx) =>
      new SimNetwork({
        ...ctx,
        config: {
          minLatency: 1,
          maxLatency: 50,
          dropProb: 0.05,
          dupProb: 0.05,
        },
      }),
  },
  body
);
```

When `netFactory` is omitted, `@sx4im/chronos-core` uses `BasicNetwork`. `BasicNetwork` handles partitions, crashes, and deterministic latency without requiring external dependencies, but does not inject packet drops or duplicates.

## The chaos engine

The chaos engine runs as a per-step hook inside the simulator:

```ts
simTest(
  "handles cluster chaos",
  {
    seeds: 1000,
    nodes: 5,
    chaos: {
      partitionProb: 0.02, // probability per step to start a partition
      crashProb: 0.02, // probability per step to crash a node
      restartProb: 0.05, // probability per step to restart a crashed node
      maxPartitionMs: 100, // maximum partition duration
      maxCrashFraction: 0.5, // maximum fraction of nodes allowed to crash simultaneously
    },
  },
  body
);
```

- **Partitions**: isolates nodes into non-communicating sets for a virtual time window.
- **Crashes**: stops timers and drops incoming messages for a target node. `maxCrashFraction` prevents total cluster failure.
- **Restarts**: restores a crashed node to active state.

Chaos actions emit trace events (`partition`, `crash`, `restart`), recorded in the event trace for replay and inspection.

## Deterministic execution

Latency calculations, drop decisions, duplication decisions, partition timing, and node crash selections derive from the PRNG. Runs containing network faults replay identically given the same seed and configuration.
