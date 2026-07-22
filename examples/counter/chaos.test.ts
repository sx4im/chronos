// Phase 3.2 dogfood: the chaos engine surfaces a counter race that the clean
// (no-chaos) run does NOT hit — and the failure reproduces from the seed.
//
// Same non-idempotent Counter as counter.test.ts, but the network itself is
// fault-free (dropProb=dupProb=0): the divergence comes entirely from the chaos
// engine's partitions and node crashes/restarts.

import { describe, it, expect } from "vitest";
import { Simulator, type ChaosConfig, type Trace } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";
import { Counter } from "./counter.js";

const CHAOS: ChaosConfig = {
  partitionProb: 0.08,
  crashProb: 0.08,
  restartProb: 0.15,
  maxPartitionMs: 40,
  maxCrashFraction: 0.5,
};

interface CounterChaosResult {
  status: "ok" | "violation";
  counts: Record<string, number>;
  trace: Trace;
}

// 3 nodes, 8 increments each, symmetric broadcast over a fault-free network.
// With no chaos the counts converge (every node increments the same number of
// times). Chaos breaks that symmetry deterministically per seed.
async function runCounterChaos(seed: bigint, chaos?: ChaosConfig): Promise<CounterChaosResult> {
  const sim = new Simulator({
    seed,
    nodes: 3,
    netFactory: (ctx) =>
      new SimNetwork({ ...ctx, config: { minLatency: 1, maxLatency: 12, dropProb: 0, dupProb: 0 } }),
    ...(chaos !== undefined ? { chaos } : {}),
    maxSteps: 50_000,
  });

  const peerIds = sim.nodes.map((n) => n.id);
  const counters = sim.nodes.map((n) => {
    const c = new Counter({ nodeId: n.id, sim: n.env });
    c.setPeerIds(peerIds);
    return c;
  });

  const incrementsPerNode = 8;
  for (let i = 0; i < incrementsPerNode; i++) {
    for (let j = 0; j < sim.nodes.length; j++) {
      const delay = i * 10 + j * 3;
      sim.scheduler.schedule(delay, () => counters[j]!.increment(), {
        kind: "kick",
        nodeId: peerIds[j]!,
      });
    }
  }

  sim.addInvariant({
    name: "all counts equal",
    kind: "safety",
    check: () => {
      // Late check: only validate once the event queue has settled.
      if (sim.scheduler.pendingCount() > 0) return true;
      const vals = sim.nodes.map((_, i) => counters[i]!.value);
      return vals.every((v) => v === vals[0]);
    },
  });

  const r = await sim.run({ maxSteps: sim.maxSteps });
  const counts: Record<string, number> = {};
  for (let i = 0; i < sim.nodes.length; i++) {
    counts[sim.nodes[i]!.id] = counters[i]!.value;
  }
  return { status: r.status, counts, trace: r.trace };
}

describe("chaos engine dogfood — counter", () => {
  it("clean (no chaos): never violates across seeds (baseline)", async () => {
    for (const s of [0n, 1n, 2n, 3n, 4n, 5n]) {
      const r = await runCounterChaos(s, undefined);
      expect(r.status).toBe("ok");
    }
  });

  it("under chaos: a clean seed is driven to a reproducing violation, trace records the faults", async () => {
    let found: bigint | undefined;
    for (let s = 0n; s < 100n; s++) {
      const clean = await runCounterChaos(s, undefined);
      if (clean.status !== "ok") continue; // need a clean baseline
      const chaos = await runCounterChaos(s, CHAOS);
      if (chaos.status === "violation") {
        found = s;
        break;
      }
    }
    expect(found).toBeDefined();
    if (!found) return;

    const c1 = await runCounterChaos(found, CHAOS);
    const c2 = await runCounterChaos(found, CHAOS);
    expect(c1.status).toBe("violation");
    expect(c2.status).toBe("violation");
    expect(c2.counts).toEqual(c1.counts); // reproduces identically from the seed

    const kinds = new Set(c1.trace.events.map((e) => e.kind));
    expect(kinds.has("crash")).toBe(true);
    expect(kinds.has("restart")).toBe(true);
    expect(kinds.has("partition")).toBe(true);
  });
});
