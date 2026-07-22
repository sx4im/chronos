// chronos shrink (§3.9, Phase 5.2 — advanced / experimental) — reduce a failing
// capsule's fault config to the smallest value that still reproduces the SAME
// invariant violation, then write a `<seed>.shrunk.json` sibling. A smaller,
// more actionable capsule: "reproduces with zero partitions and 30 steps" beats
// "100k steps of chaos".
//
// A capsule alone can't be shrunk: shrinking RE-RUNS the system-under-test under
// progressively simpler fault configs, so it needs the SAME scenario module
// ({ body, netFactory? }) that `chronos replay` takes — the scenario's
// netFactory must match the one that produced the capsule, or the baseline won't
// reproduce (exit 1). The shrink reduces only the Simulator's chaos
// PROBABILITIES (partitionProb/crashProb/restartProb) + the run-length cap
// (maxSteps); the network drop/dup fault knobs live inside the injected
// netFactory and are out of reach by design (see `shrinkCapsule`'s doc comment).
//
// Exit codes mirror `chronos replay`: 0 = shrunk or already-minimal; 1 = the
// capsule doesn't reproduce under this scenario; 2 = capsule/scenario read error
// (path confinement + content-free errors per the B4 audit).

import { dirname } from "node:path";
import { shrinkCapsule } from "@sx4im/chronos-vitest/engine";
import { resolveCapsulePath, capsuleReadError } from "./util.js";
import { loadScenario, type ScenarioModule } from "./replay.js";

export interface ShrinkCommandResult {
  exitCode: number;
  message: string;
  /** Path of the shrunk capsule, written only when a knob actually decreased. */
  shrunkPath?: string;
}

/** `chronos shrink <capsule> [scenario]`. Pure (no console I/O): the bin prints
 *  the message and sets the exit code; tests assert on the structured result. */
export async function shrinkCommand(
  capsulePath: string,
  scenarioPath?: string,
): Promise<ShrinkCommandResult> {
  // Path confinement (B4): refuse a capsule outside the allowed roots before
  // the reader opens it; map any confinement failure to a content-free message
  // (basename only — never the absolute path).
  let confined: string;
  try {
    confined = resolveCapsulePath(capsulePath);
  } catch (e) {
    return { exitCode: 2, message: capsuleReadError(capsulePath, e) };
  }

  if (scenarioPath === undefined) {
    return {
      exitCode: 0,
      message:
        `chronos shrink reduces a failing capsule's fault config to the smallest value that ` +
        `still reproduces the violation — a smaller, more actionable failure capsule.\n` +
        `But shrinking RE-RUNS the system-under-test under simpler fault configs, so it needs ` +
        `the SAME scenario module that produced the capsule:\n\n` +
        `  $ chronos shrink ${capsulePath} <path/to/scenario.{js,ts}>\n\n` +
        `where the module exports { body, netFactory? } — the same shape \`chronos replay\` takes, ` +
        `and the SAME network the failing run used (else the baseline won't reproduce and shrink ` +
        `exits 1).`,
    };
  }

  let scenario: ScenarioModule;
  try {
    scenario = await loadScenario(scenarioPath);
  } catch (e) {
    return {
      exitCode: 2,
      message:
        `could not import scenario "${scenarioPath}": ${e instanceof Error ? e.message : String(e)}\n` +
        `Tip: .ts scenarios need a TS-aware runner (vitest/tsx); build to .js or run under tsx.`,
    };
  }

  try {
    const result = await shrinkCapsule(confined, scenario.body, {
      ...(scenario.netFactory !== undefined ? { netFactory: scenario.netFactory } : {}),
      outDir: dirname(confined),
    });
    return {
      exitCode: result.exitCode,
      message: result.message,
      ...(result.shrunkPath !== undefined ? { shrunkPath: result.shrunkPath } : {}),
    };
  } catch (e) {
    // `shrinkCapsule` throws only on a capsule read failure (InvalidCapsule /
    // ENOENT) — its non-reproducing outcome is a returned exit-1, not a throw.
    // Map the read failure to the same content-free capsule-read message
    // `chronos replay` uses (basename only — never the absolute path or bytes).
    return { exitCode: 2, message: capsuleReadError(capsulePath, e) };
  }
}
