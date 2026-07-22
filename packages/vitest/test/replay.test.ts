// Committed-capsule replay regression suite (testing-strategy: "capsule
// fixtures + a replay test that replays each").
//
// Every capsule under fixtures/capsules/ was produced by fixtures/replayScenario.ts
// and committed. Replaying it must reproduce the SAME invariant violation with a
// BIT-IDENTICAL trace — `replayCapsule` compares the re-run's events against the
// capsule's recorded events. If any change to the RNG, scheduler ordering,
// network delivery, or chaos engine alters the trace, this suite fails: that is
// the point. Regenerate deliberately via fixtures/generateFixture.ts and say why
// in the commit message.

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { replayCapsule, readCapsule } from "@sx4im/chronos-vitest";
import { body, netFactory } from "./fixtures/replayScenario.js";

const capsulesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "capsules"
);
const capsuleFiles = readdirSync(capsulesDir).filter((f) =>
  f.endsWith(".json")
);

describe("committed capsule fixtures replay bit-for-bit", () => {
  it("has at least one committed capsule", () => {
    expect(capsuleFiles.length).toBeGreaterThan(0);
  });

  for (const file of capsuleFiles) {
    it(`${file} reproduces its recorded violation and trace`, async () => {
      const path = join(capsulesDir, file);
      const capsule = await readCapsule(path); // also re-validates the fixture
      const rep = await replayCapsule(path, body, netFactory);
      expect(rep.violation?.name).toBe(capsule.invariant.name);
      // `reproduced` is only true when the re-run trace's events are
      // JSON-identical to the capsule's recorded events — the determinism proof.
      expect(rep.reproduced).toBe(true);
    });
  }
});
