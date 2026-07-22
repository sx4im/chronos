import { describe, it, expect } from "vitest";
import { simTest, runSimTest, executeScenario } from "@sx4im/chronos-vitest";
import { buildSimulator } from "@sx4im/chronos-vitest/engine";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  gossipNetFactory,
  gossipChaos,
  GOSSIP_MAX_STEPS,
  gossipSafetyBody,
} from "./harness.js";

const dir = (): string => mkdtempSync(join(tmpdir(), "chronos-gossip-"));

describe("gossip — consistency under Chronos", () => {
  simTest(
    "gossip consistency holds (40 seeds, faults only)",
    { seeds: 40, nodes: 3, netFactory: gossipNetFactory, maxSteps: GOSSIP_MAX_STEPS, chronosDir: dir() },
    gossipSafetyBody,
  );

  simTest(
    "gossip consistency holds (200 seeds, chaos)",
    {
      seeds: 200,
      nodes: 3,
      netFactory: gossipNetFactory,
      chaos: gossipChaos,
      maxSteps: GOSSIP_MAX_STEPS,
      chronosDir: dir(),
    },
    gossipSafetyBody,
  );

  it(
    "sweeps 1000 seeds with chaos and finds no violator",
    { timeout: 180_000 },
    async () => {
      const out = await runSimTest(
        {
          seeds: 1000,
          nodes: 3,
          netFactory: gossipNetFactory,
          chaos: gossipChaos,
          maxSteps: GOSSIP_MAX_STEPS,
          chronosDir: dir(),
        },
        gossipSafetyBody,
      );
      expect(out.violated).toBe(false);
      expect(out.capsulePath).toBeUndefined();
    },
  );

  it("is deterministic: the same seed yields a bit-identical trace", async () => {
    const opts = {
      seeds: 1,
      nodes: 3,
      netFactory: gossipNetFactory,
      chaos: gossipChaos,
      maxSteps: GOSSIP_MAX_STEPS,
    } as const;

    const runOnce = async (seed: bigint) => {
      const sim = buildSimulator(opts, seed);
      await executeScenario(sim, gossipSafetyBody);
      return sim.trace.events;
    };

    const a = await runOnce(99n);
    const b = await runOnce(99n);
    expect(b).toEqual(a);
  });
});
