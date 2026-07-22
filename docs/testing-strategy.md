# 07 — Testing Strategy (how to test a testing framework)

Chronos is a tool for finding bugs, so its own correctness bar is unusually high. The meta-challenge: **a testing framework whose results aren't trustworthy is worse than useless.** This document defines the layers of tests that keep Chronos honest.

---

## 7.1 The hierarchy

1. **Unit tests** — each primitive in isolation (RNG, clock, heap, scheduler).
2. **The determinism guard** — the single most important test; proves same-seed ⇒ same-trace.
3. **Property tests** — invariants over the framework itself (e.g., scheduler never runs a canceled event).
4. **Dogfood tests** — run *known-buggy* and *known-correct* systems through Chronos and assert it catches the former and clears the latter.
5. **Replay tests** — saved capsules re-run and reproduce identically.
6. **Regression corpus** — every real bug Chronos ever finds becomes a saved seed/capsule test.

---

## 7.2 The determinism guard (the soul of the project)

Already specified in `technical-spec.md` §3.11 and built in Phase 1.4. Restated because it's that important:

- Run a non-trivial scenario (multiple nodes, sleeps, RNG draws, message passing) with seed `S` → record the full ordered trace.
- Run again with the same `S` → record again.
- Assert the two traces are **deeply equal**.
- Parameterize across many seeds; run in CI on every push.

**Operating rule:** if this test ever fails or flakes, *everything else stops* until it's green. A determinism failure means some component is reading hidden entropy (a stray `Date.now`, `Math.random`, `Set`/`Map` iteration over non-deterministically-inserted keys, real I/O, or a real timer). Hunt it down. This hunt *is* the senior systems work — and a great war story for interviews.

### Common determinism leaks to check for
- A component calling `Math.random()` instead of the sim RNG.
- Reading `Date.now()`/`performance.now()` instead of `clock.now()`.
- Iterating a `Set`/`Map` whose insertion order depends on nondeterministic input (insertion order itself is spec-deterministic in JS, but if *what you inserted and in what order* varied, iteration varies).
- `Object` key ordering surprises (integer-like keys sort numerically).
- Floating-point: ensure the same operations run in the same order (they will, if the schedule is deterministic).
- A real `setTimeout`/`setInterval`/`setImmediate` leaking user timing (only the single drain barrier is allowed).
- Async ordering depending on real I/O completion (must be simulated).

---

## 7.3 Dogfood: the two-sided test

For confidence that Chronos *finds* bugs and doesn't *cry wolf*, maintain two reference systems:

- **Known-buggy counter** (Phase 2.2): has a real concurrency defect. Chronos **must** find a violating seed under loss/reorder/chaos. If a refactor makes Chronos stop finding it, that's a regression in Chronos's detection power.
- **Known-correct counter**: a properly idempotent, conflict-free version (e.g., a grow-only counter / CRDT). Chronos **must not** report violations across thousands of seeds + chaos. False positives here mean the simulator is corrupting state or the invariant harness is wrong.

The flagship **Raft-lite** (Phase 6) extends this: Raft's safety properties are well-known, so it's a credible target. Finding a subtle bug there is a headline result; confirming safety across massive seed sweeps is also a legitimate, publishable outcome.

---

## 7.4 Property tests for the framework itself

Use these invariants on Chronos's internals:

- The scheduler never executes a canceled event.
- Popped events are monotonically non-decreasing in `(time, seq)`.
- `clock.now()` never decreases.
- `Rng.getState`/`setState` perfectly round-trips (resumed sequence is identical).
- A message marked dropped never produces a deliver event.
- A partitioned pair exchanges zero messages within the partition window and can exchange after healing.
- Total events processed equals events scheduled minus canceled (accounting check).

---

## 7.5 Replay & regression corpus

- Every capsule that reproduces a violation becomes a committed fixture under `packages/*/test/fixtures/`.
- A `replay.test.ts` loads each fixture, replays it, and asserts the same outcome — so future refactors can't silently change behavior.
- When Chronos finds a real bug in an external library, save that seed/capsule (and a minimal reproduction) as both a regression test and blog material.

---

## 7.6 CI matrix

- Run on Node **20 and 22** (and the current LTS when newer) to catch version-specific event-loop differences — *especially* relevant for `drainMicrotasks`, since microtask/`setImmediate` interaction is exactly where runtime versions can differ.
- Run lint + typecheck + unit + determinism + dogfood on every push/PR.
- Nightly (optional): a longer `chronos sweep` across many seeds on the dogfood systems to catch rare violations and performance regressions.

---

## 7.7 What "trustworthy" means here

You can claim Chronos is trustworthy when:
1. The determinism guard is green across Node versions and hundreds of seeds.
2. The known-buggy dogfood is reliably caught and the known-correct one is never falsely flagged.
3. Every saved capsule replays identically.
4. The property tests for internals all pass.

Hold this bar publicly (badge the determinism guard in the README) — it signals the seriousness that makes senior engineers trust and contribute to the project.
