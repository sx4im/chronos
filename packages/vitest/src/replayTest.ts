// replayTest (§4.4) — re-run a saved capsule as a focused Vitest test.
//
// `replayCapsule` lives in `./engine.ts` (vitest-free) so the `@sx4im/chronos-cli` bin
// can reuse the exact same reproduction logic without importing Vitest. This
// module is the thin Vitest `test()` wrapper over it.

import { test, expect } from "vitest";
import type { SimTestBody } from "./types.js";
import type { NetworkFactory } from "@sx4im/chronos-core";
import { replayCapsule } from "./engine.js";
import { readCapsule } from "./capsule.js";

export function replayTest(capsulePath: string, body?: SimTestBody, netFactory?: NetworkFactory): void {
  test(`replay ${capsulePath}`, async () => {
    const capsule = await readCapsule(capsulePath);
    expect(capsule.trace.result).toBe("violation");

    if (!body) {
      // Smoke: capsule loads and records a violation.
      expect(capsule.invariant.name).toBeTruthy();
      return;
    }

    const { reproduced, violation, trace } = await replayCapsule(capsulePath, body, netFactory);
    expect(violation).toBeDefined();
    expect(violation?.name).toBe(capsule.invariant.name);
    expect(reproduced).toBe(true);
    expect(trace.events).toEqual(capsule.trace.events);
  });
}
