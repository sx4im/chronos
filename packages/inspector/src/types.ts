// Local capsule shape for the Inspector (§3.8 / §3.18).
//
// Declared locally rather than imported from @sx4im/chronos-vitest so the Inspector
// has zero runtime dependency beyond react — it only needs to READ the JSON a
// capsule already is. The shape mirrors @sx4im/chronos-vitest's `FailureCapsule` and
// @sx4im/chronos-core's `Trace` exactly (they are the stable surface replay and this
// UI both depend on).

import type { Trace, TraceEvent, TraceEventInit } from "@sx4im/chronos-core";

export type { Trace, TraceEvent, TraceEventInit };

/** The on-disk failure capsule, as read by the Inspector. Mirrors the
 * `FailureCapsule` written by @sx4im/chronos-vitest's `buildCapsule`. */
export interface Capsule {
  chronosVersion: string;
  seed: string; // stringified BigInt
  nodes: string[];
  config: unknown;
  maxSteps: number;
  invariant: { name: string; detail: string };
  trace: Trace;
}
