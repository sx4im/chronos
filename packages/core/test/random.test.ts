import { describe, it, expect } from "vitest";
import { Rng } from "../src/random.js";

describe("Rng (xoshiro256**)", () => {
  it("same seed produces identical sequence", () => {
    const a = new Rng(42n);
    const b = new Rng(42n);
    for (let i = 0; i < 10; i++) {
      expect(a.nextU64()).toBe(b.nextU64());
    }
  });

  it("getState / setState round-trips and resumes exact sequence", () => {
    const rng1 = new Rng(123n);
    rng1.nextU64();
    rng1.nextU64();
    const state = rng1.getState();

    const rng2 = new Rng(999n); // different seed
    rng2.setState(state);

    // rng2 should now produce exactly what rng1 produces
    const a = rng1.nextU64();
    const b = rng2.nextU64();
    expect(a).toBe(b);
  });

  it("nextFloat stays in [0, 1) over 100k draws", () => {
    const rng = new Rng(0n);
    for (let i = 0; i < 100_000; i++) {
      const v = rng.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds produce different sequences", () => {
    const a = new Rng(1n);
    const b = new Rng(2n);
    let diff = false;
    for (let i = 0; i < 10; i++) {
      if (a.nextU64() !== b.nextU64()) diff = true;
    }
    expect(diff).toBe(true);
  });
});
