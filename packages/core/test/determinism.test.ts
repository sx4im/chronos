// The determinism guard — the soul of the project.
// Run a non-trivial scenario twice from the same seed; the recorded traces must
// be deeply equal. If this test EVER fails or flakes, it is bug class #1: a
// component is reading hidden entropy (Date.now, Math.random, a real timer, etc.).

import { describe, it, expect } from "vitest";
import { VirtualClock } from "../src/clock.js";
import { Rng } from "../src/random.js";
import { Scheduler, type SimEvent } from "../src/scheduler.js";
import { createEnv, type SimEnv } from "../src/env.js";

interface Trace {
  events: { t: number; seq: number; kind: string; nodeId: string }[];
  obs: string[]; // RNG draws + timing observations, in execution order
}

// A scenario with several nodes doing sleeps, RNG draws, and timers — all drawing
// from the single shared seeded RNG via the scheduler. The exact interleaving is
// decided by the scheduler's (time, seq) ordering, which is a pure function of
// the seed.
async function runScenario(seed: bigint): Promise<Trace> {
  const clock = new VirtualClock();
  const rng = new Rng(seed);
  const scheduler = new Scheduler(clock, rng);

  const events: Trace["events"] = [];
  const obs: string[] = [];

  const ids = ["a", "b", "c"];
  const envs: SimEnv[] = ids.map((id) =>
    createEnv({ scheduler, clock, rng, nodeId: id }),
  );

  async function nodeBody(env: SimEnv): Promise<void> {
    const r1 = env.random();
    obs.push(`${env.nodeId}:r1=${r1.toFixed(9)}`);
    await env.sleep(rng.nextInt(1, 50));
    const r2 = env.random();
    obs.push(`${env.nodeId}:r2=${r2.toFixed(9)}`);
    env.setTimeout(
      () => {
        const r3 = env.random();
        obs.push(`${env.nodeId}:r3=${r3.toFixed(9)}`);
      },
      rng.nextInt(1, 30),
    );
    await env.sleep(rng.nextInt(1, 40));
    obs.push(`${env.nodeId}:done@${env.now()}`);
  }

  // Kick off each node body at staggered start times so they interleave.
  ids.forEach((id, i) => {
    scheduler.schedule(i * 2, () => nodeBody(envs[i]!), {
      kind: "kick",
      nodeId: id,
    });
  });

  // Run, recording every popped event.
  await scheduler.run({
    onStep: (ev: SimEvent) =>
      events.push({
        t: ev.time,
        seq: ev.seq,
        kind: ev.kind,
        nodeId: ev.nodeId ?? "",
      }),
  });

  return { events, obs };
}

const SEEDS: bigint[] = [
  0n, 1n, 2n, 3n, 42n, 99n, 123n, 777n, 1000n, 2024n,
  31337n, 65535n, 100000n, 2718281n, 3141592n, 4204204n,
  8675309n, 9000001n, 123456789n, 0xdeadbeefn,
];

describe("determinism guard — same seed => identical trace", () => {
  it.for(SEEDS)("seed %s reproduces an identical trace across two runs", async (seed) => {
    const traceA = await runScenario(seed);
    const traceB = await runScenario(seed);
    expect(traceB).toEqual(traceA);
  });

  it("different seeds CAN produce different traces (sanity)", async () => {
    const a = await runScenario(1n);
    const b = await runScenario(2n);
    // They should almost always differ (extremely unlikely to coincide by chance).
    expect(a).not.toEqual(b);
  });
});
