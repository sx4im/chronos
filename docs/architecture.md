# 02 — Architecture

This document explains the *shape* of Chronos and, most importantly, **the determinism model** — the core idea that makes DST possible in Node. If you internalize §2.3, everything else follows.

---

## 2.1 The big picture

Chronos has four layers:

```
┌─────────────────────────────────────────────────────────────┐
│  4. INSPECTOR (React + Vite)                                 │
│     Time-travel UI: scrub the event timeline, see messages   │
│     between simulated nodes, replay a failing seed.          │
└───────────────▲─────────────────────────────────────────────┘
                │ reads trace.json (event log)
┌───────────────┴─────────────────────────────────────────────┐
│  3. HARNESS / RUNNER                                          │
│     - Vitest/Jest integration (`simTest`)                    │
│     - Runs N seeds, injects faults, checks invariants        │
│     - On failure → writes a "failure capsule" (seed + log)   │
│     - Replay mode (re-run one seed deterministically)        │
└───────────────▲─────────────────────────────────────────────┘
                │ drives
┌───────────────┴─────────────────────────────────────────────┐
│  2. SIMULATED WORLD                                          │
│     - Virtual Network (latency, partitions, drops, dupes)    │
│     - Virtual Nodes (each runs user logic; can crash/restart)│
│     - Virtual Disk/Storage (optional, later phase)           │
└───────────────▲─────────────────────────────────────────────┘
                │ built on
┌───────────────┴─────────────────────────────────────────────┐
│  1. DETERMINISTIC CORE (@sx4im/chronos-core)                       │
│     - Scheduler (single-threaded event loop you control)     │
│     - Virtual Clock (time advances only when scheduler says) │
│     - Seeded PRNG (xoshiro256**) — the one source of entropy │
│     - Deterministic async primitives (sleep, timeout, etc.)  │
│     - Strict-mode guards (trap accidental nondeterminism)    │
└─────────────────────────────────────────────────────────────┘
```

Layers 1–2 are the senior systems work. Layer 3 is the integration/DX work. Layer 4 is where your frontend strength shines. Build bottom-up.

---

## 2.2 Component responsibilities

- **Scheduler** — owns a priority queue of pending events keyed by `(virtualTime, sequenceNumber)`. It pops the earliest event, runs it, lets microtasks settle, and repeats until the queue is empty (or an invariant fails). It is the single-threaded "event loop" that replaces libuv for the system-under-test.
- **Virtual Clock** — `now()` returns simulated time. `sleep(ms)`/`setTimeout` schedule an event at `now + ms`. When no event is ready "now," the clock *jumps* to the next scheduled event's time. Result: a test that "sleeps" for an hour completes in microseconds.
- **Seeded PRNG** — a single deterministic generator. **Every** nondeterministic decision in the whole system draws from it: message latency, which fault to inject, tie-breaking between simultaneously-ready tasks, etc. One seed ⇒ one fully-determined run.
- **Async primitives** — `sleep`, `delay`, `timeout`, `Deferred`, plus channel/mailbox abstractions for inter-node messaging. User code uses these instead of raw `setTimeout`/sockets.
- **Strict-mode guards** — optional monkey-patches that make `Date.now()`, `Math.random()`, `new Date()`, and global `setTimeout` either route through the simulator or *throw*, so accidental real-world entropy is caught loudly instead of silently breaking determinism.
- **Virtual Network** — nodes don't open real sockets; they send messages through the simulator. A "send" schedules a "deliver" event at `now + latency`, where `latency` and any drop/duplicate/reorder is drawn from the PRNG. Partitions are time-windowed delivery blocks between node groups.
- **Virtual Nodes** — a node is a unit of user logic with an identity. The harness can "crash" a node (cancel its pending events), optionally persist its state, and "restart" it — all deterministically.
- **Harness/Runner** — the user-facing test API. Runs a scenario across many seeds, records the event log, asserts invariants after each step and at the end, and emits a failure capsule on violation.
- **Inspector** — a static React app that loads a `trace.json` and renders the run as an interactive timeline + message-sequence diagram.

---

## 2.3 THE DETERMINISM MODEL (read this twice)

This is the conceptual core. Most people get it wrong, so be precise.

### The naive (wrong) mental model
*"Chronos intercepts Promises and forces them to resolve in a fixed order."* You **cannot** robustly do this. The microtask queue that resolves Promises is owned by V8 and is not swappable. Trying to reimplement Promises leads to a fragile mess.

### The correct mental model

> **V8's execution is *already* deterministic given identical inputs. Nondeterminism enters a Node program only through external entropy: the wall clock, the OS, the network/disk completion order, `Math.random`, and OS thread scheduling. If you remove ALL of those external inputs and serialize all concurrency onto one controlled thread, the program replays identically — because nothing is left to vary.**

