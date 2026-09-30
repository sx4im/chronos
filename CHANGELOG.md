# Changelog

All notable changes to **Chronos** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-09-30

### Added
- **Deterministic UUID Generation**: Added `Rng.uuid()` and `SimEnv.uuid()`, generating RFC 4122 v4 UUIDs deterministically from the seeded PRNG.
- **Settle Outcome Visibility**: `Simulator.settle()` now returns `Promise<SchedulerRunResult>`, reporting `{ completed: boolean, steps: number }` so scenarios can verify whether the event heap reached quiescence.
- **Active Network Configuration Seam**: Added `getConfig()` method to `SimNetworkLike`, `BasicNetwork`, and `SimNetwork`, and exposed `config` inside `NetworkContext`.

### Fixed
- **In-Flight Partition Drops**: `SimNetwork` and `BasicNetwork` now check partition status at delivery time as well as send time, ensuring in-flight packets are dropped if a partition began while the packet was in transit.
- **Post-Settlement Invariant Evaluation**: `expectInvariant` now evaluates immediately against `sim.getWorld()` when registered after the event queue has already drained, eliminating silent false-positives.
- **Failure Capsule Configuration Accuracy**: `Simulator.configSnapshot()` now extracts the active network configuration from `net.getConfig?.()`, ensuring that custom drop/duplicate probabilities are accurately captured in failure capsules.
- **Scheduler Past-Time Event Guards**: `Scheduler.schedule()` throws early if an event timestamp is in the past (`time < clock.now()`), naming the offending timestamp and preventing heap ordering corruption.
- **Async Continuation Rejection Handling**: `Scheduler.run()` captures asynchronous Promise rejections in continuations, draining microtasks and surfacing errors cleanly through the simulation loop rather than triggering process-level unhandled rejections.
- **PRNG Zero-State Validation**: `Rng.setState()` validates that at least one state word is non-zero, preventing `xoshiro256**` from collapsing into an absorbing zero state.
- **CRDT Harness Anti-Entropy Convergence**: Added partition heal anti-entropy synchronization in `examples/crdt/harness.ts` to ensure eventual consistency verification runs cleanly.
- **CLI Sweep Input Validation**: `chronos sweep` validates that `--seeds` is a positive integer, rejecting negative or non-numeric arguments with a descriptive error.

---

## [0.2.0] - 2026-08-23

### Added
- **Timeout RunResult Status**: Clear distinction between successful completion (`status: "ok"`) and step-budget truncation (`status: "timeout"`).
- **Process High-Resolution Time Guard**: Strict mode support for `process.hrtime` and `process.hrtime.bigint()`.
- **CI Sweep Throttling**: Added `CHRONOS_MAX_SEEDS` environment variable to cap seed sweeps during fast CI pipelines.
- **Credential Redaction**: Redaction of JWTs, bearer tokens, passwords, and secrets in `chronos explain` summaries.

### Changed
- Upgraded to Vitest 4 and Vite 8 with clean audit pass.

---

## [0.1.0] - 2026-07-05

### Added
- Initial release of Chronos: Deterministic Simulation Testing (DST) framework for Node.js and TypeScript.
- `@sx4im/chronos-core`: Seeded `xoshiro256**` PRNG, `VirtualClock`, `MinHeap` scheduler, `SimEnv`, `RealEnv`, and strict-mode entropy guards.
- `@sx4im/chronos-net`: Simulated network with latency jitter, packet drops, packet duplicates, partitions, and node crash/restart lifecycle.
- `@sx4im/chronos-vitest`: Native Vitest integration with `simTest`, `expectInvariant`, `replayTest`, and delta-debugging trace shrinker.
- `@sx4im/chronos-cli`: Command-line interface with `replay`, `trace`, `sweep`, `shrink`, `open`, `stats`, `check`, `doctor`, and `explain`.
- `@sx4im/chronos-inspector`: Interactive web visualizer with timeline scrubber, message sequence diagrams, and link communication metrics.
