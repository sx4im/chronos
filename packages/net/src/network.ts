// Simulated Network (§3.6) + fault injection (§3.7).
//
// `SimNetwork` lives in @sx4im/chronos-net (depends on @sx4im/chronos-core) so the fault
// layer can evolve without polluting the dep-free core. The Simulator injects
// it through its `netFactory` option; core's BasicNetwork is the default.
//
// Nodes never open real sockets. `send` schedules a `deliver` event at
// `now + latency`, where latency/drop/duplicate come from the shared RNG.
// Message reordering and faults emerge naturally and deterministically because
// delivery flows through the same (time, seq) heap.

import type { Scheduler, ScheduleMeta } from "@sx4im/chronos-core";
import type { VirtualClock } from "@sx4im/chronos-core";
import type { Rng } from "@sx4im/chronos-core";
import { TraceLogger, PartitionManager, DEFAULT_NETWORK, sampleLatency } from "@sx4im/chronos-core";
import type { Message, NetworkConfig, DeliverFn } from "@sx4im/chronos-core";

// Re-export so consumers can import the full net surface from "@sx4im/chronos-net".
export { PartitionManager, DEFAULT_NETWORK, sampleLatency };
export type { Message, NetworkConfig, DeliverFn, TraceLogger };

export interface SimNetworkOptions {
  scheduler: Scheduler;
  clock: VirtualClock;
  rng: Rng;
  config: NetworkConfig;
  partitions: PartitionManager;
  trace: TraceLogger;
  /** Routes a delivered message to the destination node's handler. */
  deliver: DeliverFn;
  /** Nodes whose inbox is currently "down" (crashed); messages to them are swallowed. */
  isDown?: (nodeId: string) => boolean;
}

export class SimNetwork {
  constructor(private o: SimNetworkOptions) {}

  send(from: string, to: string, payload: unknown): void {
    const t = this.o.clock.now();

    // Partitioned → swallow silently (mimics a dropped link).
    if (this.o.partitions.isBlocked(from, to, t)) return;
    // Destination crashed → message is lost.
    if (this.o.isDown?.(to)) return;
    // Random drop.
    if (this.o.rng.chance(this.o.config.dropProb)) {
      this.o.trace.append(t, {
        kind: "send",
        from,
        to,
        summary: `dropped ${TraceLogger.summarize(payload)}`,
      });
      return;
    }

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
      this.o.trace.append(this.o.clock.now(), { kind: "deliver", from, to, summary });
    };
    const meta: ScheduleMeta = { kind: "deliver", nodeId: to, from, to, summary };
    this.o.scheduler.schedule(t + latency, deliver, meta);

    // Random duplicate: an independent second delivery at a fresh latency.
    if (this.o.rng.chance(this.o.config.dupProb)) {
      const extra = sampleLatency(
        this.o.rng,
        this.o.config.minLatency,
        this.o.config.maxLatency
      );
      // Create a separate clone for the duplicate delivery, preventing reference sharing between deliveries.
      const dupClonedPayload = payload !== undefined ? structuredClone(payload) : undefined;
      const deliverDup = () => {
        if (this.o.isDown?.(to)) return;
        this.o.deliver({ from, to, payload: dupClonedPayload });
        this.o.trace.append(this.o.clock.now(), { kind: "deliver", from, to, summary });
      };
      this.o.scheduler.schedule(t + extra, deliverDup, meta);
    }
  }
}
