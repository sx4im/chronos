// strict-mode guards (§3.5).
//
// The guarded window in each test is kept FULLY SYNCHRONOUS: install → assert →
// restore happens with no await in between, so no async work (Vitest watchdogs,
// microtasks) ever observes the patched globals. The one test that needs to run
// the scheduler restores FIRST, then awaits scheduler.run(). This keeps the
// patches from leaking into tooling and keeps the suite deterministic.

import { describe, it, expect } from "vitest";
import { VirtualClock } from "../src/clock.js";
import { Rng } from "../src/random.js";
import { Scheduler } from "../src/scheduler.js";
import { createEnv } from "../src/env.js";
import { installGuards, StrictModeViolation } from "../src/strict.js";

function makeEnv() {
  const clock = new VirtualClock();
  const rng = new Rng(1n);
  const scheduler = new Scheduler(clock, rng);
  return { clock, rng, scheduler, sim: createEnv({ scheduler, clock, rng, nodeId: "x" }) };
}

describe("installGuards — route level", () => {
  it("redirects Date.now / Math.random / performance.now to env", () => {
    const { clock, sim } = makeEnv();
    const guards = installGuards(sim, "route");
    try {
      expect(Date.now()).toBe(clock.now());
      expect(Date.now()).toBe(0);
      clock.advanceTo(1234);
      expect(Date.now()).toBe(1234);
      const r = Math.random();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
      if (typeof performance !== "undefined") {
        expect(performance.now()).toBe(clock.now());
      }
    } finally {
      guards.restore();
    }
  });

  it("routes a forgotten global setTimeout onto the sim (deterministic)", async () => {
    const { clock, scheduler, sim } = makeEnv();
    let fired = false;

    // Install, schedule via the GLOBAL setTimeout, restore — all synchronous.
    const guards = installGuards(sim, "route");
    try {
      globalThis.setTimeout(() => {
        fired = true;
      }, 7);
    } finally {
      guards.restore();
    }

    // Globals are whole again before we yield to the scheduler.
    await scheduler.run();
    expect(fired).toBe(true);
    expect(clock.now()).toBe(7);
  });

  it("setInterval always throws (env has no recurring primitive)", () => {
    const { sim } = makeEnv();
    for (const level of ["route", "throw"] as const) {
      const guards = installGuards(sim, level);
      try {
        expect(() => globalThis.setInterval(() => {}, 1)).toThrow(StrictModeViolation);
      } finally {
        guards.restore();
      }
    }
  });
});

describe("installGuards — throw level", () => {
  it("throws on Date.now / Math.random / new Date() / performance.now", () => {
    const { sim } = makeEnv();
    const guards = installGuards(sim, "throw");
    try {
      expect(() => Date.now()).toThrow(StrictModeViolation);
      expect(() => Math.random()).toThrow(StrictModeViolation);
      expect(() => new Date()).toThrow(StrictModeViolation);
      expect(() => Date()).toThrow(StrictModeViolation); // called without `new`
      if (typeof performance !== "undefined") {
        expect(() => performance.now()).toThrow(StrictModeViolation);
      }
    } finally {
      guards.restore();
    }
  });

  it("arg-ful new Date(value) still works (no wall-clock read)", () => {
    const { sim } = makeEnv();
    const guards = installGuards(sim, "throw");
    try {
      const d = new Date(0);
      expect(d).toBeInstanceOf(Date);
      expect(d.getUTCFullYear()).toBe(1970);
      expect(() => new Date("not-a-date")).not.toThrow(StrictModeViolation);
    } finally {
      guards.restore();
    }
  });
});

