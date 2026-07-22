// @sx4im/chronos-net — fault-injection network tests (Phase 3.1).
//
// Proves the three fault modes (drop / partition / duplicate) behave as
// specified and that everything is deterministic per seed. The fault-injecting
// SimNetwork is injected into core's Simulator via `netFactory`; core itself
// never imports this package, so the dependency graph stays acyclic
// (net → core).

import { describe, it, expect } from "vitest";
import { Simulator, type Trace } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";

/** Build a Simulator whose network is @sx4im/chronos-net's fault-injecting SimNetwork. */
function simWithFaults(
  seed: bigint,
  nodes: string[],
  config: { minLatency: number; maxLatency: number; dropProb: number; dupProb: number },
  onReceive?: (from: string, payload: unknown, to: string) => void,
): Simulator {
  const sim = new Simulator({
    seed,
    nodes,
    netFactory: (ctx) => new SimNetwork({ ...ctx, config }),
    maxSteps: 10_000,
  });
  for (const n of sim.nodes) {
    n.env.net.onReceive((from, payload) => onReceive?.(from, payload, n.id));
  }
  return sim;
}

describe("@sx4im/chronos-net SimNetwork", () => {
  it("dropProb=1: every message is dropped and never delivered (across seeds)", async () => {
    for (const seed of [0n, 1n, 2n, 42n]) {
      const received: string[] = [];
      const sim = simWithFaults(
        seed,
        ["a", "b"],
        { minLatency: 1, maxLatency: 10, dropProb: 1, dupProb: 0 },
        (from, payload, to) => received.push(`${from}->${to}:${String(payload)}`),
      );
      const a = sim.nodes[0]!;
      sim.scheduler.schedule(0, () => a.env.net.send("b", "hi"), { kind: "kick", nodeId: "a" });
      sim.scheduler.schedule(5, () => a.env.net.send("b", "again"), { kind: "kick", nodeId: "a" });

      const r = await sim.run({ maxSteps: 10_000 });
      expect(r.status).toBe("ok");
      expect(received).toEqual([]);
      // Trace records the drops (summary prefixed "dropped "), never a delivery.
      const drops = r.trace.events.filter((e) => e.kind === "send" && (e.summary ?? "").startsWith("dropped"));
      expect(drops.length).toBe(2);
      expect(r.trace.events.some((e) => e.kind === "deliver")).toBe(false);
    }
  });

  it("partition blocks during [start,end) and heals after the window", async () => {
    const received: string[] = [];
    const sim = simWithFaults(
      7n,
      ["a", "b"],
      { minLatency: 1, maxLatency: 5, dropProb: 0, dupProb: 0 },
      (from, payload, to) => received.push(`${from}->${to}:${String(payload)}`),
    );
    const a = sim.nodes[0]!;

    // t=0: open a partition a|b for 100ms, then send — must be swallowed.
    sim.scheduler.schedule(0, () => {
      sim.partition([["a"], ["b"]], 100);
      a.env.net.send("b", "during");
    }, { kind: "kick", nodeId: "a" });
    // t=200: window [0,100) has closed — send must be delivered.
    sim.scheduler.schedule(200, () => {
      a.env.net.send("b", "after");
    }, { kind: "kick", nodeId: "a" });

    const r = await sim.run({ maxSteps: 10_000 });
    expect(r.status).toBe("ok");
    expect(received).toEqual(["a->b:after"]);
    // The partition opening is recorded; the "during" send left no delivery trace.
    expect(r.trace.events.some((e) => e.kind === "partition")).toBe(true);
  });

  it("dupProb=1: each send delivers exactly twice (across seeds)", async () => {
    for (const seed of [0n, 3n, 99n]) {
      const received: string[] = [];
      const sim = simWithFaults(
        seed,
        ["a", "b"],
        { minLatency: 1, maxLatency: 1, dropProb: 0, dupProb: 1 },
        (from, payload, to) => received.push(`${from}->${to}:${String(payload)}`),
      );
      const a = sim.nodes[0]!;
      sim.scheduler.schedule(0, () => a.env.net.send("b", "once"), { kind: "kick", nodeId: "a" });

      const r = await sim.run({ maxSteps: 10_000 });
      expect(r.status).toBe("ok");
      expect(received).toEqual(["a->b:once", "a->b:once"]);
      // One send traced, two deliveries traced.
      const sends = r.trace.events.filter((e) => e.kind === "send");
      const delivers = r.trace.events.filter((e) => e.kind === "deliver");
      expect(sends.length).toBe(1);
      expect(delivers.length).toBe(2);
    }
  });

  it("same seed reproduces an identical trace (deterministic faults)", async () => {
    async function runNet(seed: bigint): Promise<Trace> {
      const sim = new Simulator({
        seed,
        nodes: ["a", "b", "c"],
        netFactory: (ctx) =>
          new SimNetwork({ ...ctx, config: { minLatency: 1, maxLatency: 20, dropProb: 0.2, dupProb: 0.2 } }),
        maxSteps: 10_000,
      });
      for (const n of sim.nodes) n.env.net.onReceive(() => {});
      const a = sim.nodes[0]!;
      sim.scheduler.schedule(0, () => {
        a.env.net.send("b", "m1");
        a.env.net.send("c", "m2");
      }, { kind: "kick", nodeId: "a" });
      sim.scheduler.schedule(15, () => a.env.net.send("b", "m3"), { kind: "kick", nodeId: "a" });
      const r = await sim.run({ maxSteps: 10_000 });
      return r.trace;
    }

    for (const seed of [0n, 42n, 31337n]) {
      const t1 = await runNet(seed);
      const t2 = await runNet(seed);
      expect(t2).toEqual(t1);
    }
  });

  it("minLatency>maxLatency (inverted config) is clamped, not a backwards-time crash", async () => {
    // A malformed NetworkConfig constructed directly (bypassing validateCapsule,
    // e.g. `new Simulator({ network: { minLatency: 50, maxLatency: 1 } })`) must
    // not schedule a delivery before the send — which would make
    // VirtualClock.advanceTo throw "time cannot go backwards" and abort the run.
    // sampleLatency clamps the inverted range to minLatency so the run stays
    // deterministic and crash-free. Regression guard for the defense-in-depth fix.
    const received: string[] = [];
    const sim = simWithFaults(
      11n,
      ["a", "b"],
      { minLatency: 50, maxLatency: 1, dropProb: 0, dupProb: 0 },
      (from, payload, to) => received.push(`${from}->${to}:${String(payload)}`),
    );
    const a = sim.nodes[0]!;
    sim.scheduler.schedule(0, () => a.env.net.send("b", "ok"), { kind: "kick", nodeId: "a" });

    // Must complete (status "ok") rather than throw on a negative/inverted latency.
    const r = await sim.run({ maxSteps: 10_000 });
    expect(r.status).toBe("ok");
    expect(received).toEqual(["a->b:ok"]);
    // Every delivery must have happened at-or-after its send (t=0).
    const delivers = r.trace.events.filter((e) => e.kind === "deliver");
    expect(delivers.length).toBe(1);
    expect(delivers[0]!.t).toBeGreaterThanOrEqual(0);
  });
});
