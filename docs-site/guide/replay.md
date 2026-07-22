# Replay and failure capsules

When a `simTest` sweep identifies a violating seed, Chronos outputs a failure capsule and logs the exact seed and file path. The capsule acts as an immutable reproduction artifact for sharing, issue tracking, and automated CI regression checks.

## Capsule structure

A capsule file is JSON containing the seed, network configuration, invariant failure details, and the event trace:

```jsonc
{
  "chronosVersion": "0.0.0",
  "seed": "42",
  "nodes": ["0", "1", "2"],
  "config": {
    "network": {
      "minLatency": 1,
      "maxLatency": 10,
      "dropProb": 0.15,
      "dupProb": 0.15,
    },
    "chaos": {
      "partitionProb": 0.02,
      "crashProb": 0.02,
      "restartProb": 0.05,
      "maxPartitionMs": 50,
      "maxCrashFraction": 0.34,
    },
  },
  "maxSteps": 10000,
  "invariant": { "name": "all counts equal", "detail": "n0=4 n1=5 n2=4" },
  "trace": {
    "seed": "42",
    "nodes": ["0", "1", "2"],
    "events": [/* … */],
    "result": "violation",
  },
}
```

Capsules are saved in `.chronos/failures/<seed>.json` by default. File writes are atomic, preventing partial outputs on process termination.

::: warning Capsule validation
Capsules loaded from external sources pass through strict schema validation for bounds, types, and ranges before the simulator initializes.
:::

## Replay workflows

### Command line interface

```bash
# Rebuild and run from seed and configuration
npx chronos replay .chronos/failures/42.json

# Pass the scenario file to verify matching trace output
npx chronos replay .chronos/failures/42.json ./scenario.ts
```

### Regression test in Vitest

```ts
import { replayTest } from "@sx4im/chronos-vitest";
import { body } from "./scenario.js";

// Fails if the run does not reproduce the exact invariant failure
replayTest("test/fixtures/capsules/counter-42.json", body);
```

### Programmatic API

```ts
import { replayCapsule } from "@sx4im/chronos-vitest";

const r = await replayCapsule(capsulePath, body, netFactory);
// r.reproduced === true when the violation and trace match
```

## Overriding seeds with `CHRONOS_SEED`

To run a specific seed locally without modifying test files:

```bash
CHRONOS_SEED=8273461 npx vitest run -t "counter never loses increments"
```

## Shrinking failure capsules

`chronos shrink` reduces complex chaos configurations to minimal reproduction cases:

```bash
npx chronos shrink .chronos/failures/42.json ./scenario.ts
```

The shrinker reduces partition, crash, and restart probabilities toward zero while performing a binary search for the smallest `maxSteps` threshold that still reproduces the failure. It writes the result to `<seed>.shrunk.json` without modifying the original file.

Key behavior:

- Candidates are accepted only if the identical named invariant fails.
- `dropProb` and `dupProb` configured inside `netFactory` closures remain unchanged.
- Shrinking operations are fully deterministic.
