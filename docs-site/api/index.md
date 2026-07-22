# API reference

Package reference for Chronos modules. All packages target ESM on Node 20 or later.

## `@sx4im/chronos-vitest`

Vitest integration helpers for test suites.

### `simTest(name, opts, body)`

Registers a Vitest test that runs `body` across seeds and reports invariant violations with a seed and capsule path.

```ts
simTest(name: string, opts: SimTestOptions, body: (sim: Simulator) => void | Promise<void>)

interface SimTestOptions {
  seeds: number | bigint[];       // integer count [0..n-1] or explicit seed array
  nodes: number | string[];
  network?: Partial<NetworkConfig>;
  chaos?: ChaosConfig;
  netFactory?: NetworkFactory;    // injects SimNetwork from @sx4im/chronos-net for drop and duplicate faults
  maxSteps?: number;
  chronosDir?: string;            // capsule output directory (default: ".chronos")
}
```

The `CHRONOS_SEED` environment variable overrides `seeds` with a single seed value.

### `expectInvariant(name, predicate)`

Evaluates properties within a simulation body:

- **Sync predicate (`() => boolean`)**: checked immediately; throws `InvariantViolated` on `false`.
- **Safety predicate (`(world) => boolean`)**: registered as a safety invariant, evaluated after every scheduler step.

### `replayTest(capsulePath, body?)`

Registers a Vitest test that replays a saved capsule file. When passed a scenario `body`, it asserts that the invariant violation recurs with a bit-identical trace.

### Engine utilities (`@sx4im/chronos-vitest/engine`)

Programmatic execution functions used by CLI tools:

```ts
runSimTest(opts, body): Promise<ScenarioOutcome>   // seed sweep and capsule creation
replayCapsule(path, body?, netFactory?)            // returns { reproduced, violation?, trace }
shrinkCapsule(path, body, options?)                // returns ShrinkResult
executeScenario(sim, body)                         // single execution run with guards
resolveSeeds(opts): bigint[]
```

## `@sx4im/chronos-core`

Core execution primitives without external runtime dependencies:

| Export | Description |
| --- | --- |
| `Simulator` | Manages nodes, network, chaos, invariants, and tracing for a run |
| `Rng` | xoshiro256** PRNG initialized by SplitMix64 |
| `VirtualClock` | Monotonic virtual clock driven by the scheduler |
| `Scheduler` | Event min-heap ordered by `(time, seq)` |
| `MinHeap` | Underlying binary min-heap data structure |
| `createEnv` / `SimEnv` | Injected environment interface provided to node code |
| `BasicNetwork` | Default network handling latency, partitions, and crashes |
| `PartitionManager` | Tracks network partition groups and heal timestamps |
| `installGuards` | Strict mode global guards (`route` or `throw`) with `restore()` |
| `TraceLogger` / `Trace` / `TraceEvent` | Event log recording and serializing primitives |
| `Invariant` / `InvariantViolated` / `checkInvariant` | Invariant definition contracts |
| `CHRONOS_VERSION` | Version string written into capsule outputs |

### `Simulator` methods

```ts
const sim = new Simulator({ seed, nodes, network?, chaos?, netFactory?, maxSteps? });

sim.nodes            // [{ id, env }] array of node instances
sim.addInvariant({ name, kind: "safety" | "liveness", check })
await sim.run()      // executes until queue drains, an invariant fails, or maxSteps is reached
await sim.settle()   // drains pending events within a sim body
sim.scheduler        // provides access to the event queue
sim.trace            // provides access to TraceLogger
sim.crash(id) / sim.restart(id) / sim.partition(groups, ms)  // manual fault triggers
```

### Production adapter (`@sx4im/chronos-core/real`)

Provides `RealEnv` implementing `SimEnv` using `Date.now()`, `Math.random()`, native timers, and real socket transports.

## `@sx4im/chronos-net`

```ts
new SimNetwork({ ...ctx, config: NetworkConfig });
```

Fault-injecting network implementation supporting `minLatency`, `maxLatency`, `dropProb`, `dupProb`, network partitions, and node crashes.

## `@sx4im/chronos-cli`

The `chronos` command-line binary. See [The CLI](/guide/cli) for command documentation.

## Data schemas

Capsule and trace JSON schemas:

```ts
interface FailureCapsule {
  chronosVersion: string;
  seed: string;
  nodes: string[];
  config: { network: NetworkConfig; chaos: Required<ChaosConfig> };
  maxSteps: number;
  invariant: { name: string; detail: string };
  trace: Trace;
}

type TraceEvent =
  | { kind: "timer"; t: number; seq: number; nodeId?: string }
  | { kind: "wake"; t: number; seq: number; nodeId: string }
  | {
      kind: "send";
      t: number;
      seq: number;
      from: string;
      to: string;
      summary: string;
    }
  | {
      kind: "deliver";
      t: number;
      seq: number;
      from: string;
      to: string;
      summary: string;
    }
  | { kind: "crash"; t: number; seq: number; nodeId: string }
  | { kind: "restart"; t: number; seq: number; nodeId: string }
  | {
      kind: "partition";
      t: number;
      seq: number;
      groups: string[][];
      healAt: number;
    }
  | {
      kind: "invariant-violation";
      t: number;
      seq: number;
      name: string;
      detail: string;
    };
```
