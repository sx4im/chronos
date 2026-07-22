// Failure-shrinking regression tests (Phase 5.2, §3.9 — advanced / experimental).
//
// `shrinkCapsule` takes a failing capsule + its scenario body and searches for the
// smallest still-failing fault config: greedily halve each chaos probability
// toward 0, then binary-search the minimal `maxSteps` cap that still reproduces
// the SAME invariant violation. The result is a smaller, more actionable
// capsule — "reproduces with zero chaos and 1 step" beats "100k steps of chaos".
//
// These pin the contract: chaos + maxSteps reduction, the already-minimal exit-0
// (no knob reducible), the non-reproducing exit-1, determinism (two independent
// shrinks agree), and that the shrunk capsule itself re-validates and reproduces
// (the replay proof). The shrinker is pure orchestration over `executeScenario`
// with no RNG of its own — every candidate is a fresh deterministic Simulator
// rebuilt from the capsule's seed + a simpler config — so the determinism guard
// (bug class #1) is untouched. The counter-scenario integration (a real,
// net-driven violation) is covered in `packages/cli/test/cli.test.ts`.

import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ChaosConfig } from "@sx4im/chronos-core";
import {
  shrinkCapsule,
  runSimTest,
  readCapsule,
  replayCapsule,
  type SimTestBody,
} from "@sx4im/chronos-vitest";

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), "chronos-shrink-"));
}

// The "never-true" body: a safety invariant that is false after every step, so
// the run violates at the FIRST scheduler step. The body schedules ONE timer so
// the queue takes ≥1 step — else the safety check is never evaluated (it runs
// in onStepEnd; a zero-step queue drain skips it; see simulator.ts `run()`).
// The violation is INDEPENDENT of chaos, which makes this the cleanest fixture
// to prove every chaos probability shrinks to 0 AND maxSteps shrinks to 1.
const neverTrue: SimTestBody = (sim) => {
  sim.addInvariant({ name: "never-true", kind: "safety", check: () => false });
  sim.nodes[1]!.env.setTimeout(() => {}, 1);
};

// Build a failing capsule from `neverTrue` under `chaos` + `maxSteps`, via the
// engine (the same path `simTest` takes). Returns the written capsule path.
async function makeCapsule(
  dir: string,
  seed: bigint,
  chaos: ChaosConfig,
  maxSteps: number,
): Promise<string> {
  const out = await runSimTest(
    { seeds: [seed], nodes: 3, chaos, maxSteps, chronosDir: dir },
    neverTrue,
  );
  expect(out.violated).toBe(true);
  expect(out.capsulePath).toBeDefined();
  return out.capsulePath!;
}

const FULL_CHAOS: ChaosConfig = {
  partitionProb: 0.2,
  crashProb: 0.2,
  restartProb: 0.2,
  maxPartitionMs: 100,
  maxCrashFraction: 0.5,
};

describe("shrinkCapsule — chaos + maxSteps reduction", () => {
  it("reduces all chaos probabilities to 0 and maxSteps to the violation floor (1)", async () => {
    const dir = freshDir();
    const capsulePath = await makeCapsule(dir, 7n, FULL_CHAOS, 10_000);

    const r = await shrinkCapsule(capsulePath, neverTrue, {});
    expect(r.exitCode).toBe(0);
    expect(r.shrunk).toBe(true);
    expect(r.reproduced).toBe(true);
    // The violation is chaos-independent → every prob shrinks to 0.
    expect(r.reduced.partitionProb).toBe(0);
    expect(r.reduced.crashProb).toBe(0);
    expect(r.reduced.restartProb).toBe(0);
    // never-true violates on step 1 → the maxSteps floor is 1.
    expect(r.reduced.maxSteps).toBe(1);
    expect(r.reduced.maxSteps).toBeLessThan(r.original.maxSteps);
    expect(r.shrunkPath).toBeDefined();
    expect(existsSync(r.shrunkPath!)).toBe(true);
  });

  it("writes the shrunk capsule as a sibling <seed>.shrunk.json (original untouched)", async () => {
    const dir = freshDir();
    const capsulePath = await makeCapsule(dir, 11n, FULL_CHAOS, 5_000);
    const r = await shrinkCapsule(capsulePath, neverTrue, {});
    expect(r.shrunkPath).toBe(join(dir, "failures", "11.shrunk.json"));
    // The original capsule must still exist unchanged.
    expect(existsSync(capsulePath)).toBe(true);
    // And the shrunk file is the only `.shrunk.json` in the dir.
    const shrunkFiles = readdirSync(join(dir, "failures")).filter((f) =>
      f.endsWith(".shrunk.json"),
    );
    expect(shrunkFiles).toEqual(["11.shrunk.json"]);
  });

  it("honors a custom outDir (shrunk file lands there, not next to the original)", async () => {
    const dir = freshDir();
    const outDir = join(dir, "shrunk-out");
    const capsulePath = await makeCapsule(dir, 13n, FULL_CHAOS, 5_000);
    const r = await shrinkCapsule(capsulePath, neverTrue, { outDir });
    expect(r.shrunkPath).toBe(join(outDir, "13.shrunk.json"));
    expect(existsSync(r.shrunkPath!)).toBe(true);
  });
});

