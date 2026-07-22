// Network contracts + a dependency-free default network (§3.6).
//
// The fault-injecting SimNetwork lives in @sx4im/chronos-net and is injected into the
// Simulator via its `netFactory` option. This keeps @sx4im/chronos-core free of any
// runtime dependency on @sx4im/chronos-net — the dependency runs one way
// (net → core: SimNetwork needs the Scheduler/Clock/Rng), never the reverse,
// so there is no package cycle. `PartitionManager` is dependency-free, so it
// stays in core: the Simulator owns the instance (for its chaos partition/heal
// controls and per-step GC) and shares it with whatever network is injected.

import type { Scheduler, ScheduleMeta } from "./scheduler.js";
import type { VirtualClock } from "./clock.js";
import type { Rng } from "./random.js";
import { TraceLogger } from "./trace.js";

export interface Message<T = unknown> {
  from: string;
  to: string;
  payload: T;
}

export interface NetworkConfig {
  minLatency: number; // ms
  maxLatency: number; // ms
  dropProb: number; // 0..1 — honored by @sx4im/chronos-net's SimNetwork; ignored by BasicNetwork
  dupProb: number; // 0..1 — honored by @sx4im/chronos-net's SimNetwork; ignored by BasicNetwork
}

export const DEFAULT_NETWORK: NetworkConfig = {
  minLatency: 1,
  maxLatency: 50,
  dropProb: 0,
  dupProb: 0,
};

/** Per-destination message handler. Wired by the Simulator for each node. */
export type DeliverFn = (m: Message) => void;

/**
 * Sample a deterministic delivery latency in `[minLatency, maxLatency]` (inclusive)
 * from the shared RNG. Defensively clamps `minLatency > maxLatency` to
 * `minLatency` so a malformed `NetworkConfig` (e.g. one built directly with
 * `new Simulator({ network: { minLatency: 5, maxLatency: 1 } })` and never run
 * through `validateCapsule`) can never schedule a delivery at a time *before* the
 * send — which would make `VirtualClock.advanceTo` throw "time cannot go
 * backwards" and abort the run. The clamp keeps the run deterministic and
 * crash-free even when the config bypasses capsule validation. The network config
 * that reaches `SimNetwork`/`BasicNetwork` via the Simulator is normally
 * `validateCapsule`-checked (maxLatency >= minLatency), so this is pure defense-in-
 * depth, not a behavior change on the happy path.
 */
export function sampleLatency(
  rng: Rng,
  minLatency: number,
  maxLatency: number,
): number {
  const lo = minLatency;
  const hi = maxLatency < lo ? lo : maxLatency; // clamp inverted range
  return rng.nextInt(lo, hi + 1);
}

/**
 * The minimal surface the Simulator needs from any network: a way to send.
 * @sx4im/chronos-net's SimNetwork satisfies this; so does the core BasicNetwork.
 */
export interface SimNetworkLike {
  send(from: string, to: string, payload: unknown): void;
}

/**
 * What the Simulator hands to an injected `netFactory`: everything a fault
 * network needs to schedule deliveries through the shared deterministic event
 * loop. @sx4im/chronos-net's `SimNetworkOptions` is structurally compatible with this
 * plus a `config: NetworkConfig`.
 */
export interface NetworkContext {
  scheduler: Scheduler;
  clock: VirtualClock;
  rng: Rng;
  partitions: PartitionManager;
  trace: TraceLogger;
  deliver: DeliverFn;
  isDown: (nodeId: string) => boolean;
}

/** Inject a custom network (e.g. @sx4im/chronos-net's SimNetwork) into the Simulator. */
export type NetworkFactory = (ctx: NetworkContext) => SimNetworkLike;

/**
 * Time-windowed partition manager. A partition is a set of node groups that
 * cannot communicate, active over [startTime, endTime). `isBlocked(a, b, t)`
 * is the single query the network uses.
 */
export class PartitionManager {
  private active: { groups: string[][]; start: number; end: number }[] = [];

  partition(groups: string[][], start: number, end: number): void {
    this.active.push({ groups, start, end });
  }

  /** Block a pair only if an active partition separates them at time t. */
  isBlocked(a: string, b: string, t: number): boolean {
    for (const p of this.active) {
      if (t < p.start || t >= p.end) continue;
      const ga = groupOf(p.groups, a);
      const gb = groupOf(p.groups, b);
      if (ga !== -1 && gb !== -1 && ga !== gb) return true;
    }
    return false;
  }

  /** Remove all partitions whose window has ended (housekeeping). */
  gc(now: number): void {
    this.active = this.active.filter((p) => p.end > now);
  }

  clear(): void {
    this.active = [];
  }
}

function groupOf(groups: string[][], node: string): number {
  for (let i = 0; i < groups.length; i++) {
    if (groups[i]!.includes(node)) return i;
  }
  return -1;
}

export interface BasicNetworkOptions {
  scheduler: Scheduler;
  clock: VirtualClock;
  rng: Rng;
  config: NetworkConfig;
  partitions: PartitionManager;
  trace: TraceLogger;
  deliver: DeliverFn;
  isDown?: (nodeId: string) => boolean;
}

/**
 * The dependency-free default network: deterministic latency, no faults.
 *
 * Note: drop/duplicate fault injection lives in @sx4im/chronos-net's SimNetwork,
 * injected via the Simulator's `netFactory`. The default honors partitions and
 * crashes (so targeted chaos tests still pass) and a uniform random latency so
 * the core stays usable — and fully deterministic — with zero extra deps.
 */
export class BasicNetwork implements SimNetworkLike {
  constructor(private o: BasicNetworkOptions) {}

  send(from: string, to: string, payload: unknown): void {
    const t = this.o.clock.now();
    // Partitioned → swallow silently (mimics a dropped link).
    if (this.o.partitions.isBlocked(from, to, t)) return;
    // Destination crashed → message is lost.
    if (this.o.isDown?.(to)) return;

    const summary = TraceLogger.summarize(payload);
    this.o.trace.append(t, { kind: "send", from, to, summary });

    // Defensive clone to guarantee SUT process isolation (nodes must not share payload object references)
    const clonedPayload = payload !== undefined ? structuredClone(payload) : undefined;

    const latency = sampleLatency(
      this.o.rng,
      this.o.config.minLatency,
      this.o.config.maxLatency
    );
    const deliver = () => {
      // Re-check at delivery time: a node may have crashed after the send.
      if (this.o.isDown?.(to)) return;
      this.o.deliver({ from, to, payload: clonedPayload });
      this.o.trace.append(this.o.clock.now(), {
        kind: "deliver",
        from,
        to,
        summary,
      });
    };
    const meta: ScheduleMeta = {
      kind: "deliver",
      nodeId: to,
      from,
      to,
      summary,
    };
    this.o.scheduler.schedule(t + latency, deliver, meta);
  }
}
