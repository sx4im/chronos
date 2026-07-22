// The pure replay/scenario engine (§4.4) — no Vitest import.
//
// `simTest` and `replayTest` (their own modules) are the thin Vitest wrappers
// over this engine. `@sx4im/chronos-vitest/engine` re-exports these functions so a
// non-test consumer — the `@sx4im/chronos-cli` bin — can replay a capsule without
// linking Vitest at runtime (the bin stays lean; importing the main barrel of
// `@sx4im/chronos-vitest` would transitively load `vitest` via the simTest/replayTest
// wrappers).

import {
  Simulator,
  InvariantViolated,
  installGuards,
  createEnv,
  noopNet,
  type NetworkFactory,
  type InstalledGuards,
  type StrictLevel,
  type SimEnv,
} from "@sx4im/chronos-core";
import type { SimTestBody, SimTestOptions, ScenarioOutcome } from "./types.js";
import { runWithActiveSim } from "./expectInvariant.js";
import { writeCapsule, readCapsule } from "./capsule.js";

// Re-export the JSON-serializable contract types so a subpath consumer
// (`@sx4im/chronos-cli` via `@sx4im/chronos-vitest/engine`) can type a capsule/driver
// without importing the main barrel (which would transitively load Vitest).
export type { FailureCapsule, SimTestBody, SimTestOptions, ScenarioOutcome } from "./types.js";

// Re-export the capsule I/O too: capsule.ts has no Vitest dependency (only
// node:fs and @sx4im/chronos-core), so surfacing it on the vitest-free `engine`
// subpath lets the CLI bin read/build/write capsules without linking Vitest.
export {
  readCapsule,
  buildCapsule,
  writeCapsule,
  writeCapsuleTo,
  validateCapsule,
  InvalidCapsule,
  type CapsuleWriteResult,
} from "./capsule.js";

// Re-export failure shrinking engine
export { shrinkCapsule, type ShrinkConfig, type ShrinkResult, type ShrinkOptions } from "./shrink.js";

/** The strict-mode level `executeScenario` installs around the body. Defaults to
 *  `route` — forgotten globals are redirected into the sim's own entropy sources
 *  (virtual clock + seeded RNG + scheduler), so a stray `Date.now()`/`Math.random()`
 *  can't silently turn a deterministic run nondeterministic. `CHRONOS_STRICT=throw`
 *  surfaces the contract violation loudly (CI); `CHRONOS_STRICT=off` disables it. */
function strictLevel(): StrictLevel | "off" {
  const v = process.env.CHRONOS_STRICT;
  if (v === "throw") return "throw";
  if (v === "off") return "off";
  return "route";
}

/** A SimEnv for the global guards: routing forgotten globals through the sim's
 *  actual clock/RNG/scheduler (with a sentinel nodeId and a no-op net) keeps the
 *  run deterministic — the one-entropy-source / one-time-source contract holds
 *  even when the SUT forgot the DI contract. A forgotten timer is scheduled with
 *  `__chronos_global__`; it fires during the flush but is never node-crashable. */
function globalEnv(sim: Simulator): SimEnv {
  return createEnv({
    scheduler: sim.scheduler,
    clock: sim.clock,
    rng: sim.rng,
    nodeId: "__chronos_global__",
    net: noopNet,
  });
}

export function resolveSeeds(opts: SimTestOptions): bigint[] {
  const forced = process.env.CHRONOS_SEED;
  if (forced !== undefined && forced !== "") {
    // `BigInt("x")` throws a SyntaxError with the value echoed; surface a clear,
    // bounded error instead so a misset CI env var isn't a mystery. The regex is
    // stricter than BigInt (decimal only) so "0x.." / "1.5" / "" are rejected up
    // front rather than turning into a throw deep in the Simulator constructor.
    if (!/^-?\d+$/.test(forced)) {
      throw new Error(`CHRONOS_SEED must be a decimal integer (got ${JSON.stringify(forced)})`);
    }
    return [BigInt(forced)];
  }
  if (Array.isArray(opts.seeds)) return opts.seeds.map((s) => BigInt(s));
  const out: bigint[] = [];
  for (let i = 0; i < opts.seeds; i++) out.push(BigInt(i));
  return out;
}

function buildSim(opts: SimTestOptions, seed: bigint): Simulator {
  const simOpts: ConstructorParameters<typeof Simulator>[0] = {
    seed,
    nodes: opts.nodes,
    ...(opts.maxSteps !== undefined ? { maxSteps: opts.maxSteps } : {}),
    ...(opts.network !== undefined ? { network: opts.network } : {}),
    ...(opts.chaos !== undefined ? { chaos: opts.chaos } : {}),
    ...(opts.netFactory !== undefined ? { netFactory: opts.netFactory } : {}),
  };
  return new Simulator(simOpts);
}

/** Build a Simulator for one seed — the shared wiring `runSimTest`,
 * `replayCapsule`, and `chronos sweep` all reuse. Exposed (Vitest-free) so a
 * non-test consumer can run a per-seed sweep without duplicating the construction. */
export function buildSimulator(opts: SimTestOptions, seed: bigint): Simulator {
  return buildSim(opts, seed);
}

