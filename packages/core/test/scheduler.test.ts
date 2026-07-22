import { describe, it, expect } from "vitest";
import { VirtualClock } from "../src/clock.js";
import { Rng } from "../src/random.js";
import { Scheduler, drainMicrotasks } from "../src/scheduler.js";
import { createEnv } from "../src/env.js";

function makeScheduler(seed = 1n): { scheduler: Scheduler; clock: VirtualClock; rng: Rng } {
  const clock = new VirtualClock();
  const rng = new Rng(seed);
  const scheduler = new Scheduler(clock, rng);
  return { scheduler, clock, rng };
}

describe("Scheduler", () => {
  it("pops events ordered by time, then seq", async () => {
    const { scheduler, clock } = makeScheduler();
    const order: string[] = [];

    scheduler.schedule(10, () => order.push("t10-seq0"), {});
    scheduler.schedule(5, () => order.push("t5-seq1"), {});
    scheduler.schedule(10, () => order.push("t10-seq2"), {}); // tie with first
    scheduler.schedule(2, () => order.push("t2"), {});

    await scheduler.run();
    // earliest time first; at equal time, lower seq (insertion order) first.
    expect(order).toEqual(["t2", "t5-seq1", "t10-seq0", "t10-seq2"]);
    expect(clock.now()).toBe(10);
  });

  it("await env.sleep(ms) resumes at the right virtual time", async () => {
    const { scheduler, clock, rng } = makeScheduler();
    const env = createEnv({ scheduler, clock, rng, nodeId: "a" });
    const resumed: number[] = [];

    await (async () => {
      // schedule a sleep that resolves at t=100
      env.sleep(100).then(() => resumed.push(clock.now()));
      await scheduler.run();
    })();

    expect(resumed).toEqual([100]);
    expect(clock.now()).toBe(100);
  });

  it("two sleeps with different delays resume in correct order", async () => {
    const { scheduler, clock, rng } = makeScheduler();
    const envA = createEnv({ scheduler, clock, rng, nodeId: "a" });
    const envB = createEnv({ scheduler, clock, rng, nodeId: "b" });
    const log: string[] = [];

    // A sleeps 100, B sleeps 50 — B must resume first.
    envA.sleep(100).then(() => log.push(`A@${clock.now()}`));
    envB.sleep(50).then(() => log.push(`B@${clock.now()}`));

    await scheduler.run();
    expect(log).toEqual(["B@50", "A@100"]);
    expect(clock.now()).toBe(100);
  });

  it("nested awaits that schedule new events mid-step are picked up in seq order", async () => {
    const { scheduler, clock, rng } = makeScheduler();
    const env = createEnv({ scheduler, clock, rng, nodeId: "a" });
    const log: string[] = [];

    // Two pre-existing timers at t=10 (seq 0 and 1).
    scheduler.schedule(10, () => log.push("first@t10"), { kind: "timer" });
    scheduler.schedule(10, () => log.push("second@t10"), { kind: "timer" });

    // An async body scheduled at t=0 (seq 2). When it runs, it sleeps until t=10,
    // which enqueues a wake at (10, seq 3) — strictly later than the two timers above.
    scheduler.schedule(
      0,
      async () => {
        await env.sleep(10); // schedules a wake at (10, seq 3)
        // Now at virtual t=10 we schedule a NEW timer at the current time.
        // Its seq (4) is the highest of all t=10 events, so it runs LAST.
        scheduler.schedule(10, () => log.push("mid-step-new@t10"), {});
        log.push("body-resumed@t10");
      },
      { kind: "wake" },
    );

    await scheduler.run();
    // Deterministic order:
    //   1) the two pre-existing t=10 timers (seq 0, 1) fire before the wake,
    //   2) the wake (seq 3) resumes the body, which logs + schedules (seq 4),
    //   3) the mid-step-new timer (seq 4) fires last.
    expect(log).toEqual([
      "first@t10",
      "second@t10",
      "body-resumed@t10",
      "mid-step-new@t10",
    ]);
    expect(clock.now()).toBe(10);
  });

  it("honors maxSteps", async () => {
    const { scheduler } = makeScheduler();
    const seen: number[] = [];
    for (let i = 0; i < 10; i++) scheduler.schedule(i, () => seen.push(i), {});
    await scheduler.run({ maxSteps: 3 });
    // Only the first 3 popped events run (they happen to be the three earliest).
    expect(seen.length).toBe(3);
    // Remaining events are still in the queue.
    expect(scheduler.pendingCount()).toBe(7);
  });

  it("cancelNode skips a node's pending events", async () => {
    const { scheduler } = makeScheduler();
    const log: string[] = [];
    scheduler.schedule(1, () => log.push("a1"), { nodeId: "a" });
    scheduler.schedule(2, () => log.push("b1"), { nodeId: "b" });
    scheduler.schedule(3, () => log.push("a2"), { nodeId: "a" });

    scheduler.cancelNode("a");
    await scheduler.run();
    expect(log).toEqual(["b1"]); // a's events were canceled
  });

  it("drainMicrotasks flushes pending microtasks", async () => {
    let ran = false;
    Promise.resolve().then(() => {
      ran = true;
    });
    await drainMicrotasks();
    expect(ran).toBe(true);
  });

  // Finite-time guard (security audit B5): a NaN scheduled time must be rejected
  // at the schedule boundary, before it reaches the heap comparator — otherwise
  // `a.time - b.time` returns NaN and the (time, seq) ordering silently breaks
  // (events fire out of virtual-time order → nondeterminism). The usual entry
  // path is `env.sleep(NaN)` / a malformed capsule config.
  it("rejects a non-finite scheduled time before it reaches the heap", () => {
    const { scheduler } = makeScheduler();
    expect(() => scheduler.schedule(NaN, () => {}, {})).toThrow(/finite/);
    expect(() => scheduler.schedule(Infinity, () => {}, {})).toThrow(/finite/);
    expect(() => scheduler.schedule(-Infinity, () => {}, {})).toThrow(/finite/);
    // Nothing was enqueued — the guard threw before the heap.push.
    expect(scheduler.pendingCount()).toBe(0);
  });
});
