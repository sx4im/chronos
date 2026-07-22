// Chaos engine (§3.7) — the Simulator's per-step probabilistic fault driver.
//
// Each scheduler step it draws from the RNG to start partitions and crash/
// restart live nodes within configured bounds, logging each as a trace event.
// This test pins the engine's determinism, the bound on concurrent crashes, and
// the no-chaos baseline.

import { describe, it, expect } from "vitest";
import { Simulator, type ChaosConfig } from "../src/simulator.js";

// Schedule many small wakes so the scheduler takes many steps — each step fires
// maybeChaos. Returns the Simulator ready to `run()` (which yields the trace).
function churn(seed: bigint, chaos?: ChaosConfig): Simulator {
  const sim = new Simulator({
    seed,
    nodes: 4,
    ...(chaos !== undefined ? { chaos } : {}),
    maxSteps: 20_000,
  });
  for (let t = 0; t < 200; t++) {
    sim.scheduler.schedule(t, () => {}, { kind: "wake", nodeId: `node-${t % 4}` });
  }
  return sim;
}

const CHAOS: ChaosConfig = {
  partitionProb: 0.05,
  crashProb: 0.2,
  restartProb: 0.05,
  maxPartitionMs: 50,
  maxCrashFraction: 0.5,
};

describe("chaos engine", () => {
  it("with no chaos, the trace records no fault events", async () => {
    const r = await churn(7n, undefined).run();
    expect(r.status).toBe("ok");
    const kinds = new Set(r.trace.events.map((e) => e.kind));
    expect(kinds.has("crash")).toBe(false);
    expect(kinds.has("restart")).toBe(false);
    expect(kinds.has("partition")).toBe(false);
  });

  it("injects partition/crash/restart and is deterministic per seed", async () => {
    const r1 = await churn(42n, CHAOS).run();
    const r2 = await churn(42n, CHAOS).run();
    expect(r1.status).toBe("ok");
    expect(r2.trace).toEqual(r1.trace); // identical trace => reproducible faults
    const kinds = new Set(r1.trace.events.map((e) => e.kind));
    expect(kinds.has("crash")).toBe(true);
    expect(kinds.has("restart")).toBe(true);
    expect(kinds.has("partition")).toBe(true);
  });

  it("never crashes more than maxCrashFraction of nodes at once", async () => {
    const limit = Math.floor((CHAOS.maxCrashFraction ?? 0.5) * 4); // 0.5*4 = 2
    let maxDown = 0;
    for (let s = 0n; s < 12n; s++) {
      const r = await churn(s, { ...CHAOS, crashProb: 0.3 }).run();
      let down = 0;
      for (const e of r.trace.events) {
        if (e.kind === "crash") {
          down++;
          maxDown = Math.max(maxDown, down);
        } else if (e.kind === "restart") {
          down--;
        }
      }
    }
    expect(maxDown).toBeGreaterThanOrEqual(1); // the engine actually fired
    expect(maxDown).toBeLessThanOrEqual(limit); // and stayed within bounds
  });
});
