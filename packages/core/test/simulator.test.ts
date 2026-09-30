import { describe, it, expect } from "vitest";
import { Simulator } from "../src/simulator.js";
import { withSimEnv, getSimEnv } from "../src/env.js";
import type { Trace } from "../src/trace.js";

describe("Simulator", () => {
  it("constructs, runs, and returns an ok Trace", async () => {
    const sim = new Simulator({ seed: 1n, nodes: 3 });
    sim.addInvariant({ name: "trivially true", check: () => true });
    const result = await sim.run();
    expect(result.status).toBe("ok");
    expect(result.trace.result).toBe("ok");
    expect(result.trace.nodes).toEqual(["node-0", "node-1", "node-2"]);
    expect(result.trace.seed).toBe("1");
    expect(Array.isArray(result.trace.events)).toBe(true);
  });

  it("records a violation and stops when a safety invariant fails", async () => {
    const sim = new Simulator({ seed: 7n, nodes: 2 });
    sim.addInvariant({
      name: "time never exceeds 5",
      check: (w) => w.time <= 5,
    });
    sim.scheduler.schedule(10, () => {}, { kind: "wake", nodeId: "node-0" });

    const result = await sim.run();
    expect(result.status).toBe("violation");
    if (result.status === "violation") {
      expect(result.invariant).toBe("time never exceeds 5");
      expect(result.trace.result).toBe("violation");
      const v = result.trace.events.find((e) => e.kind === "invariant-violation");
      expect(v).toBeDefined();
    }
  });

  it("reports timeout (never ok) when the step budget truncates a pending queue", async () => {
    const sim = new Simulator({ seed: 3n, nodes: 1 });
    // Five events; the budget allows only two steps.
    for (let i = 1; i <= 5; i++) {
      sim.scheduler.schedule(i, () => {}, { kind: "wake", nodeId: "node-0" });
    }
    const result = await sim.run({ maxSteps: 2 });
    expect(result.status).toBe("timeout");
    if (result.status === "timeout") {
      expect(result.steps).toBe(2);
      expect(result.pending).toBe(3);
      expect(result.trace.result).toBe("timeout"); // visible in the Trace too
    }
  });

  it("skips liveness invariants on a truncated run but checks them on completion", async () => {
    // A liveness invariant that only holds once the system actually settles.
    // Under a truncated budget it must NOT fire (end-of-run is an artifact of
    // the budget); on a real drain it MUST be checked.
    let checked = false;
    const liveness = {
      kind: "liveness" as const,
      name: "eventually all done",
      check: () => {
        checked = true;
        return true;
      },
    };

    const truncated = new Simulator({ seed: 5n, nodes: 1 });
    truncated.addInvariant(liveness);
    for (let i = 1; i <= 4; i++) {
      truncated.scheduler.schedule(i, () => {}, {
        kind: "wake",
        nodeId: "node-0",
      });
    }
    const t = await truncated.run({ maxSteps: 2 });
    expect(t.status).toBe("timeout");
    expect(checked).toBe(false); // skipped — no fake "liveness holds"

    checked = false;
    const complete = new Simulator({ seed: 5n, nodes: 1 });
    complete.addInvariant({ ...liveness });
    complete.scheduler.schedule(1, () => {}, {
      kind: "wake",
      nodeId: "node-0",
    });
    const c = await complete.run();
    expect(c.status).toBe("ok");
    expect(checked).toBe(true); // genuinely end-of-run → checked
  });

  it("delivers messages between nodes via env.net", async () => {
    const sim = new Simulator({
      seed: 42n,
      nodes: ["a", "b"],
      network: { minLatency: 5, maxLatency: 5, dropProb: 0, dupProb: 0 },
    });
    const received: string[] = [];
    const a = sim.nodes[0]!;
    const b = sim.nodes[1]!;

    b.env.net.onReceive((from, payload) => {
      received.push(`${from}->b:${String(payload)}`);
    });
    sim.scheduler.schedule(0, () => a.env.net.send(b.id, "hello"), {
      kind: "kick",
      nodeId: "a",
    });

    await sim.settle();
    expect(received).toEqual(["a->b:hello"]);
    expect(sim.clock.now()).toBe(5);
  });

  it("deterministically: two runs of the same seed produce equal traces", async () => {
    const mk = () =>
      new Simulator({
        seed: 999n,
        nodes: 3,
        network: { minLatency: 1, maxLatency: 10, dropProb: 0.1, dupProb: 0.1 },
      },
      );

    const run = async (): Promise<Trace> => {
      const sim = mk();
      // Each node, on receiving a message, schedules a short wake that draws
      // from the RNG — so the trace is sensitive to schedule and RNG state.
      sim.nodes.forEach((n) => {
        n.env.net.onReceive(() => {
          const delay = 1 + Math.floor(n.env.random() * 5);
          n.env.setTimeout(() => {
            void n.env.random();
          }, delay);
        });
      });
      const a = sim.nodes[0]!;
      const one = sim.nodes[1]!;
      const two = sim.nodes[2]!;
      sim.scheduler.schedule(
        0,
        () => {
          a.env.net.send(one.id, "ping");
          a.env.net.send(two.id, "ping");
        },
        { kind: "kick", nodeId: a.id },
      );
      await sim.settle();
      return (await sim.run()).trace;
    };

    const t1 = await run();
    const t2 = await run();
    expect(t2).toEqual(t1);
  });

  it("provides AsyncLocalStorage implicit SimEnv context via withSimEnv and getSimEnv", () => {
    const sim = new Simulator({ seed: 1n, nodes: 1 });
    const env = sim.nodes[0]!.env;

    expect(getSimEnv()).toBeUndefined();
    withSimEnv(env, () => {
      expect(getSimEnv()).toBe(env);
      expect(getSimEnv()?.nodeId).toBe("node-0");
    });
    expect(getSimEnv()).toBeUndefined();
  });

  it("captures actual network config from netFactory in trace snapshot", async () => {
    const customConfig = {
      minLatency: 20,
      maxLatency: 40,
      dropProb: 0.25,
      dupProb: 0.15,
    };
    const sim = new Simulator({
      seed: 1n,
      nodes: 2,
      netFactory: () => ({
        send: () => {},
        getConfig: () => customConfig,
      }),
    });
    const r = await sim.run();
    expect(r.trace.config.network).toEqual(customConfig);
  });
});
