import { describe, it, expect } from "vitest";
import { simTest, runSimTest, executeScenario } from "@sx4im/chronos-vitest";
import { buildSimulator } from "@sx4im/chronos-vitest/engine";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  twoPhaseNetFactory,
  twoPhaseChaos,
  TWO_PHASE_MAX_STEPS,
  twoPhaseSafetyBody,
} from "./harness.js";

const dir = (): string => mkdtempSync(join(tmpdir(), "chronos-2pc-"));

describe("twophase-commit — Atomicity under Chronos", () => {
  simTest(
    "atomicity & non-spontaneous commit hold (40 seeds, faults only)",
    { seeds: 40, nodes: 3, netFactory: twoPhaseNetFactory, maxSteps: TWO_PHASE_MAX_STEPS, chronosDir: dir() },
    twoPhaseSafetyBody,
  );

  simTest(
    "atomicity & non-spontaneous commit hold (200 seeds, chaos)",
    {
      seeds: 200,
      nodes: 3,
      netFactory: twoPhaseNetFactory,
      chaos: twoPhaseChaos,
      maxSteps: TWO_PHASE_MAX_STEPS,
      chronosDir: dir(),
    },
    twoPhaseSafetyBody,
  );

  it(
    "sweeps 1000 seeds with chaos and finds no violator",
    { timeout: 120_000 },
    async () => {
      const out = await runSimTest(
        {
          seeds: 1000,
          nodes: 3,
          netFactory: twoPhaseNetFactory,
          chaos: twoPhaseChaos,
          maxSteps: TWO_PHASE_MAX_STEPS,
          chronosDir: dir(),
        },
        twoPhaseSafetyBody,
      );
      expect(out.violated).toBe(false);
      expect(out.capsulePath).toBeUndefined();
    },
  );

  it("is deterministic: the same seed yields a bit-identical trace", async () => {
    const opts = {
      seeds: 1,
      nodes: 3,
      netFactory: twoPhaseNetFactory,
      chaos: twoPhaseChaos,
      maxSteps: TWO_PHASE_MAX_STEPS,
    } as const;

    const runOnce = async (seed: bigint) => {
      const sim = buildSimulator(opts, seed);
      await executeScenario(sim, twoPhaseSafetyBody);
      return sim.trace.events;
    };

    const a = await runOnce(77n);
    const b = await runOnce(77n);
    expect(b).toEqual(a);
  });
});
