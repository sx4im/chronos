// Raft-lite under Chronos — the flagship dogfood (Phase 6.1).
//
// Two `simTest`s assert Raft's safety invariants run after run across many
// seeds; a third uses the pure `runSimTest` engine to sweep 1000 seeds with
// chaos and asserts none violate (the "thousands of seeds" check from the
// build plan); the fourth proves the runs are bit-for-bit deterministic from
// the seed. Capsules go to per-test temp dirs (mkdtemp under os.tmpdir) so a
// violation would write to tmp, not the repo's `.chronos/` — real fs out here,
// never inside a simulation, so the prime directive's in-sim entropy ban holds.
//
// If a seed ever violates, the simTest fails loudly with the seed + capsule
// path; `chronos replay <capsule>` then reproduces the exact failing election
// in the Inspector. The README records the actual outcome of the chaos sweep.

import { describe, it, expect } from "vitest";
import { simTest, runSimTest, executeScenario } from "@sx4im/chronos-vitest";
import { buildSimulator } from "@sx4im/chronos-vitest/engine";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  raftNetFactory,
  raftChaos,
  RAFT_MAX_STEPS,
  raftSafetyBody,
} from "./harness.js";

const dir = (): string => mkdtempSync(join(tmpdir(), "chronos-raft-"));

describe("raft-lite — safety invariants under Chronos", () => {
  // Baseline: no chaos, only the fault network (a few drops/dups). Election +
  // replication must still be safe — this is the green-path sanity check before
  // we throw partitions and crashes at it.
  simTest(
    "election safety + commit agreement hold (40 seeds, faults only)",
    { seeds: 40, nodes: 3, netFactory: raftNetFactory, maxSteps: RAFT_MAX_STEPS, chronosDir: dir() },
    raftSafetyBody,
  );

  // The headline: drops, duplicates, partitions, crashes, and restarts — and
  // Raft stays safe. Both invariants are per-step safety checks, so a violation
  // at ANY virtual time stops the run and names the offending term/leaders.
  simTest(
    "election safety + commit agreement hold (200 seeds, chaos)",
    {
      seeds: 200,
      nodes: 3,
      netFactory: raftNetFactory,
      chaos: raftChaos,
      maxSteps: RAFT_MAX_STEPS,
      chronosDir: dir(),
    },
    raftSafetyBody,
  );

  // The build-plan "thousands of seeds" sweep. Using the pure `runSimTest`
  // engine (not `simTest`, which would register a *failing* vitest test on the
  // first violator) lets us claim "no violator found across 2000 seeds" as a
  // green assertion rather than a red test.
  // 2000 seeds under chaos is the build-plan headline; give it headroom past the
  // suite-wide 30s timeout so a slower CI runner can't flake it.
  it(
    "sweeps 2000 seeds with chaos and finds no violator",
    { timeout: 120_000 },
    async () => {
    const out = await runSimTest(
      {
        seeds: 2000,
        nodes: 3,
        netFactory: raftNetFactory,
        chaos: raftChaos,
        maxSteps: RAFT_MAX_STEPS,
        chronosDir: dir(),
      },
      raftSafetyBody,
    );
    expect(out.violated).toBe(false);
    expect(out.capsulePath).toBeUndefined();
  });

  // Direct determinism proof for the raft example: same big-integer seed ⇒
  // byte-identical trace, twice. (A capsule/replay proof isn't possible here —
  // our Raft is SAFE, so no violating capsule exists — so we prove determinism
  // directly via two runs of the same seed.)
  it("is deterministic: the same seed yields a bit-identical trace", async () => {
    const opts = {
      seeds: 1,
      nodes: 3,
      netFactory: raftNetFactory,
      chaos: raftChaos,
      maxSteps: RAFT_MAX_STEPS,
    } as const;
    const runOnce = async (seed: bigint) => {
      const sim = buildSimulator(opts, seed);
      await executeScenario(sim, raftSafetyBody);
      return sim.trace.events;
    };
    const a = await runOnce(17n);
    const b = await runOnce(17n);
    expect(b).toEqual(a);
  });
});
