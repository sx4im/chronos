// Dogfood: the replicated counter (deliberate race bug) exercised through the
// @sx4im/chronos-vitest API — reads like §4.1 of the API design.
//
//   simTest          — the §4.1 shape: a scenario over many seeds with an
//                      invariant. Here the network is reliable, so it stays
//                      green (the counter converges without loss/dup).
//   runSimTest       — the pure engine, used where we *expect* a violation
//                      (the buggy counter under loss+dup): we assert the bug is
//                      found, a capsule is written, CHRONOS_SEED forces one seed,
//                      and a replay reproduces the trace bit-for-bit.
//
// Capsules go to per-test temp dirs (mkdtemp under os.tmpdir) — the test harness
// uses real fs out here, not inside the simulation, so the prime directive's
// in-sim entropy ban is untouched.

import { describe, it, expect } from "vitest";
import {
  simTest,
  expectInvariant,
  runSimTest,
  replayCapsule,
  readCapsule,
  type SimTestBody,
} from "@sx4im/chronos-vitest";
import { Simulator, type NetworkContext, type NetworkFactory } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Counter } from "./counter.js";

// Fault network: drop/dup at these rates. No chaos here — the divergence is
// purely a network-fault bug, isolating the fault-injection story.
const FAULTS = { dropProb: 0.15, dupProb: 0.15 };
const faultNet: NetworkFactory = (ctx: NetworkContext) =>
  new SimNetwork({
    ...ctx,
    config: { minLatency: 1, maxLatency: 10, dropProb: FAULTS.dropProb, dupProb: FAULTS.dupProb },
  });

const chronosDir = (): string => mkdtempSync(join(tmpdir(), "chronos-counter-"));

function buildCounters(sim: Simulator): Counter[] {
  const peerIds = sim.nodes.map((n) => n.id);
  return sim.nodes.map((n) => {
    const c = new Counter({ nodeId: n.id, sim: n.env });
    c.setPeerIds(peerIds);
    return c;
  });
}

describe("counter dogfood — @sx4im/chronos-vitest", () => {
  // §4.1 shape: a simTest over many seeds with an invariant. Reliable network →
  // the counter converges (every increment reaches every node exactly once), so
  // every seed stays green. expectInvariant's zero-arg form is a sync
  // post-condition, evaluated once after `await sim.settle()`.
  simTest(
    "all counts converge when the network is reliable",
    { seeds: 30, nodes: 3, chronosDir: chronosDir() },
    async (sim) => {
      const counters = buildCounters(sim);
      await Promise.all(counters.map((c) => c.increment()));
      await sim.settle();
      expectInvariant("all counts equal", () =>
        counters.every((c) => c.value === counters[0]!.value),
      );
    },
  );

  // The buggy counter under loss+dup: Chronos must find a violating seed and
  // write a capsule. Using the pure `runSimTest` engine (not `simTest`, which
  // would register a *failing* vitest test) lets us assert "bug found" as green.
  it("finds a violating seed under loss+dup and writes a capsule", async () => {
    const dir = chronosDir();
    // world-arg form → safety invariant, checked after every scheduler step;
    // it only decides once the queue has drained (else short-circuits to true).
    const body: SimTestBody = (sim) => {
      const counters = buildCounters(sim);
      counters.forEach((c) => c.increment());
      expectInvariant("all counts equal", (_world) =>
        sim.scheduler.pendingCount() > 0 ||
        counters.every((c) => c.value === counters[0]!.value),
      );
    };
    const out = await runSimTest({ seeds: 100, nodes: 3, netFactory: faultNet, chronosDir: dir }, body);
    expect(out.violated).toBe(true);
    expect(out.invariant?.name).toBe("all counts equal");
    expect(out.capsulePath).toBe(join(dir, "failures", out.seed.toString() + ".json"));
    expect(existsSync(out.capsulePath!)).toBe(true);
  });

  // CI replay: CHRONOS_SEED forces exactly one seed, overriding the seeds list.
  it("CHRONOS_SEED re-runs exactly that one seed", async () => {
    const dir = chronosDir();
    const body: SimTestBody = (sim) => {
      const counters = buildCounters(sim);
      counters.forEach((c) => c.increment());
      expectInvariant("all counts equal", (_world) =>
        sim.scheduler.pendingCount() > 0 ||
        counters.every((c) => c.value === counters[0]!.value),
      );
    };
    // Find a seed that violates, then force it and confirm the override wins
    // (the unrelated seeds list must be ignored).
    const sweep = await runSimTest({ seeds: 100, nodes: 3, netFactory: faultNet, chronosDir: dir }, body);
    expect(sweep.violated).toBe(true);
    const bad = sweep.seed;

    const prev = process.env.CHRONOS_SEED;
    try {
      process.env.CHRONOS_SEED = String(bad);
      const forced = await runSimTest(
        { seeds: [bad + 7n, bad + 13n], nodes: 3, netFactory: faultNet, chronosDir: chronosDir() },
        body,
      );
      expect(forced.violated).toBe(true);
      expect(forced.seed).toBe(bad); // override → only `bad` ran (and reproduced)
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_SEED;
      else process.env.CHRONOS_SEED = prev;
    }
  });

  // The determinism proof: replay a capsule — same violation, bit-identical trace.
  it("replaying the capsule reproduces the violation bit-for-bit", async () => {
    const dir = chronosDir();
    const body: SimTestBody = (sim) => {
      const counters = buildCounters(sim);
      counters.forEach((c) => c.increment());
      expectInvariant("all counts equal", (_world) =>
        sim.scheduler.pendingCount() > 0 ||
        counters.every((c) => c.value === counters[0]!.value),
      );
    };
    const out = await runSimTest({ seeds: 100, nodes: 3, netFactory: faultNet, chronosDir: dir }, body);
    expect(out.capsulePath).toBeDefined();

    const capsule = await readCapsule(out.capsulePath!);
    const { reproduced, violation, trace } = await replayCapsule(out.capsulePath!, body, faultNet);
    expect(violation?.name).toBe("all counts equal");
    expect(reproduced).toBe(true);
    expect(trace.events).toEqual(capsule.trace.events);
  });
});
