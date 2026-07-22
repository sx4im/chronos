# CLAUDE.md — Chronos

> This file is read by Claude Code on every session. It is the project's working memory. Keep it accurate as the project evolves.

## What this project is
**Chronos** is a **Deterministic Simulation Testing (DST)** framework for **Node.js / TypeScript**. It runs concurrent/distributed systems on a single controlled thread with virtualized time, seeded randomness, and a simulated network, so any bug — including rare races — reproduces **exactly** from a single integer seed. It's the FoundationDB/TigerBeetle technique, does not yet exist for JS/TS. (See `docs/architecture.md` and `docs/technical-spec.md`.)

## THE PRIME DIRECTIVE (never violate)
**Determinism is the product.** The entire system has exactly **one source of entropy** (the seeded PRNG) and exactly **one source of time** (the virtual clock). In any code that runs inside a simulation, you must **never** use:
- `Date.now()`, `new Date()`, `performance.now()`, `process.hrtime()` → use `clock.now()` / `env.now()`.
- `Math.random()` / `crypto` randomness → use the simulator's `Rng` / `env.random()`.
- real `setTimeout` / `setInterval` / `setImmediate` for user timing → use the scheduler / `env.sleep` / `env.setTimeout`. (The **only** allowed real primitive is a single `setImmediate` used as the microtask-drain barrier in `scheduler.ts`.)
- real sockets / `fs` / network → use the simulated network (`env.net`).

If the determinism guard test (`packages/core/test/determinism.test.ts`) ever fails or flakes, **stop all other work and fix it first.** It is bug class #1.

## The core mental model (why DST works here)
V8's execution is already deterministic given identical inputs. Nondeterminism enters Node only through external entropy: wall clock, OS scheduling, network/disk completion order, and `Math.random`. Chronos **removes all external entropy and serializes concurrency onto one thread**, so the program replays identically. We do **NOT** reFibers — we let V8's deterministic microtask draining happen between scheduler steps (via the single `setImmediate` barrier). Read `docs/architecture.md` §2.3 before changing scheduler/async code.

## The non-negotiable contract for users
The system-under-test must obtain its clock/random/network from an injected `env: SimEnv` (dependency injection). Strict-mode global guards exist as a safety net to catch accidental entropy, **not** as the primary mechanism. The same logic runs in production via a `RealEnv` with the same interface.

## Architecture (4 layers, build bottom-up)
1. `@sx4im/chronos-core` — Rng (xoshiro256**), VirtualClock, MinHeap, Scheduler, SimEnv, strict guards, invariants, trace, Simulator, RealEnv.
2. `@sx4im/chronos-net` — SimNetwork (latency/drop/dup), PartitionManager, chaos engine, crash/restart.
3. `@sx4im/chronos-vitest` (`simTest`, `expectInvariant`, `replayTest`) + `@sx4im/chronos-cli` (`replay`, `trace`, `sweep`, `shrink`, `open`).
4. `@sx4im/chronos-inspector` — Vite + React time-travel UI that loads a `Trace` JSON.

## Tech & conventions
- TypeScript **strict** (+ `noUncheckedIndexedAccess`), Node **>=20**, ESM-only internally.
- **pnpm** monorepo; **Vitest** for tests; **tsup** for builds; ESLint + Prettier.
- `@sx4im/chronos-core` has **zero runtime dependencies** — keep it that way.
- Conventional Commits (`feat:`/`fix:`/`docs:`/`test:`). Small commits after each green milestone.
- One concept per file; match the file layout in `docs/` (repo-structure).
- **Single responsibility per file**: keep files modular (<300 lines). Extract distinct concerns (e.g., CLI commands vs. HTTP server, marketing landing UI vs. inspector workspace app, simulator loop vs. chaos engine) into dedicated files.

## Key data contracts (stabilize these early)
- **`SimEnv`** interface — what user code depends on (now/random/sleep/setTimeout/net/nodeId).
- **`Trace` / `TraceEvent`** schema — what replay and the Inspector depend on. See `technical-spec.md` §3.8.
- A **failure capsule** = `{ seed, config }` (minimum to reproduce) + the `Trace` (for humans).

## Reference algorithms (don't reinvent differently)
- PRNG: **xoshiro256\*\*** seeded by **SplitMix64**, BigInt state, `nextFloat` from top 53 bits. (`technical-spec.md` §3.1.)
- Scheduler: min-heap of events ordered by **(time, seq)**; `seq` is a monotonic insert-order tiebreaker — never reorder/reuse it. (`§3.3`.)
- Microtask draining: a single `setImmediate` barrier per step (`§3.4`).
- Network delivery: `send` schedules a `deliver` event at `now + rng-latency`; reordering/faults emerge deterministically. (`§3.6`.)

## Definition of done per change
- Relevant unit tests added/updated and green.
- `pnpm typecheck && pnpm lint && pnpm test` all green.
- Determinism guard still green.
- No new entropy sources; no new runtime deps in `core`.
- If the change found/fixed a bug, save a capsule fixture and a regression test.

## What to optimize for
Correctness and determinism first; DX second; performance last (the known hot path is BigInt RNG — only address it in the planned Rust/WASM phase, keeping pure TS as the default).

## Things NOT to do
- Don't add an LLM/network dependency to the core. (An optional `chronos explain` command may call NVIDIA NIM, gated on `NVIDIA_API_KEY`, fully degradable, isolated from core.)
- Don't introduce real threads/workers in simulated paths.
- Don't reimplement Promises or fight the microtask queue.
- Don't loosen TypeScript strictness to make something compile — fix the types.

## Pointers
- Vision/scope: `docs/` (vision-and-prd).
- Deep design: `docs/technical-spec.md`.
- Build order & prompts: the build-plan doc.
- Testing bar: the testing-strategy doc.
