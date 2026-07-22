---
layout: home
title: Chronos
hero:
  name: Chronos
  text: Deterministic simulation testing.
  tagline: "Find the race condition and replay it from a single seed."
  image:
    src: /assets/logo.svg
    alt: Chronos
  actions:
    - theme: brand
      text: 15-minute quickstart
      link: /guide/quickstart
    - theme: alt
      text: View on GitHub
      link: https://github.com/sx4im/chronos
features:
  - icon:
      src: /icons/target.svg
    title: Deterministic
    details: "The same seed yields a bit-identical run. Failure capsules reproduce violating traces from one integer seed on any machine."
  - icon:
      src: /icons/network.svg
    title: Simulated Network
    details: Latency, drops, duplicates, partitions, and crashes run from a seeded PRNG. Rare network failures reproduce on demand in unit tests.
  - icon:
      src: /icons/clock.svg
    title: Virtual Time
    details: "Time comes from one virtual clock. Sweeping millions of events takes seconds because sleeping costs no real CPU time."
  - icon:
      src: /icons/blocks.svg
    title: Composable
    details: "Built for Node 20 and TypeScript strict mode. Core has zero runtime dependencies. Ships as four npm packages plus the Inspector UI."
  - icon:
      src: /icons/inspect.svg
    title: Inspector UI
    details: "Replay failure capsules in the visual Inspector to step through events and inspect state at the exact millisecond of failure."
  - icon:
      src: /icons/shield.svg
    title: Safe by Default
    details: "Strict guards flag unseeded Date.now or Math.random calls before they corrupt a simulation. Failure capsules use schema validation on load."
---

## What is this?

Chronos brings deterministic simulation testing, used in systems like FoundationDB and TigerBeetle, to Node.js and TypeScript.

It runs concurrent or distributed code on a single controlled thread with virtual time, seeded randomness, and a simulated network. Any race condition reproduces consistently from one integer seed.

```ts
import { simTest, expectInvariant } from "@sx4im/chronos-vitest";

simTest(
  "counter never loses increments",
  {
    seeds: 100,
    nodes: 3,
    network: { dropProb: 0.05 },
    chaos: { partitionProb: 0.05, crashProb: 0.05 },
  },
  async (sim) => {
    for (const n of sim.nodes) n.env.net.send(/* … */);
    expectInvariant("no lost increments", () => total === expected);
  }
);
```

```
✗ seed 8273461 violated "no lost increments" (total=99, expected=100)
  -> wrote capsule: .chronos/failures/8273461.json
  -> replay with:   npx chronos replay .chronos/failures/8273461.json
```

A failing run reproduces identically on any machine. You can pass the capsule file to a teammate or load it in the Inspector UI to trace event delivery.

## Project layout

- [`@sx4im/chronos-core`](https://github.com/sx4im/chronos/tree/main/packages/core): PRNG (xoshiro256**), VirtualClock, MinHeap scheduler, SimEnv, strict guards, invariants, trace, and RealEnv. Zero runtime dependencies.
- [`@sx4im/chronos-net`](https://github.com/sx4im/chronos/tree/main/packages/net): Simulated network, partitions, chaos engine, and crash/restart handlers.
- [`@sx4im/chronos-vitest`](https://github.com/sx4im/chronos/tree/main/packages/vitest): `simTest`, `expectInvariant`, `replayTest`, failure capsules, and state shrinker.
- [`@sx4im/chronos-cli`](https://github.com/sx4im/chronos/tree/main/packages/cli): Commands for `replay`, `trace`, `sweep`, `shrink`, `open`, and `explain`.
- Inspector UI: Vite and React application for stepping through trace JSON files.

## Quickstart

```bash
pnpm add -D @sx4im/chronos-core @sx4im/chronos-net @sx4im/chronos-vitest @sx4im/chronos-cli
```

See the repository README for setup steps and the determinism checklist.

## Status

This site documents Chronos v0.0.0. Start with the [15-minute quickstart](/guide/quickstart), read [the determinism model](/concepts/determinism) for execution rules, or check the [API reference](/api/) for function signatures.
