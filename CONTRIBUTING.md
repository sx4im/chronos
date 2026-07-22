# Contributing to Chronos

Thanks for being interested — Chronos is young, and good contributions land hard.

## The one rule

**Determinism is the product.** Any change that can make the same seed produce a
different trace is a bug, no matter how small. The whole point of the framework
is: *same seed ⇒ byte-identical run, forever*. Run `pnpm test` — the determinism
guard (`packages/core/test/determinism.test.ts`) must stay green. It is
**bug class #1**; if it ever fails or flakes, stop everything else and fix it first.

So: **never** introduce real time, real randomness, real timers, or real I/O into
any code path that runs *inside* a simulation. Use the injected `env`:

| Don't (in simulated code)                  | Use instead                          |
| ------------------------------------------ | ------------------------------------ |
| `Date.now()` / `new Date()` / `performance.now()` / `process.hrtime()` | `env.now()` |
| `Math.random()` / `crypto.random*`         | `env.random()`                      |
| `setTimeout` / `setInterval` / `setImmediate` | `env.setTimeout()` / `env.sleep()` (the **only** allowed real primitive is the single `setImmediate` microtask-drain barrier in `packages/core/src/scheduler.ts`) |
| real sockets / `fs` / network              | `env.net` (the simulated network)  |

The same business logic runs in production via a `RealEnv` with the same
`SimEnv` interface — only the `env` differs. Keep `@sx4im/chronos-core` **zero runtime
dependencies**; don't loosen TypeScript strictness to make something compile —
fix the types.

## Setup

```bash
git clone <repo> && cd chronos
pnpm install           # pnpm@9, Node >=20
pnpm test              # the full green bar (typecheck + lint + test + build below)
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Vitest is the test runner; `pnpm test:watch` for iteration. The Inspector is a
Vite app (`packages/inspector`) — `pnpm --filter @sx4im/chronos-inspector dev`.

## Where to help (good first issues)

- **New fault types** — clock skew, slow disk, message corruption, byzantine
  delivery. Add a fault to `@sx4im/chronos-net` and a focused test.
- **More dogfood systems** — a CRDT, a two-phase-commit coordinator, a gossip
  protocol, a sharded KV. Each lives under `examples/` and ships a `simTest`
  with a safety invariant. (Raft-lite is the template.)
- **Inspector views** — a state-diff panel, an export-to-PNG, a capsule
  side-by-side compare. `packages/inspector/src` (pure logic in `capsule.ts`,
  React in the views).
- **Adapters** — a Jest integration beside `@sx4im/chronos-vitest`; a real-transport
  adapter so a popular library (e.g. `ws`, `@grpc/grpc-js`) can run under
  Chronos in tests and over a real socket in prod.
- **WASM RNG** — the hot path is the BigInt xoshiro256\*\*; a Rust/WASM
  implementation behind the same `Rng` interface, feature-flagged, with the
  pure-TS fallback kept as default. (Phase 6.2.)

## PR checklist

- [ ] Determinism guard passes (`pnpm test`)
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all green, zero errors
- [ ] New behavior has tests — and, if it fixes a found bug, a saved failure
      capsule under `.chronos/failures/` plus a regression test that replays it
- [ ] No new runtime dependencies in `@sx4im/chronos-core`
- [ ] No real time/entropy/timers/sockets introduced into simulated paths
- [ ] Conventional Commit messages (`feat:`, `fix:`, `test:`, `docs:`)

## Commit + history conventions

- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `test:`, `chore:`,
  `refactor:`). Small commits after each green milestone, not one big dump.
- One concept per file; match the layout in `docs/architecture.md`.
- Don't push force-rewrites over `main`/`master`; branch + PR.

## Reporting a bug Chronos found

That's the best kind of issue — and the framework makes it reproducible by
design. If you hit a `simTest` violation in CI, the `failure-capsules-<run>`
artifact contains `<seed>.json`. Attach it (or just the seed + the scenario
module) so a maintainer can `chronos replay <seed>.json` and see the exact
failing run in the Inspector.

Thanks again — and remember the one rule. **Determinism is the product.**