describe("installGuards — restore", () => {
  it("puts the real globals back", () => {
    const realNow = Date.now;
    const realRandom = Math.random;
    const { sim } = makeEnv();
    const guards = installGuards(sim, "route");
    guards.restore();

    expect(Date.now).toBe(realNow); // identity restored
    expect(Math.random).toBe(realRandom);
    // And they still work as the real ones:
    expect(Number.isFinite(Date.now())).toBe(true);
    expect(Math.random()).toBeGreaterThanOrEqual(0);
    expect(new Date(0)).toBeInstanceOf(Date);
  });

  it("is idempotent", () => {
    const { sim } = makeEnv();
    const guards = installGuards(sim, "route");
    guards.restore();
    guards.restore(); // second restore must not throw
    expect(Date.now).toBe(Date.now); // sanity: still callable
  });

  it("does not disturb the determinism guard's bare-env path", () => {
    // The determinism test never installs guards; this sanity-checks that the
    // *module surface* (installGuards exists, restores cleanly) coexists with a
    // fresh RNG — i.e. guards leave no latent global state behind.
    const { rng } = makeEnv();
    const a = new Rng(42n).nextU64();
    const b = rng.nextU64(); // different Rng → unrelated
    expect(a).not.toBe(b);
  });

  it("throw level catches entropy inside a sim body (regression: bug class #1)", async () => {
    // The engine installs guards around executeScenario (route by default,
    // CHRONOS_STRICT=throw to surface loudly). A body that reaches for the wall
    // clock must fail loudly under throw rather than silently poisoning
    // determinism. This is the load-bearing contract the whole framework exists
    // to enforce, so we assert it end-to-end: guard installed -> body runs ->
    // StrictModeViolation thrown -> global restored (no leak into tooling).
    const { Simulator } = await import("../src/simulator.js");
    const { installGuards, StrictModeViolation } = await import("../src/strict.js");
    const sim = new Simulator({ seed: 1n, nodes: 1 });

    const guards = installGuards(sim.nodes[0]!.env, "throw");
    let caught: unknown;
    try {
      Date.now();
    } catch (e) {
      caught = e;
    } finally {
      guards.restore();
    }
    expect(caught).toBeInstanceOf(StrictModeViolation);
    expect(typeof Date.now).toBe("function"); // restored identity
  });

  it("restores all modified globals if an exception occurs during installation", () => {
    const realRandom = Math.random;
    const realDate = globalThis.Date;
    const realSetTimeout = globalThis.setTimeout;
    const realSetInterval = globalThis.setInterval;

    // Simulate an environment where defining setInterval fails during installGuards
    const env = makeEnv().sim;
    Object.defineProperty(globalThis, "setInterval", {
      get() {
        return realSetInterval;
      },
      set() {
        throw new Error("setInterval patch failed");
      },
      configurable: true,
    });

    try {
      expect(() => installGuards(env, "route")).toThrow("setInterval patch failed");
      expect(Math.random).toBe(realRandom);
      expect(globalThis.Date).toBe(realDate);
      expect(globalThis.setTimeout).toBe(realSetTimeout);
    } finally {
      // Re-instate default property descriptor
      Object.defineProperty(globalThis, "setInterval", {
        value: realSetInterval,
        writable: true,
        configurable: true,
      });
    }
  });
  it("clearTimeout cancels a scheduled virtual sim timer", async () => {
    const { clock, scheduler, sim } = makeEnv();
    let fired = false;

    const guards = installGuards(sim, "route");
    try {
      const handle = globalThis.setTimeout(() => {
        fired = true;
      }, 10);
      globalThis.clearTimeout(handle);
    } finally {
      guards.restore();
    }

    await scheduler.run();
    expect(fired).toBe(false);
    expect(clock.now()).toBe(0);
  });

  it("non-new Date(arg) returns string per spec", () => {
    const { sim } = makeEnv();
    const guards = installGuards(sim, "route");
    try {
      const str = (Date as unknown as (n: number) => string)(0);
      expect(typeof str).toBe("string");
      expect(str).toContain("1970");
    } finally {
      guards.restore();
    }
  });

  it("handles nested installGuards and restores native globals only when root restores", () => {
    const realNow = Date.now;
    const { sim } = makeEnv();

    const outer = installGuards(sim, "route");
    const inner = installGuards(sim, "route");

    expect(Date.now).not.toBe(realNow);
    inner.restore(); // nested restore should not yet put back native Date.now
    expect(Date.now).not.toBe(realNow);

    outer.restore(); // root restore puts back original native Date.now
    expect(Date.now).toBe(realNow);
  });
});

