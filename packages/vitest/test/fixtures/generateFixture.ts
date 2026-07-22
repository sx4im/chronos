// Regenerates the committed capsule fixture(s) in ./capsules/ from
// ./replayScenario.ts. Run from the repo root with:
//
//   npx vite-node --config vitest.config.ts packages/vitest/test/fixtures/generateFixture.ts
//
// Only regenerate after a DELIBERATE, understood change to the trace format or
// event ordering — the whole point of the committed capsule is to fail
// replay.test.ts when the trace changes unintentionally.

import { mkdtempSync, mkdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// The `engine` subpath is Vitest-free — the main barrel would drag in `vitest`,
// which refuses to load outside a test run.
import { runSimTest } from "@sx4im/chronos-vitest/engine";
import {
  body,
  nodes,
  network,
  chaos,
  maxSteps,
  netFactory,
} from "./replayScenario.js";

const here = dirname(fileURLToPath(import.meta.url));
const capsulesDir = join(here, "capsules");

const tmp = mkdtempSync(join(tmpdir(), "chronos-fixture-"));
const out = await runSimTest(
  { seeds: 64, nodes, network, chaos, maxSteps, netFactory, chronosDir: tmp },
  body
);

if (!out.violated || !out.capsulePath) {
  throw new Error(
    "no seed in 0..63 violated — widen the sweep or raise fault rates"
  );
}

mkdirSync(capsulesDir, { recursive: true });
const dest = join(capsulesDir, `counter-${out.seed}.json`);
copyFileSync(out.capsulePath, dest);
process.stdout.write(
  `wrote ${dest} (seed ${out.seed}, "${out.invariant?.name}")\n`
);
