// @sx4im/chronos-vitest — DST integration for Vitest (§4.4):
//   simTest(name, opts, body)        — run a scenario across seeds; fail loudly
//                                       (seed + capsule path) on the first violation.
//   expectInvariant(name, predicate) — assert a property inside a sim body. The
//                                       zero-arg form is a sync post-condition (evaluated
//                                       immediately); the (world)=> form is a safety
//                                       invariant checked after every scheduler step.
//   replayTest(capsulePath, body?)   — re-run a saved capsule; with a body, the
//                                       determinism proof (violation recurs + trace is
//                                       bit-identical).
//
// The pure engine (`runSimTest`, `replayCapsule`, `resolveSeeds`, `executeScenario`)
// lives in `./engine.ts` — no Vitest import — so a non-test consumer (`@sx4im/chronos-cli`
// via the `@sx4im/chronos-vitest/engine` subpath) can replay without linking Vitest.

export { simTest, type SimTestFn } from "./simTest.js";
export { replayTest } from "./replayTest.js";
export { expectInvariant } from "./expectInvariant.js";
export {
  runSimTest,
  replayCapsule,
  shrinkCapsule,
  resolveSeeds,
  executeScenario,
} from "./engine.js";
export type { ShrinkConfig, ShrinkResult, ShrinkOptions } from "./engine.js";
export {
  writeCapsule,
  writeCapsuleTo,
  readCapsule,
  buildCapsule,
  validateCapsule,
  InvalidCapsule,
  type CapsuleWriteResult,
} from "./capsule.js";
export type {
  SimTestOptions,
  SimTestBody,
  FailureCapsule,
  ScenarioOutcome,
} from "./types.js";
