import { describe, it, expect } from "vitest";
import { simTest, runSimTest, executeScenario } from "@sx4im/chronos-vitest";
import { buildSimulator } from "@sx4im/chronos-vitest/engine";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  crdtNetFactory,
  crdtChaos,
  CRDT_MAX_STEPS,
  crdtSafetyBody,
} from "./harness.js";

const dir = (): string => mkdtempSync(join(tmpdir(), "chronos-crdt-"));

describe("crdt — LWW register convergence under Chronos", () => {
  simTest(
    "strong eventual consistency holds (40 seeds, faults only)",
    { seeds: 40, nodes: 3, netFactory: crdtNetFactory, maxSteps: CRDT_MAX_STEPS, chronosDir: dir() },
    crdtSafetyBody,
  );

  simTest(
    "strong eventual consistency holds (200 seeds, chaos)",
    {
      seeds: 200,
      nodes: 3,
      netFactory: crdtNetFactory,
      chaos: crdtChaos,
      maxSteps: CRDT_MAX_STEPS,
      chronosDir: dir(),
    },
    crdtSafetyBody,
  );

  it(
    "sweeps 1000 seeds with chaos and finds no violator",
    { timeout: 120_000 },
    async () => {
      const out = await runSimTest(
        {
          seeds: 1000,
          nodes: 3,
          netFactory: crdtNetFactory,
          chaos: crdtChaos,
          maxSteps: CRDT_MAX_STEPS,
          chronosDir: dir(),
        },
        crdtSafetyBody,
      );
      expect(out.violated).toBe(false);
      expect(out.capsulePath).toBeUndefined();
    },
  );

  it("is deterministic: the same seed yields a bit-identical trace", async () => {
    const opts = {
      seeds: 1,
      nodes: 3,
      netFactory: crdtNetFactory,
      chaos: crdtChaos,
      maxSteps: CRDT_MAX_STEPS,
    } as const;

    const runOnce = async (seed: bigint) => {
      const sim = buildSimulator(opts, seed);
      await executeScenario(sim, crdtSafetyBody);
      return sim.trace.events;
    };

    const a = await runOnce(42n);
    const b = await runOnce(42n);
    expect(b).toEqual(a);
  });
});
