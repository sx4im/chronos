# <img src="./assets/logo.svg" alt="Chronos Logo" width="32" height="32" align="absmiddle" style="vertical-align: middle; margin-right: 8px;" /> Chronos

**Deterministic Simulation Testing (DST) Framework for Node.js & TypeScript**

[![npm version](https://img.shields.io/npm/v/@sx4im/chronos-core.svg?color=indigo)](https://www.npmjs.com/package/@sx4im/chronos-core)
[![npm downloads](https://img.shields.io/npm/dm/@sx4im/chronos-vitest.svg?color=blue)](https://www.npmjs.com/package/@sx4im/chronos-vitest)
[![CI status](https://github.com/sx4im/chronos/actions/workflows/ci.yml/badge.svg)](https://github.com/sx4im/chronos/actions/workflows/ci.yml)
[![determinism guard](https://img.shields.io/badge/determinism%20guard-passing-brightgreen)](./packages/core/test/determinism.test.ts)
[![good first issues](https://img.shields.io/badge/good%20first%20issues-available-7057ff.svg)](./GOOD_FIRST_ISSUES.md)
[![Zero Dependencies](https://img.shields.io/badge/core%20runtime%20deps-0-success)](./packages/core)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-native-FCC72B?logo=vitest&logoColor=black)](https://vitest.dev/)
[![Node >=20](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/sx4im/chronos?style=social)](https://github.com/sx4im/chronos)

> **Find 1-in-a-million race conditions in concurrent & distributed systems and replay them bit-for-bit from a single integer seed.** Inspired by FoundationDB & TigerBeetle, built natively for TypeScript & Node.js.

---

## In 30 Seconds: The Problem Chronos Solves

Distributed race conditions, split-brain partitions, and timer bugs fail once in CI and refuse to reproduce locally because wall clocks, OS thread scheduling, and socket I/O are non-deterministic.

**Chronos removes external entropy and runs your concurrent cluster on a single controlled thread:**

* **Virtual Time**: Advances simulated hours in milliseconds when the next scheduled event fires, with zero real-time waiting.
* **Seeded PRNG**: `xoshiro256**` seeded by `SplitMix64` drives every random draw, network delay, and scheduling tiebreak from one integer seed.
* **Simulated Chaos Network**: Injects latency jitter, packet drops, duplicate deliveries, network partitions, and node crash/restart cycles.
* **Strict Entropy Guards**: Intercepts accidental calls to `Date.now()`, `Math.random()`, `performance.now()`, `process.hrtime()`, and global timers (`route` mode by default, `throw` mode via `CHRONOS_STRICT=throw`).
* **Failure Capsules & Replay**: When an invariant fails across a seed sweep, Chronos writes a `.chronos/failures/<seed>.json` capsule. `chronos replay <capsule> <scenario>` reproduces the exact execution trace.

---

## Explainer Video

[![Watch the Explainer Video](./assets/video-thumbnail.jpg)](https://www.youtube.com/watch?v=7d9_jUrygKM)

---

## Table of Contents

- [Why Chronos?](#why-chronos)
- [The Magic Moment](#the-magic-moment)
- [When to Use Chronos](#when-to-use-chronos)
- [Key Features](#key-features)
- [Quickstart & Installation](#quickstart--installation)
- [Architecture & System Flow](#architecture--system-flow)
- [How Deterministic Simulation Testing (DST) Works](#how-deterministic-simulation-testing-dst-works)
- [Simulated Environment vs Real Environment](#simulated-environment-vs-real-environment)
- [Packages Overview](#packages-overview)
- [CLI Reference](#cli-reference)
- [Examples & Reference Implementations](#examples--reference-implementations)
- [Comparison: Chronos vs Traditional Testing vs Madsim / Turmoil](#comparison-chronos-vs-traditional-testing-vs-madsim--turmoil)
- [Security](#security)
- [Contributing & Good First Issues](#contributing--good-first-issues)
- [License](#license)

---

## Why Chronos?

Distributed systems, consensus protocols, and CRDTs fail at the boundaries:
- **Network drops and reordering** deliver messages out of order.
- **Network partitions** cause split-brain elections or stale reads.
- **Timer races** trigger overlapping leader elections or premature transaction aborts.
- **Retries** produce duplicate writes that break non-idempotent handlers.

Mock clocks only test a single node synchronously, while multi-container chaos tests take minutes and never replay the same interleaving twice. Chronos brings the Deterministic Simulation Testing (DST) model from FoundationDB and TigerBeetle to Node.js and Vitest.

---

## The Magic Moment

Write your distributed safety invariants once with `simTest`:

```ts
import { simTest, expectInvariant } from "@sx4im/chronos-vitest";

// Run 500 randomized seeds across 3 simulated nodes under network chaos
simTest("distributed counter never loses increments", {
  seeds: 500,
  nodes: 3,
  network: { dropProb: 0.05, dupProb: 0.01 },
  chaos: { partitionProb: 0.05, crashProb: 0.02 },
}, async (sim) => {
  // Interact with injected SimEnv on each simulated node
  for (const node of sim.nodes) {
    node.env.net.send("counter-service", { type: "INCREMENT", amount: 1 });
  }
  
  await sim.settle();
  expectInvariant("no lost increments", () => total === expected);
});
```

When an invariant breaks, Chronos isolates the exact reproducing seed and creates a failure capsule:

```text
✗ seed 8273461 violated "no lost increments" — total=99, expected=100
  → Failure capsule saved: .chronos/failures/8273461.json
  → Replay command: npx chronos replay .chronos/failures/8273461.json
  → Interactive visual inspector: npx chronos open .chronos/failures/8273461.json
```

---

## When to Use Chronos

| Use Case | What Chronos Tests | Example Systems |
| :--- | :--- | :--- |
| **Distributed Consensus & Coordination** | Split-brain elections, term increments, log divergence, uncommitted entry recovery | Raft, Paxos, Zab, Bully algorithm |
| **Local-First & CRDTs** | Convergence under out-of-order packets, concurrent edits, last-writer-wins tiebreakers | Automerge, Yjs, collaborative canvases, state-based CRDTs |
| **Distributed Transactions** | Two-phase commit (2PC) abort safety, coordinator crashes, participant timeouts | Sagas, distributed KV stores, payment settlement |
| **Microservice Event Workflows** | Idempotency under duplicate delivery, dead-letter recovery, retry storm backoff | Kafka/RabbitMQ consumer groups, SQS workflows, BullMQ |
| **Gossip & P2P Protocols** | Peer discovery, anti-entropy state synchronization, epidemic dissemination | HashiCorp Serf/Memberlist, BitTorrent DHT |
| **Network Protocol Drivers & WebSockets** | Heartbeat timeouts, connection drops, reconnect state reconciliation | Real-time gaming, financial exchange adapters |

---

## Key Features

* **Deterministic Execution**: `Same Seed => Identical Event Trace`.
* **Simulated Fault-Injecting Network**: Injects latency jitter, packet loss, reordering, duplicate delivery, network partitions, and node crash/restart lifecycles.
* **Vitest Integration**: Run seed sweeps inside standard Vitest suites with `simTest` and `replayTest`.
* **Time-Travel Inspector**: Serve a local web UI (`chronos open`) to scrub timeline events, inspect message flows, and view sequence diagrams and link matrices.
* **Optional LLM Failure Summaries**: `chronos explain` summarizes a failing trace using OpenAI, Anthropic, Gemini, or any OpenAI-compatible endpoint (`LLM_BASE_URL`).
* **Zero Runtime Dependencies in Core**: `@sx4im/chronos-core` has no external runtime dependencies.

---

## Quickstart & Installation

Install the Vitest integration and CLI toolkit:

```bash
# Using pnpm
pnpm add -D @sx4im/chronos-vitest @sx4im/chronos-cli

# Using npm
npm install --save-dev @sx4im/chronos-vitest @sx4im/chronos-cli

# Using yarn
yarn add -D @sx4im/chronos-vitest @sx4im/chronos-cli
```

### Running Your First DST Test

Add a test file `distributed.test.ts`:

```ts
import { simTest, expectInvariant } from "@sx4im/chronos-vitest";

simTest("cluster reaches consensus under chaos", { seeds: 500, nodes: 5 }, async (sim) => {
  // Access node environments via sim.nodes[i].env:
  //   env.now()          -> Deterministic virtual clock time
  //   env.random()       -> Seeded PRNG random number (0..1)
  //   env.uuid()         -> Deterministic RFC 4122 v4 UUID
  //   env.sleep(ms)      -> Virtual time sleep
  //   env.setTimeout()   -> Virtual timer handle
  //   env.net.send()     -> Simulated fault-injecting network
  
  await sim.settle();
  expectInvariant("single leader per term", () => countLeaders(sim) <= 1);
});
```

Run tests with Vitest:

```bash
npx vitest run
```

If a bug is found, inspect it with the Chronos CLI:

```bash
npx chronos replay .chronos/failures/<seed>.json    # Replay reproduction
npx chronos trace  .chronos/failures/<seed>.json    # View execution timeline
npx chronos open   .chronos/failures/<seed>.json    # Open Visual Time-Travel Inspector
```

---

## Architecture & System Flow

Chronos coordinates virtual time, seeded PRNG, discrete event scheduling, simulated fault-injecting networks, entropy guards, test execution, and visual inspection in a unified ecosystem:

```mermaid
flowchart TB
    subgraph CoreEngine["@sx4im/chronos-core (Zero Runtime Dependencies)"]
        Seed["Integer Seed (e.g. 8273461)"] --> SplitMix["SplitMix64 Initializer"]
        SplitMix --> PRNG["xoshiro256** PRNG"]
        
        PRNG --> Clock["Virtual Clock (advance on event tick)"]
        PRNG --> Latency["Network Latency / Chaos Jitter"]
        
        Clock --> MinHeap["MinHeap Priority Event Queue\nOrdered by (time, seq)"]
        
        MinHeap --> MicrotaskBarrier["Microtask Barrier\n(setImmediate drain per tick)"]
        
        MicrotaskBarrier --> SimEnv["SimEnv Injected Interface\n• env.now() / env.random() / env.uuid()\n• env.sleep / setTimeout\n• env.net.send"]
        
        SimEnv --> StrictGuards["Strict Safety Guards (installGuards)\nRoutes or throws on Date.now, Math.random, native timers"]
    end

    subgraph NetLayer["@sx4im/chronos-net (Fault Injection & Network)"]
        SimEnv --> NetFactory["SimNetwork Delivery Engine"]
        NetFactory --> LatencyJitter["Latency Jitter Simulator"]
        NetFactory --> LossEngine["Packet Drop & Duplicate Engine"]
        NetFactory --> Partitions["PartitionManager (Split-Brain Splits)"]
        NetFactory --> Lifecycle["Crash & Restart Lifecycle Manager"]
    end

    subgraph VitestRunner["@sx4im/chronos-vitest (Test Execution & Invariants)"]
        NetLayer --> SimTestRunner["simTest Seed Sweeper (1..N seeds)"]
        SimTestRunner --> SafetyInvariants["expectInvariant Evaluator"]
        SafetyInvariants -->|Invariant Failed| Shrinker["Delta-Debugging Trace Shrinker"]
        Shrinker --> CapsuleWriter["Failure Capsule Storage\n(.chronos/failures/<seed>.json)"]
    end

    subgraph DevTools["Developer Experience & Visual Tooling"]
        CapsuleWriter --> CLI["@sx4im/chronos-cli"]
        CLI --> ReplayCmd["chronos replay (Bit-for-bit reproduction)"]
        CLI --> TraceCmd["chronos trace (ASCII timeline export)"]
        CLI --> InspectorServer["@sx4im/chronos-inspector (chronos open)"]
        CLI --> AIExplainer["chronos explain (Multi-Provider LLM Diagnostics)"]
        
        InspectorServer --> ReactUI["React + Vite Time-Travel Dashboard\n• Timeline scrubber\n• Sequence diagrams\n• State & event metrics"]
        AIExplainer --> LLMProviders["AI APIs: OpenAI, Anthropic, Gemini,\nOpenAI-Compatible Endpoints"]
    end

    subgraph ProductionDual["Production Runtime Seam"]
        RealEnv["RealEnv (Production Seam)\n• Date.now()\n• crypto.randomBytes CSPRNG\n• Real TCP/HTTP transport"]
        SimEnv -. Same API Interface .- RealEnv
    end
```

---

## How Deterministic Simulation Testing (DST) Works

JavaScript runtimes (V8 / Node.js) are naturally single-threaded and deterministic for synchronous logic. Non-determinism enters through:

1. **System Clocks**: `Date.now()`, `performance.now()`, `process.hrtime()`
2. **Entropy Sources**: `Math.random()`, `crypto.getRandomValues()`
3. **Async Event Scheduling**: Non-deterministic OS socket I/O, timer scheduling, and microtask interleaving.

Chronos strips out these sources of non-determinism and wraps your system inside a single-threaded discrete event simulator:

1. **Seeded PRNG**: All randomness derives from a single `xoshiro256**` generator seeded by `SplitMix64`.
2. **MinHeap Priority Queue**: Events (timers, network packet deliveries, node crashes) are ordered by `(time, insert_sequence)`.
3. **Microtask Barrier**: Microtasks drain deterministically between discrete scheduler ticks via a controlled barrier.

---

## Simulated Environment vs Real Environment

Chronos provides a unified `Environment` contract (`SimEnv` in tests, `RealEnv` in production):

| Code Pattern | In Simulated DST (`SimEnv`) | In Production (`RealEnv`) |
| :--- | :--- | :--- |
| **Clock** | `env.now()` | `Date.now()` |
| **Randomness** | `env.random()` | Cryptographic float (53-bit CSPRNG) |
| **UUID** | `env.uuid()` (Deterministic RFC 4122 v4) | `crypto.randomUUID()` |
| **Sleep** | `await env.sleep(ms)` | `await new Promise(r => setTimeout(r, ms))` |
| **Timer** | `env.setTimeout(cb, ms)` | `setTimeout(cb, ms)` |
| **Networking** | `env.net.send(to, msg)` | Real TCP / HTTP / WebSocket transport |

The strict safety guards (`installGuards()`) automatically throw an exception if code inside a simulation attempts to call native non-deterministic APIs directly.

---

## Packages Overview

Chronos is organized as a modular TypeScript monorepo:

| Package | Version | Description |
| :--- | :--- | :--- |
| **[`@sx4im/chronos-core`](./packages/core)** | [![npm](https://img.shields.io/npm/v/@sx4im/chronos-core.svg)](https://www.npmjs.com/package/@sx4im/chronos-core) | Core DST Engine (`PRNG`, `VirtualClock`, `MinHeap`, `Scheduler`, `SimEnv`, `RealEnv`, strict guards). Zero dependencies. |
| **[`@sx4im/chronos-net`](./packages/net)** | [![npm](https://img.shields.io/npm/v/@sx4im/chronos-net.svg)](https://www.npmjs.com/package/@sx4im/chronos-net) | Simulated network layer (latency, drop, duplicate, partition splits, crash/restart lifecycle). |
| **[`@sx4im/chronos-vitest`](./packages/vitest)** | [![npm](https://img.shields.io/npm/v/@sx4im/chronos-vitest.svg)](https://www.npmjs.com/package/@sx4im/chronos-vitest) | Vitest runner integration (`simTest`, `expectInvariant`, `replayTest`, capsule I/O, failure shrinker). |
| **[`@sx4im/chronos-cli`](./packages/cli)** | [![npm](https://img.shields.io/npm/v/@sx4im/chronos-cli.svg)](https://www.npmjs.com/package/@sx4im/chronos-cli) | Command-line toolkit (`replay`, `trace`, `sweep`, `shrink`, `open`, `explain`, `stats`, `check`, `export`, `doctor`). |
| **[`@sx4im/chronos-inspector`](./packages/inspector)** | [![Private](https://img.shields.io/badge/status-ready-brightgreen)](./packages/inspector) | Web-based time-travel visual debugger (React + Vite UI). |

---

## CLI Reference

`@sx4im/chronos-cli` inspects and replays simulation traces and failure capsules:

```bash
npx chronos <command> [options]
```

### Main Commands:

* **`chronos doctor`**: Check Node.js version, inspector assets, and static DST compliance.
* **`chronos check [paths...]`**: Scan TypeScript/JavaScript source files for non-deterministic globals.
* **`chronos replay <capsule> [scenario]`**: Re-run a failure capsule against its scenario to verify bit-for-bit reproduction.
* **`chronos trace <capsule>`**: Print an ASCII timeline of scheduled events, message deliveries, and faults.
* **`chronos sweep <scenario> [seeds]`**: Run a scenario module across $N$ seeds and write a capsule for the first violation.
* **`chronos shrink <capsule> <scenario>`**: Reduce chaos probabilities and step count to the smallest reproducing failure.
* **`chronos open <capsule>`**: Launch the local time-travel inspector preloaded with a capsule.
* **`chronos explain <capsule>`**: Summarize a failure capsule via OpenAI (`OPENAI_API_KEY`), Anthropic (`ANTHROPIC_API_KEY`), Gemini (`GEMINI_API_KEY`), or any OpenAI-compatible endpoint (`LLM_BASE_URL`).
* **`chronos stats <capsule>`**: Print event counts, delivery/drop/duplicate rates, and latency bounds.
* **`chronos export <capsule> --format markdown|csv`**: Export trace timelines to Markdown or CSV.

---

## Examples & Reference Implementations

Reference distributed-system implementations in [`examples/`](./examples) tested under fault injection:

| System / Algorithm | Directory | Tested Invariants | Chaos Injected | Seeds Verified |
| :--- | :--- | :--- | :--- | :--- |
| **Raft Consensus** | [`examples/raft-lite`](./examples/raft-lite) | • Single leader per term<br>• Log matching & commit index<br>• Term monotonicity | Drops, duplicates, partitions, node crashes | **2,000 seeds** (100% pass) |
| **CRDT (LWW-Register)** | [`examples/crdt`](./examples/crdt) | • Strong Eventual Consistency (SEC)<br>• LWW tiebreaker convergence | Packet loss, out-of-order reordering, partitions | **1,000 seeds** (100% pass) |
| **Gossip Protocol** | [`examples/gossip`](./examples/gossip) | • Anti-entropy key agreement<br>• Monotonic versioning across peers | Asymmetric partitions, packet drops, node crashes | **1,000 seeds** (100% pass) |
| **Two-Phase Commit (2PC)** | [`examples/twophase-commit`](./examples/twophase-commit) | • Transaction atomicity (never mixed commit/abort)<br>• Non-spontaneous commit | Participant crashes, coordinator timeouts | **1,000 seeds** (100% pass) |
| **Distributed Counter** | [`examples/counter`](./examples/counter) | • Exact increment totals<br>• Duplicate write idempotency | Message duplicates, packet drops | Failure capsule demo |

---

## Comparison: Chronos vs Traditional Testing vs Madsim / Turmoil

| Feature / Capability | Traditional Unit / Integration Tests | Jepsen / Chaos Mesh | Madsim / Turmoil (Rust) | Chronos (Node.js & TypeScript) |
| :--- | :--- | :--- | :--- | :--- |
| **Language** | Any | Clojure / Java | Rust | TypeScript / JavaScript |
| **100% Deterministic Replay** | No | No | Yes | **Yes (Bit-for-Bit)** |
| **Virtual Clock Fast-Forward** | Real time wait | Real time wait | Yes | **Yes (Instant)** |
| **Single-Thread Execution** | No | No | Yes | **Yes (Single-Thread V8)** |
| **Vitest / Jest Native** | Yes | No | No | **Yes (`simTest`)** |
| **Visual Time-Travel Inspector** | No | No | No | **Yes (`chronos open`)** |
| **AI Failure Explainer** | No | No | No | **Yes (`chronos explain`)** |

---

## Security

**A failure capsule is untrusted input.** Capsules exist to be shared — attached to an issue, produced by someone else's CI, handed to a teammate — so Chronos treats one exactly like a file from a stranger. Every capsule is fully validated at the read boundary, capsule paths are confined to your project, and capsule text is escaped separately for each place it is rendered (terminal, CSV, Markdown, and the Inspector's DOM).

One consequence worth stating outright: `env.random()` under `SimEnv` is a **seeded** PRNG. It is deterministic by design and therefore completely predictable — never use it as a source of secrets in a simulated run. The production `RealEnv` backs the same call with a CSPRNG, so the same application code is safe in production.

Read **[SECURITY.md](./SECURITY.md)** for the full threat model and how to report a vulnerability.

---

## Contributing & Good First Issues

See the [Good First Issues Catalog](./GOOD_FIRST_ISSUES.md) for scoped starter tasks, and read [CONTRIBUTING.md](./CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) before opening a pull request.

> **The Golden Rule**: *Determinism is the product.* Any change that causes a given seed to generate a different execution trace is a breaking bug.

### Contributors

Made with [contrib.rocks](https://contrib.rocks).

[![Contributors](https://contrib.rocks/image?repo=sx4im/chronos)](https://github.com/sx4im/chronos/graphs/contributors)

---

## License

[MIT License](./LICENSE) © Saim Shafique
