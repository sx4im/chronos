import { describe, it, expect } from "vitest";
import { VirtualClock } from "../src/clock.js";

describe("VirtualClock", () => {
  it("starts at 0", () => {
    const clock = new VirtualClock();
    expect(clock.now()).toBe(0);
  });

  it("advances forward", () => {
    const clock = new VirtualClock();
    clock.advanceTo(100);
    expect(clock.now()).toBe(100);
    clock.advanceTo(100); // same time is allowed (no backwards)
    expect(clock.now()).toBe(100);
    clock.advanceTo(250);
    expect(clock.now()).toBe(250);
  });

  it("throws if time moves backwards", () => {
    const clock = new VirtualClock();
    clock.advanceTo(100);
    expect(() => clock.advanceTo(99)).toThrow(/cannot go backwards/);
  });

  // Finite-time guard (security audit B5): `NaN < now` is `false`, so a NaN time
  // would silently slip past the backwards-time guard and poison `_now` to NaN —
  // and every downstream heap comparison would then return NaN, ordering events
  // nondeterministically. The finite check must run BEFORE the backwards check.
  it("rejects NaN before the backwards check (does not poison now)", () => {
    const clock = new VirtualClock();
    clock.advanceTo(100);
    expect(() => clock.advanceTo(NaN)).toThrow(/finite/);
    // The guard threw before mutating, so the clock is unchanged — not NaN.
    expect(clock.now()).toBe(100);
    expect(Number.isFinite(clock.now())).toBe(true);
  });

  it("rejects ±Infinity", () => {
    const clock = new VirtualClock();
    expect(() => clock.advanceTo(Infinity)).toThrow(/finite/);
    expect(() => clock.advanceTo(-Infinity)).toThrow(/finite/);
    expect(clock.now()).toBe(0);
  });
});
