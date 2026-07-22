// Failure shrinking (§3.9, Phase 5.2 — advanced / experimental).
//
// Given a failing capsule + its scenario (body + optional netFactory), search
// for a SIMPLER still-failing config: greedily reduce each chaos knob
// (partitionProb / crashProb / restartProb) toward zero, then binary-search
// the smallest `maxSteps` cap that still reproduces the SAME invariant
// violation. The smallest config still failing makes a capsule far more
// actionable — "reproduces with zero partitions and just 30 steps" beats
// "100k steps of chaos".

import type { NetworkFactory } from "@sx4im/chronos-core";
import type { SimTestBody } from "./types.js";
import { readCapsule, buildCapsule, writeCapsuleTo } from "./capsule.js";
import { dirname, join } from "node:path";
import {
  type ShrinkConfig,
  configOf,
  runCandidate,
  greedyShrink,
} from "./shrinkRunner.js";

export type { ShrinkConfig };

export interface ShrinkResult {
  /** 0 = shrunk, or confirmed already-minimal; 1 = the capsule does not
   *  reproduce under this scenario (can't shrink what doesn't reproduce). Read
   *  errors surface as a thrown `InvalidCapsule` (the caller maps them). */
  exitCode: number;
  message: string;
  /** Did the baseline (original capsule) reproduce the recorded invariant? */
  reproduced: boolean;
  /** Did at least one knob actually decrease? `false` ⇒ the capsule config was
   *  already a local minimum (no knob could be reduced while still failing). */
  shrunk: boolean;
  /** Total `Simulator` runs performed (baseline + every probe). Each run stops
   *  early at the violation, so this is cheap even for a 100k-step capsule. */
  runs: number;
  /** Path of the shrunk capsule — written only when `shrunk === true`. */
  shrunkPath?: string;
  /** The config as recorded in the original capsule. */
  original: ShrinkConfig;
  /** The final config; equals `original` when `shrunk === false`. */
  reduced: ShrinkConfig;
  /** The invariant name the shrink matches candidates against. */
  invariantName: string;
}

export interface ShrinkOptions {
  /** Inject the same fault network the scenario shipped with (e.g. @sx4im/chronos-net's
   *  SimNetwork). Without it the Simulator uses core's dependency-free
   *  BasicNetwork — which can't reproduce a capsule whose faults came from a
   *  SimNetwork (the shrink then reports exit 1, "could not reproduce"). */
  netFactory?: NetworkFactory;
  /** Directory to write `<seed>.shrunk.json` into. Defaults to the original
   *  capsule's own directory, so the shrunk capsule lands as a sibling — never
   *  overwriting the original. */
  outDir?: string;
  /** Optional progress callback: fired with a short stage label and the running
   *  total of `Simulator` runs. */
  onProgress?: (stage: string, runs: number) => void;
}

function fmtKnobs(label: string, c: ShrinkConfig): string {
  return (
    `${label} maxSteps=${c.maxSteps}, partitionProb=${c.partitionProb}, ` +
    `crashProb=${c.crashProb}, restartProb=${c.restartProb}\n`
  );
}

/** Shrink a failing capsule: re-run its scenario under progressively simpler
 *  fault configs and keep the smallest config that still reproduces the SAME
 *  invariant violation, then atomically write a `<seed>.shrunk.json` capsule.
 *
 *  Throws `InvalidCapsule` if the capsule is malformed (the caller maps it to an
 *  exit code). Returns `exitCode: 1` (no throw) if the capsule does not reproduce
 *  under this scenario — e.g. a `netFactory` that doesn't match the one that
 *  produced the capsule. */
export async function shrinkCapsule(
  capsulePath: string,
  body: SimTestBody,
  options?: ShrinkOptions,
): Promise<ShrinkResult> {
  // readCapsule → validateCapsule first: a malformed capsule throws before any
  // field reaches a candidate Simulator (the B2 corruption path is closed at
  // the validation boundary, not here).
  const capsule = await readCapsule(capsulePath);

  const netFactory = options?.netFactory;
  const invariantName = capsule.invariant.name;
  const original = configOf(capsule);

  // Baseline: does the original capsule even reproduce under this scenario? If
  // not, there's nothing to shrink — the scenario's netFactory/network likely
  // doesn't match the one that produced the capsule.
  const baseline = await runCandidate(capsule, original, body, netFactory, invariantName);
  if (!baseline.reproduced) {
    return {
      exitCode: 1,
      message:
        `✗ could NOT reproduce "${invariantName}" from seed ${capsule.seed} under this scenario — ` +
        `can't shrink what doesn't reproduce.\n` +
        `  Most likely the scenario's netFactory/network doesn't match the one that produced the capsule.`,
      reproduced: false,
      shrunk: false,
      runs: 1,
      original,
      reduced: original,
      invariantName,
    };
  }

  const shrink = await greedyShrink(
    capsule,
    original,
    { sim: baseline.sim!, violation: baseline.violation! },
    body,
    netFactory,
    invariantName,
    options?.onProgress,
  );

  const shrunk =
    shrink.cfg.maxSteps !== original.maxSteps ||
    shrink.cfg.partitionProb !== original.partitionProb ||
    shrink.cfg.crashProb !== original.crashProb ||
    shrink.cfg.restartProb !== original.restartProb;

  if (!shrunk) {
    return {
      exitCode: 0,
      message:
        `capsule "${capsule.seed}" already reproduces with a minimal config — no knob could be ` +
        `further reduced while still failing (${shrink.runs} run(s)).`,
      reproduced: true,
      shrunk: false,
      runs: shrink.runs,
      original,
      reduced: shrink.cfg,
      invariantName,
    };
  }

  // Build + atomically write the shrunk capsule next to the original. The path
  // `<outDir>/<seed>.shrunk.json` (default: the capsule's own directory) never
  // clobbers the original, and `writeCapsuleTo`'s same-directory temp+rename
  // keeps a mid-write crash from corrupting either file.
  const outDir = options?.outDir ?? dirname(capsulePath);
  const shrunkPath = join(outDir, `${capsule.seed}.shrunk.json`);
  await writeCapsuleTo(shrunkPath, buildCapsule(BigInt(capsule.seed), shrink.sim, shrink.violation));

  return {
    exitCode: 0,
    message:
      `✓ shrunk capsule for seed ${capsule.seed} ("${invariantName}") — ${shrink.runs} run(s).\n` +
      fmtKnobs("  original:", original) +
      fmtKnobs("  shrunk:  ", shrink.cfg) +
      `\n  written: ${shrunkPath}`,
    reproduced: true,
    shrunk: true,
    runs: shrink.runs,
    shrunkPath,
    original,
    reduced: shrink.cfg,
    invariantName,
  };
}
