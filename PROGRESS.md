# Chronos Progress Log

This document tracks the features, validation steps, and progress of the **Chronos** Deterministic Simulation Testing (DST) framework.

## Completed Features

### 1. `@sx4im/chronos-core` (Engine Layer)
- **Virtual Clock**: A virtual source of time that only advances when the scheduler processes future events. Strict bounds block backwards time travel or non-finite values.
- **PRNG**: xoshiro256** pseudorandom number generator seeded via SplitMix64. State snapshotting (`getState`/`setState`) is fully supported for deterministic checkpointing/restarts.
- **Min-Heap**: Binary min-heap implementation used as a priority queue by the scheduler.
- **Scheduler**: Controlled, single-threaded event loop executing events in `(time, seq)` order. Drains the Node.js microtask queue using a single `setImmediate` macro-task barrier per step.
- **Strict Mode Guards**: Global patches (`Date.now()`, `Math.random()`, `performance.now()`, `setTimeout`, `setInterval`) to redirect or throw on accidental entropy leaks.
- **Invariants**: Property-based safety invariants (checked after every step) and liveness invariants (checked at end-of-run).

### 2. `@sx4im/chronos-net` (Network Layer)
- **SimNetwork**: Virtual network implementation supporting latency injection, message dropping, and duplication.
- **PartitionManager**: Simulates network partitions (splitting nodes into groups) and resolves them dynamically.
- **Crash & Restart**: Enables simulation of node failures by canceling their pending events on crash and resuming them on restart.

### 3. `@sx4im/chronos-vitest` (Testing Layer)
- **Testing Primitives**: `simTest` and `replayTest` Vitest integrations.
- **Failure Capsules**: JSON-based serialization format containing `{ seed, config, nodes }` plus the `Trace`.
- **Capsule Security & I/O**: Atomic writes (`writeCapsuleTo` using temp file + rename) and safe parsing (`readCapsule` + strict schema validation) to prevent local file leaks, DoS, and logic corruption.
- **Expect Invariants**: In-body check helper `expectInvariant` to halt the simulation instantly on violations.

### 4. `@sx4im/chronos-cli` (CLI Tooling)
- `chronos doctor`: Runtime environment diagnosis (Node version, inspector asset availability, NVIDIA NIM configurations, and static DST compliance verification).
- `chronos sweep`: Runs a scenario across thousands of seeds to find first-violating inputs and output capsules.
- `chronos replay`: Re-runs a specific capsule to prove reproduction with bit-identical traces.
- `chronos shrink`: Coordinate descent probability reduction and binary-search step-shrinking to reduce chaos scenarios to minimal reproduction.
- `chronos trace`: ASCII timeline pretty-printing with customizable/TTY-gated coloring.
- `chronos open`: Launches the Inspector UI preloaded with a given capsule.
- `chronos explain`: Summarizes a failure in natural language using LLM inference (NVIDIA NIM).
- `chronos stats`: Generates detailed trace statistics (sends, delivers, drops, duplicate rates, latency bounds).
- `chronos check`: Static analysis compliance checker to find non-deterministic code blocks and global entropy references in source directories.
- `chronos export`: Converts trace event timelines to Markdown tables or CSV files.

### 5. `@sx4im/chronos-inspector` (Time-Travel UI)
- Vite + React web interface.
- Renders sequence diagrams, events, node statuses, and timelines.
- Interactive timeline scrubber to inspect system states chronologically.
- **Metrics & Link Matrix Dashboard**: Highlights total events, drop rate, duplicate rate, and fault counts. Offers an interactive node-to-node link matrix detailing traffic statistics and losses.

---

## Workspace Status

All components of the monorepo are fully operational and verified:
- **Build**: Successfully compiles ESM and TypeScript definitions (`dts`) across all packages.
- **Typecheck**: Zero TypeScript compile errors (`tsc --noEmit` is clean).
- **Lint**: Zero ESLint warnings or errors.
- **Tests**: All 191 tests are passing.