describe("shrinkCapsule — already-minimal (no knob reducible)", () => {
  it("reports shrunk=false with exit 0 when chaos is 0 and maxSteps is at the floor", async () => {
    const dir = freshDir();
    // maxSteps=1 is exactly the violation floor for never-true (violates on
    // step 1); chaos all 0. No knob can be reduced → shrink reports already-minimal.
    const capsulePath = await makeCapsule(dir, 5n, {}, 1);
    const r = await shrinkCapsule(capsulePath, neverTrue, {});
    expect(r.exitCode).toBe(0);
    expect(r.shrunk).toBe(false);
    expect(r.reproduced).toBe(true);
    expect(r.shrunkPath).toBeUndefined();
    expect(r.reduced).toEqual(r.original);
    expect(r.message).toContain("minimal");
  });
});

describe("shrinkCapsule — non-reproducing baseline (exit 1)", () => {
  it("returns exit 1 when the scenario does NOT reproduce the recorded invariant", async () => {
    const dir = freshDir();
    const capsulePath = await makeCapsule(dir, 9n, FULL_CHAOS, 1_000);
    // A no-op body: no invariant, no events → the baseline run returns "ok", so
    // the capsule's "never-true" invariant doesn't recur. Nothing to shrink.
    const noOp: SimTestBody = () => {};
    const r = await shrinkCapsule(capsulePath, noOp, {});
    expect(r.exitCode).toBe(1);
    expect(r.reproduced).toBe(false);
    expect(r.shrunk).toBe(false);
    expect(r.shrunkPath).toBeUndefined();
    expect(r.message).toContain("could NOT reproduce");
  });
});

describe("shrinkCapsule — determinism (two shrinks agree)", () => {
  it("produces an identical reduced config + run count on two independent runs", async () => {
    const dir1 = freshDir();
    const dir2 = freshDir();
    const a = await makeCapsule(dir1, 21n, FULL_CHAOS, 4_000);
    const b = await makeCapsule(dir2, 21n, FULL_CHAOS, 4_000);
    const r1 = await shrinkCapsule(a, neverTrue, {});
    const r2 = await shrinkCapsule(b, neverTrue, {});
    expect(r2.reduced).toEqual(r1.reduced);
    expect(r2.runs).toBe(r1.runs);
  });

  it("shrinks to a capsule whose trace is bit-identical across two shrinks", async () => {
    const dir1 = freshDir();
    const dir2 = freshDir();
    const a = await makeCapsule(dir1, 33n, FULL_CHAOS, 2_000);
    const b = await makeCapsule(dir2, 33n, FULL_CHAOS, 2_000);
    const r1 = await shrinkCapsule(a, neverTrue, {});
    const r2 = await shrinkCapsule(b, neverTrue, {});
    const cap1 = await readCapsule(r1.shrunkPath!);
    const cap2 = await readCapsule(r2.shrunkPath!);
    expect(cap2.trace.events).toEqual(cap1.trace.events);
    expect(cap2.maxSteps).toBe(cap1.maxSteps);
    expect(cap2.config.chaos).toEqual(cap1.config.chaos);
  });
});

describe("shrinkCapsule — shrunk capsule self-reproduces (the replay proof)", () => {
  it("the shrunk capsule re-validates and reproduces its own violation", async () => {
    const dir = freshDir();
    const capsulePath = await makeCapsule(dir, 55n, FULL_CHAOS, 8_000);
    const r = await shrinkCapsule(capsulePath, neverTrue, {});
    expect(r.shrunk).toBe(true);
    // The shrunk file is a valid capsule (readCapsule re-runs validateCapsule).
    const cap = await readCapsule(r.shrunkPath!);
    expect(cap.seed).toBe("55");
    expect(cap.maxSteps).toBe(r.reduced.maxSteps);
    expect(cap.config.chaos.partitionProb).toBe(0);
    // Reproduction: re-run the shrunk capsule with the same body → same violation.
    const rep = await replayCapsule(r.shrunkPath!, neverTrue);
    expect(rep.reproduced).toBe(true);
    expect(rep.violation?.name).toBe("never-true");
  });
});
