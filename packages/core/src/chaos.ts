// Probabilistic Chaos Engine — fault generation helpers for Simulator.

import type { Rng } from "./random.js";
import type { ChaosConfig } from "./simulator.js";

/** Deterministic Fisher–Yates using the shared RNG. */
export function shuffle(rng: Rng, arr: string[]): string[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.nextFloat() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

export interface StepChaosTarget {
  rng: Rng;
  chaosConfig: Required<ChaosConfig>;
  nodeIds: string[];
  crashedNodes: Set<string>;
  partition: (groups: string[][]) => void;
  crash: (nodeId: string) => void;
  restart: (nodeId: string) => void;
}

/** Evaluate probabilistic chaos (partition, crash, restart) for a single step. */
export function evaluateStepChaos(target: StepChaosTarget): void {
  const {
    rng,
    chaosConfig,
    nodeIds,
    crashedNodes,
    partition,
    crash,
    restart,
  } = target;

  const total = nodeIds.length;

  if (chaosConfig.partitionProb > 0 && rng.chance(chaosConfig.partitionProb)) {
    const live = nodeIds.filter((id) => !crashedNodes.has(id));
    if (live.length >= 2) {
      // Split live nodes into two random halves deterministically.
      const shuffled = shuffle(rng, live);
      const mid = 1 + Math.floor(rng.nextFloat() * (shuffled.length - 1));
      const g1 = shuffled.slice(0, mid);
      const g2 = shuffled.slice(mid);
      if (g2.length > 0) partition([g1, g2]);
    }
  }

  // Crash: only within configured bound
  if (
    chaosConfig.crashProb > 0 &&
    rng.chance(chaosConfig.crashProb) &&
    crashedNodes.size + 1 <= chaosConfig.maxCrashFraction * total
  ) {
    const live = nodeIds.filter((id) => !crashedNodes.has(id));
    if (live.length > 0) {
      crash(live[Math.floor(rng.nextFloat() * live.length)]!);
    }
  }

  // Restart: bring a crashed node back
  if (chaosConfig.restartProb > 0 && rng.chance(chaosConfig.restartProb)) {
    const down = [...crashedNodes];
    if (down.length > 0) {
      restart(down[Math.floor(rng.nextFloat() * down.length)]!);
    }
  }
}
