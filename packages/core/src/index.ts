// @sx4im/chronos-core — Deterministic Simulation Testing primitives for Node.js/TypeScript.
//
// Re-exports all core layer pieces. Subpath exports (`/real`, `/trace`) live in
// their own modules to keep the main entry lean.

export { Rng } from "./random.js";
export { VirtualClock } from "./clock.js";
export { MinHeap } from "./heap.js";
export {
  Scheduler,
  drainMicrotasks,
  type SimEvent,
  type ScheduleMeta,
  type RunOptions as SchedulerRunOptions,
} from "./scheduler.js";
export {
  createEnv,
  makeSleep,
  makeSetTimeout,
  noopNet,
  withSimEnv,
  getSimEnv,
  type SimEnv,
  type SimNet,
  type TimerHandle,
  type CreateEnvOptions,
} from "./env.js";
export {
  BasicNetwork,
  PartitionManager,
  DEFAULT_NETWORK,
  sampleLatency,
  type DeliverFn,
  type NetworkConfig,
  type NetworkContext,
  type NetworkFactory,
  type BasicNetworkOptions,
  type Message,
  type SimNetworkLike,
} from "./network.js";
export {
  TraceLogger,
  type Trace,
  type TraceEvent,
  type TraceEventInit,
} from "./trace.js";
export {
  type Invariant,
  type WorldView,
  InvariantViolated,
  checkInvariant,
} from "./invariants.js";
export {
  installGuards,
  StrictModeViolation,
  type StrictLevel,
  type InstalledGuards,
} from "./strict.js";
export {
  Simulator,
  type SimulatorOptions,
  type SimNode,
  type ChaosConfig,
  type RunResult,
  type RunOptions as SimulatorRunOptions,
} from "./simulator.js";

export const CHRONOS_VERSION = "0.0.0";
