// chronos sweep (§5.1) — run a scenario across many seeds, report every
// violating seed, and capsule the first. A reporting tool: it exits 0 on
// completion regardless of findings (the CI gate is `simTest`; sweep finds
// seeds for a human to investigate). Reuses the Vitest-free engine so the bin
// pulls no test runner. Honors `CHRONOS_DIR` to override the capsule output dir.

import {
  resolveSeeds,
  executeScenario,
  buildSimulator,
  writeCapsule,
  type SimTestBody,
  type SimTestOptions,
} from "@sx4im/chronos-vitest/engine";
import type { ChaosConfig, NetworkConfig, NetworkFactory } from "@sx4im/chronos-core";
import { toFileUrl } from "./util.js";

/** A scenario module for sweeps: the system-under-test plus its config. `seeds`
 * is supplied by the sweep itself, never the module. */
export interface ScenarioSweepModule {
  body: SimTestBody;
  nodes: number | string[];
  netFactory?: NetworkFactory;
  network?: Partial<NetworkConfig>;
  chaos?: ChaosConfig;
  maxSteps?: number;
  chronosDir?: string;
}

export interface SweepOptions {
  body: SimTestBody;
  nodes: number | string[];
  seeds: number | bigint[];
  network?: Partial<NetworkConfig>;
  chaos?: ChaosConfig;
  netFactory?: NetworkFactory;
  maxSteps?: number;
  chronosDir?: string;
}

export interface SweepResult {
  exitCode: number;
  message: string;
  /** Every violating seed, in run order. */
  violating: bigint[];
  /** Total seeds executed. */
  runs: number;
  /** Path of the first violator's capsule, if any. */
  firstCapsulePath?: string;
}

/** Dynamic-import a scenario module that exports the fields a sweep needs.
 * Validates `body` (function) and `nodes` (present). */
async function loadSweepScenario(scenarioPath: string): Promise<ScenarioSweepModule> {
  const url = toFileUrl(scenarioPath);
  const mod = (await import(url)) as Partial<ScenarioSweepModule> & {
    default?: ScenarioSweepModule;
  };
  const s = (mod.default ?? mod) as Partial<ScenarioSweepModule>;
  if (typeof s.body !== "function") {
    throw new Error(`scenario "${scenarioPath}" did not export a \`body\` function`);
  }
  if (s.nodes === undefined) {
    throw new Error(`scenario "${scenarioPath}" did not export \`nodes\``);
  }
  return {
    body: s.body,
    nodes: s.nodes,
    ...(s.netFactory !== undefined ? { netFactory: s.netFactory } : {}),
    ...(s.network !== undefined ? { network: s.network } : {}),
    ...(s.chaos !== undefined ? { chaos: s.chaos } : {}),
    ...(s.maxSteps !== undefined ? { maxSteps: s.maxSteps } : {}),
    ...(s.chronosDir !== undefined ? { chronosDir: s.chronosDir } : {}),
  };
}

/** Strip `body`/`chronosDir` (engine doesn't take those) → the per-seed
 * `SimTestOptions`. */
function toSimTestOptions(opts: SweepOptions): SimTestOptions {
  return {
    seeds: opts.seeds,
    nodes: opts.nodes,
    ...(opts.network !== undefined ? { network: opts.network } : {}),
    ...(opts.chaos !== undefined ? { chaos: opts.chaos } : {}),
    ...(opts.netFactory !== undefined ? { netFactory: opts.netFactory } : {}),
    ...(opts.maxSteps !== undefined ? { maxSteps: opts.maxSteps } : {}),
  };
}

/** Run `opts.body` across every resolved seed; collect violators; capsule the
 * first. Pure (no console I/O) — the bin formats the result; tests assert on it. */
export async function sweepSeeds(
  opts: SweepOptions,
  onProgress?: (run: number, seed: bigint, violated: boolean) => void,
): Promise<SweepResult> {
  const dir = opts.chronosDir ?? process.env.CHRONOS_DIR ?? ".chronos";
  const simOpts = toSimTestOptions(opts);
  const violating: bigint[] = [];
  let firstCapsulePath: string | undefined;
  let run = 0;

  for (const seed of resolveSeeds(simOpts)) {
    run++;
    const sim = buildSimulator(simOpts, seed);
    const { violation } = await executeScenario(sim, opts.body);
    if (violation !== undefined) {
      violating.push(seed);
      if (firstCapsulePath === undefined) {
        firstCapsulePath = await writeCapsule(dir, seed, sim, violation);
      }
    }
    onProgress?.(run, seed, violation !== undefined);
  }

  const result: SweepResult = {
    exitCode: 0,
    message:
      `chronos sweep: ran ${run} seed${run === 1 ? "" : "s"}, ${violating.length} violated` +
      (firstCapsulePath !== undefined ? ` — first capsule: ${firstCapsulePath}` : "") +
      ".",
    violating,
    runs: run,
  };
  if (firstCapsulePath !== undefined) result.firstCapsulePath = firstCapsulePath;
  return result;
}

/** Load a scenario module and sweep it across `seedCount` seeds (default 1000). */
export async function sweepCommand(
  scenarioPath: string,
  seedCount?: number,
): Promise<SweepResult> {
  let scenario: ScenarioSweepModule;
  try {
    scenario = await loadSweepScenario(scenarioPath);
  } catch (e) {
    return {
      exitCode: 2,
      message: `could not import scenario "${scenarioPath}": ${e instanceof Error ? e.message : String(e)}`,
      violating: [],
      runs: 0,
    };
  }
  return sweepSeeds({
    body: scenario.body,
    nodes: scenario.nodes,
    seeds: seedCount ?? 1000,
    ...(scenario.netFactory !== undefined ? { netFactory: scenario.netFactory } : {}),
    ...(scenario.network !== undefined ? { network: scenario.network } : {}),
    ...(scenario.chaos !== undefined ? { chaos: scenario.chaos } : {}),
    ...(scenario.maxSteps !== undefined ? { maxSteps: scenario.maxSteps } : {}),
    ...(scenario.chronosDir !== undefined ? { chronosDir: scenario.chronosDir } : {}),
  });
}
