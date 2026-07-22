// Public types for the Vitest integration (§4.4).

import type { Simulator, ChaosConfig, Trace } from "@sx4im/chronos-core";
import type { NetworkConfig, NetworkFactory } from "@sx4im/chronos-core";

export interface SimTestOptions {
  /** Seeds to sweep. A count runs `[0n .. n-1n]` deterministically; an array runs
   * exactly those. Overridden by the `CHRONOS_SEED` env var (single seed, CI replay). */
  seeds: number | bigint[];
  nodes: number | string[];
  network?: Partial<NetworkConfig>;
  chaos?: ChaosConfig;
  /** Inject a fault network (e.g. @sx4im/chronos-net's SimNetwork). Without it the
   * default dependency-free core network is used. */
  netFactory?: NetworkFactory;
  maxSteps?: number;
  /** Where to write failure capsules. Defaults to `.chronos` (→ `.chronos/failures/<seed>.json`). */
  chronosDir?: string;
}

/** The test body receives the Simulator; it drives the scenario and may call
 * `expectInvariant` (a bare import resolved via the active-sim registrar). */
export type SimTestBody = (sim: Simulator) => void | Promise<void>;

/** Minimum to reproduce + the Trace for humans (§3.18). Everything here is
 *  JSON-serializable so a capsule can be saved, shared, and `chronos replay`ed. */
export interface FailureCapsule {
  chronosVersion: string;
  seed: string; // stringified BigInt
  nodes: string[];
  config: { network: NetworkConfig; chaos: Required<ChaosConfig> };
  maxSteps: number;
  invariant: { name: string; detail: string };
  trace: Trace;
}

export interface ScenarioOutcome {
  violated: boolean;
  seed: bigint;
  invariant?: { name: string; detail: string };
  capsulePath?: string;
}
