// simTest (§4.4) — the Vitest wrapper over the pure engine.
//
// `simTest` runs a scenario across seeds; on the first violating seed it writes a
// failure capsule and fails the Vitest test with the seed + capsule path. Only
// the Vitest glue lives here — `runSimTest`/`resolveSeeds`/`executeScenario` live
// in `./engine.ts` (vitest-free) so the `@sx4im/chronos-cli` bin can replay capsules
// without importing Vitest. Honors the `CHRONOS_SEED` env var to force a single
// seed (CI replay); built on Vitest's `test`.

import { test } from "vitest";
import type { SimTestBody, SimTestOptions } from "./types.js";
import { runSimTest } from "./engine.js";

export interface SimTestFn {
  (name: string, opts: SimTestOptions, body: SimTestBody): void;
  only: (name: string, opts: SimTestOptions, body: SimTestBody) => void;
  skip: (name: string, opts: SimTestOptions, body: SimTestBody) => void;
}

// Minimal callable shape we need from vitest's `test` / `test.only` / `test.skip`.
// vitest's `test` is a TestAPI; `.only`/`.skip` are the narrower ChainableFunction. Both
// satisfy this plain `(name, fn)` signature, which is all `register` uses — so we avoid
// the TestAPI-vs-ChainableFunction mismatch exactOptional strictness surfaces.
type TestRegistrar = (name: string, fn: () => void | Promise<void>) => void;

/** A vitest test that fails loudly (seed + capsule path) on the first violation. */
function register(api: TestRegistrar): (name: string, opts: SimTestOptions, body: SimTestBody) => void {
  return (name, opts, body) => {
    api(name, async () => {
      const r = await runSimTest(opts, body);
      if (r.violated && r.invariant && r.capsulePath) {
        throw new Error(
          `✗ seed ${r.seed} violated "${r.invariant.name}" — ${r.invariant.detail}\n` +
            `  → wrote capsule: ${r.capsulePath}\n` +
            `  → replay with: npx chronos replay ${r.capsulePath}`,
        );
      }
    });
  };
}

export const simTest = register(test) as SimTestFn;
simTest.only = register(test.only);
simTest.skip = register(test.skip);
