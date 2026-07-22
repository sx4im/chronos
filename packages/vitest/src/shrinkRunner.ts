// Candidate simulator runner and greedy/binary search shrink algorithm for Failure Shrinking.

import { Simulator, type NetworkFactory } from "@sx4im/chronos-core";
import type { FailureCapsule, SimTestBody } from "./types.js";
import { executeScenario } from "./engine.js";

export interface ShrinkConfig {
  maxSteps: number;
  partitionProb: number;
  crashProb: number;
  restartProb: number;
}

// The halving tail snaps to exactly 0 once a prob is below 0.1% — a sub-0.001
// fault rate reads as "essentially none" to a human.
const SHRINK_PROB_SNAP = 1e-3;

/** Halve a chaos probability toward zero, snapping to exactly 0 once small. */
export function reducedProb(p: number): number {
  if (p <= SHRINK_PROB_SNAP) return 0;
  return p / 2;
}

export function configOf(capsule: FailureCapsule): ShrinkConfig {
  return {
    maxSteps: capsule.maxSteps,
    partitionProb: capsule.config.chaos.partitionProb,
    crashProb: capsule.config.chaos.crashProb,
    restartProb: capsule.config.chaos.restartProb,
  };
}

/** Build a `Simulator` for one candidate config. */
export function buildSimFor(
  capsule: FailureCapsule,
  cfg: ShrinkConfig,
  netFactory: NetworkFactory | undefined,
): Simulator {
  return new Simulator({
    seed: BigInt(capsule.seed),
    nodes: capsule.nodes,
    maxSteps: cfg.maxSteps,
    network: capsule.config.network,
    chaos: {
      partitionProb: cfg.partitionProb,
      crashProb: cfg.crashProb,
      restartProb: cfg.restartProb,
      maxPartitionMs: capsule.config.chaos.maxPartitionMs,
      maxCrashFraction: capsule.config.chaos.maxCrashFraction,
    },
    ...(netFactory !== undefined ? { netFactory } : {}),
  });
}

/** Run one candidate config and report whether it reproduces the SAME invariant name. */
export async function runCandidate(
  capsule: FailureCapsule,
  cfg: ShrinkConfig,
  body: SimTestBody,
  netFactory: NetworkFactory | undefined,
  invariantName: string,
): Promise<{
  reproduced: boolean;
  sim?: Simulator;
  violation?: { name: string; detail: string };
}> {
  const sim = buildSimFor(capsule, cfg, netFactory);
  try {
    const { violation } = await executeScenario(sim, body);
    if (violation !== undefined && violation.name === invariantName) {
      return { reproduced: true, sim, violation };
    }
    return { reproduced: false };
  } catch {
    return { reproduced: false };
  }
}

/** Greedy coordinate descent on chaos probabilities, then binary search for maxSteps. */
export async function greedyShrink(
  capsule: FailureCapsule,
  start: ShrinkConfig,
  baseline: { sim: Simulator; violation: { name: string; detail: string } },
  body: SimTestBody,
  netFactory: NetworkFactory | undefined,
  invariantName: string,
  onProgress?: (stage: string, runs: number) => void,
): Promise<{
  cfg: ShrinkConfig;
  sim: Simulator;
  violation: { name: string; detail: string };
  runs: number;
}> {
  let cfg = start;
  let runs = 1;
  let bestSim: Simulator = baseline.sim;
  let bestViolation = baseline.violation;
  onProgress?.("baseline", runs);

  const knobs: Array<{ key: "partitionProb" | "crashProb" | "restartProb"; label: string }> = [
    { key: "partitionProb", label: "partitionProb" },
    { key: "crashProb", label: "crashProb" },
    { key: "restartProb", label: "restartProb" },
  ];
  for (const knob of knobs) {
    if (cfg[knob.key] === 0) continue;
    let improved = true;
    while (improved) {
      const next = reducedProb(cfg[knob.key]);
      if (next === cfg[knob.key]) break;
      const trial: ShrinkConfig = { ...cfg, [knob.key]: next };
      const r = await runCandidate(capsule, trial, body, netFactory, invariantName);
      runs++;
      onProgress?.(`${knob.label}→${next}`, runs);
      if (r.reproduced) {
        cfg = trial;
        bestSim = r.sim!;
        bestViolation = r.violation!;
      } else {
        improved = false;
      }
    }
  }

  let lo = 1;
  let hi = cfg.maxSteps;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const trial: ShrinkConfig = { ...cfg, maxSteps: mid };
    const r = await runCandidate(capsule, trial, body, netFactory, invariantName);
    runs++;
    onProgress?.(`maxSteps→${mid}`, runs);
    if (r.reproduced) {
      hi = mid;
      cfg = trial;
      bestSim = r.sim!;
      bestViolation = r.violation!;
    } else {
      lo = mid + 1;
    }
  }

  return { cfg, sim: bestSim, violation: bestViolation, runs };
}