/** Run the body + a final flush; detect a violation via the body (sync
 * expectInvariant throws), the final `sim.run()` result, or the trace.
 *
 * Strict guards (§3.5) are installed by default — `route` level — around the
 * body AND the final `sim.run()` flush, restored in `finally` so they never
 * leak across tests. Routing forgotten globals into the sim's own entropy
 * sources preserves "one entropy source, one time source" even when the SUT
 * forgot the DI contract. `CHRONOS_STRICT=throw` makes accidental entropy throw
 * loudly (CI); `CHRONOS_STRICT=off` disables it. The flush is under guards too,
 * because the SUT's message/timer continuations run during it — that is where
 * most of the actual system code executes. */
export async function executeScenario(sim: Simulator, body: SimTestBody): Promise<{
  violation?: { name: string; detail: string };
}> {
  const level = strictLevel();
  let violation: { name: string; detail: string } | undefined;

  let guards: InstalledGuards | undefined;
  try {
    if (level !== "off") guards = installGuards(globalEnv(sim), level);
    try {
      await runWithActiveSim(sim, () => body(sim));
    } catch (e) {
      if (e instanceof InvariantViolated) {
        // The sync expectInvariant already appended the trace event.
        violation = { name: e.invariant, detail: e.detail };
      } else {
        throw e;
      }
    }
  } finally {
    guards?.restore();
  }

  // Final flush settles any remaining events and runs safety/liveness checks.
  // Guards stay active across it (route gives any internal caller a valid,
  // deterministic value; throw is opt-in) so a forgotten global in an event
  // continuation during the flush can't silently leak entropy either.
  let flushGuards: InstalledGuards | undefined;
  let result: Awaited<ReturnType<Simulator["run"]>>;
  try {
    if (level !== "off") flushGuards = installGuards(globalEnv(sim), level);
    result = await sim.run({ maxSteps: sim.maxSteps });
  } finally {
    flushGuards?.restore();
  }
  if (!violation && result.status === "violation") {
    violation = { name: result.invariant, detail: result.detail };
  }
  if (!violation) {
    const ev = sim.trace.events.find((e) => e.kind === "invariant-violation");
    if (ev && ev.kind === "invariant-violation") {
      violation = { name: ev.name, detail: ev.detail };
    }
  }
  return violation !== undefined ? { violation } : {};
}

/** Run the scenario across seeds; stop at the first violating seed and write a
 * capsule. Returns the outcome per seed (pure — usable outside Vitest). */
export async function runSimTest(opts: SimTestOptions, body: SimTestBody): Promise<ScenarioOutcome> {
  const dir = opts.chronosDir ?? ".chronos";
  for (const seed of resolveSeeds(opts)) {
    const sim = buildSim(opts, seed);
    const { violation } = await executeScenario(sim, body);
    if (violation) {
      const capsulePath = await writeCapsule(dir, seed, sim, violation);
      return { violated: true, seed, invariant: violation, capsulePath };
    }
  }
  return { violated: false, seed: 0n };
}

/** Re-run a capsule: rebuild the sim and (if a body is given) prove reproduction.
 * Returns the rebuilt sim's outcome + trace, for unit testing the wrapper. */
export async function replayCapsule(
  capsulePath: string,
  body?: SimTestBody,
  netFactory?: NetworkFactory,
): Promise<{
  reproduced: boolean;
  violation?: { name: string; detail: string };
  trace: ReturnType<Simulator["trace"]["toTrace"]>;
}> {
  // readCapsule → validateCapsule already guarantees: `seed` is a decimal
  // integer string (so BigInt can't throw), `nodes` is a non-empty array of
  // bounded strings, `maxSteps` is an integer in [1, 10^7], and the network /
  // chaos configs are finite and in range — so none of these can silently
  // corrupt the scheduler or disable chaos (the B2 corruption path is closed
  // at the validation boundary, not here).
  const capsule = await readCapsule(capsulePath);

  const simOpts: ConstructorParameters<typeof Simulator>[0] = {
    seed: BigInt(capsule.seed),
    nodes: capsule.nodes,
    maxSteps: capsule.maxSteps,
    network: capsule.config.network,
    chaos: capsule.config.chaos,
    ...(netFactory !== undefined ? { netFactory } : {}),
  };
  const sim = new Simulator(simOpts);

  let violation: { name: string; detail: string } | undefined;
  if (body) {
    const out = await executeScenario(sim, body);
    violation = out.violation;
  } else {
    const result = await sim.run({ maxSteps: sim.maxSteps });
    if (result.status === "violation") {
      violation = { name: result.invariant, detail: result.detail };
    }
  }

  const trace = sim.trace.toTrace(
    capsule.seed,
    { network: sim.networkConfig, chaos: sim.chaosConfig },
    sim.nodes.map((n) => n.id),
    violation ? "violation" : "ok",
  );

  // Reproduction holds iff the same violation recurred and the events match.
  const reproduced =
    !!violation &&
    violation.name === capsule.invariant.name &&
    JSON.stringify(trace.events) === JSON.stringify(capsule.trace.events);

  return {
    reproduced,
    ...(violation !== undefined ? { violation } : {}),
    trace,
  };
}