So Chronos does not fight Promises. It **removes external entropy** and **serializes concurrency**:

1. **Time** is virtual. The only clock is the scheduler's. `Date.now()` in strict mode returns virtual time.
2. **Randomness** comes only from the seeded PRNG. `Math.random()` in strict mode draws from it.
3. **Concurrency** is cooperative and single-threaded. There are no real worker threads in the simulated world; "parallel" nodes are just tasks interleaved by the scheduler in a seed-determined order.
4. **Network/IO** is simulated. Message delivery order is decided by the scheduler + PRNG, not by the OS.

Given those four, the remaining microtask ordering *within* a step is fully determined by the code itself and replays identically. **That is why DST works, and that is the sentence you say in interviews.**

### The unavoidable contract (this is non-goal N1 made concrete)
For this to hold, the system-under-test must obtain its clock, randomness, and network **from Chronos**, not from globals directly. Two ways Chronos supports this:

- **Dependency injection (recommended, robust):** user code receives an `env` object (`env.now()`, `env.random()`, `env.net.send()`, `env.sleep()`). In production they pass the real adapter; in tests they pass Chronos's simulated one. This is exactly how madsim/FoundationDB structure code.
- **Strict-mode global interception (safety net / quick start):** Chronos patches the relevant globals during a simulation so even code that *forgot* to use DI is captured (or throws on un-capturable entropy like reading a real socket). This lowers the barrier to entry and catches mistakes.

Design Chronos so DI is the blessed path and strict-mode is the guard rail. Make the docs hammer this point — it's the thing users must understand.

---

## 2.4 Data flow of a single simulation run

```
1. Harness creates a Simulator with seed S.
2. Harness spawns K virtual nodes, each given an `env` bound to the simulator.
3. Nodes start doing work: they call env.sleep / env.net.send / env.random.
   Each of these enqueues an event in the scheduler (a future wake-up,
   a future message delivery, etc.).
4. Scheduler loop:
     while queue not empty and no invariant broken:
        ev = queue.popEarliest()        // min by (time, seq)
        clock.now = ev.time             // time jumps forward
        ev.run()                        // user continuation runs to next await
        drainMicrotasks()               // Promise continuations settle
        maybe inject a fault (PRNG-decided)
        check invariants                 // e.g. "no two leaders at once"
5. On invariant failure → serialize {seed:S, eventLog} to a failure capsule.
6. On clean completion → optionally write trace.json for the inspector.
```

The same loop, same seed, produces the same sequence of `ev` forever. That's the guarantee.

---

## 2.5 Tech stack (and why)

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) on **Node 20+** | Your core stack; types matter for a library others build on. |
| Build | **tsup** (or unbuild) | Zero-config ESM+CJS bundling for a library. |
| Test runner | **Vitest** | Fast, TS-native, great DX; Chronos integrates *with* it. |
| Monorepo | **pnpm workspaces** | Clean separation of `core`, `net`, `vitest` integration, `inspector`. |
| PRNG | **xoshiro256\*\*** implemented in TS (BigInt) | High quality, long period, no deps — and writing it yourself is senior signal. |
| Inspector | **React + Vite + TypeScript** | Your frontend strength; renders the trace. |
| Hot path (Phase 4) | **Rust → WASM** (or napi-rs) | Optional perf; the "beyond your résumé" stretch. |
| Optional AI (Phase 4) | **NVIDIA NIM** (OpenAI-compatible) | "Explain this failure" using *your* free keys; core stays LLM-free. |
| CI / hosting | **GitHub Actions + GitHub Pages** | Free for open-source. |

---

## 2.6 Key architectural decisions (ADRs in brief)

- **ADR-1: Single-threaded cooperative scheduler, not real threads.** Real parallelism is the enemy of determinism. All concurrency is simulated by interleaving. (See §2.3.)
- **ADR-2: One PRNG, threaded everywhere.** A single seeded generator is the *only* entropy source. Never call `Math.random` internally; always draw from the simulator's RNG.
- **ADR-3: DI-first, strict-mode as guard rail.** Blessed path is injected `env`; global patching exists to catch mistakes and ease onboarding, not as the primary mechanism. (Non-goal N1.)
- **ADR-4: Virtual time jumps.** The clock skips idle periods to the next event so "slow" tests run instantly. Never block on real time.
- **ADR-5: The event log is the source of truth for replay and for the inspector.** Define its schema early (see `technical-spec.md` §3.8) and keep it stable.
- **ADR-6: Determinism is testable and tested.** A guard test reruns a seed N times and asserts identical traces; it must always be green. (See `testing-strategy.md`.)

Next, the deep dive: `technical-spec.md`.
