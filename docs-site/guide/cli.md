# The CLI

The `@sx4im/chronos-cli` package provides the `chronos` command line tool for replaying, tracing, sweeping, inspecting, and auditing simulation tests.

```
chronos replay  <capsule> [scenario]   re-run a saved failure; verify bit-identical reproduction
chronos trace   <capsule>              print the recorded event timeline
chronos sweep   <scenario> [seeds]     run a scenario across N seeds (default 1000)
chronos shrink  <capsule> <scenario>   reduce a failing capsule's fault config to minimum
chronos open    <capsule>              open the time-travel Inspector preloaded with the capsule
chronos explain <capsule>              summarize the failure via NVIDIA NIM (requires NVIDIA_API_KEY)
chronos stats   <capsule>              display simulation event and network statistics
chronos check   [paths...]             scan source directories for unseeded global calls
chronos export  <capsule> [flags]      export trace timelines to Markdown tables or CSV files
chronos doctor                         verify local environment setup and Node version compatibility
```

## Scenario modules

A scenario module exports options and execution logic used by `simTest`:

```ts
// scenario.ts
import type { Simulator, NetworkFactory } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";

export const nodes = 3;
export const maxSteps = 10_000;
export const netFactory: NetworkFactory = (ctx) =>
  new SimNetwork({
    ...ctx,
    config: { minLatency: 1, maxLatency: 10, dropProb: 0.15, dupProb: 0.15 },
  });

export const body = (sim: Simulator) => {
  // initialize system using sim.nodes[*].env and add invariants
};
```

Recognized exports include `body` (required), `nodes`, `netFactory`, `network`, `chaos`, `maxSteps`, and `chronosDir`.

## `chronos replay`

```bash
chronos replay .chronos/failures/42.json              # re-run from seed and configuration
chronos replay .chronos/failures/42.json scenario.ts  # verify event-for-event match
```

Without a scenario file, the simulation is rebuilt from the capsule seed and configuration. When given a scenario module, `replay` executes the test body and verifies that the new trace matches the capsule output event for event.

## `chronos trace`

Prints the timeline of events from a capsule with virtual timestamps, including message sends, deliveries, drops, timer firings, crashes, restarts, and invariant failures.

## `chronos sweep`

```bash
chronos sweep scenario.ts 5000
```

Runs the scenario across seeds `0` to `N-1` and outputs a failure capsule for the first failing seed.

## `chronos shrink`

Reduces chaos parameters to minimal values. See [Shrinking failure capsules](/guide/replay#shrinking-a-capsule).

## `chronos open`

```bash
chronos open .chronos/failures/42.json
```

Starts the local Inspector UI web server preloaded with the capsule, displaying message sequence diagrams and event timelines.

## `chronos explain`

When `NVIDIA_API_KEY` is set in the environment, `explain` sends a structured failure summary to NVIDIA NIM and prints an explanation. If the key is missing, it logs a notice and exits cleanly.

## `chronos stats`

```bash
chronos stats .chronos/failures/42.json
```

Prints event frequency breakdowns, total message counts, delivery percentages, drop rates, duplication rates, and virtual latency bounds.

## `chronos check`

```bash
chronos check                    # scan packages/ and examples/
chronos check packages/core      # scan a specific directory
```

Scans source files (`.ts`, `.js`) for direct calls to `Math.random()`, `Date.now()`, `performance.now()`, or `setTimeout()` that bypass `SimEnv`. Test files and core scheduler files are excluded.

## `chronos export`

```bash
chronos export .chronos/failures/42.json --format markdown --output trace-report.md
chronos export .chronos/failures/42.json --format csv --output trace.csv
```

Exports the trace timeline to Markdown tables or CSV files.

## `chronos doctor`

```bash
chronos doctor
```

Verifies Node.js version requirements (>= 20), strict mode configuration status, and runs the compliance check across project directories.

## Environment variables

| Variable | Effect |
| --- | --- |
| `CHRONOS_SEED` | Sets a single seed for replay and sweep commands |
| `CHRONOS_DIR` | Sets output directory for `sweep` capsules (default `.chronos`) |
| `CHRONOS_STRICT` | Configures strict guard level (`route`, `throw`, or `off`) |
| `NVIDIA_API_KEY` | Enables `chronos explain` |
