// The scenario behind the committed capsule fixture(s) in ./capsules/.
//
// A buggy replicated counter (receive is not idempotent, so a duplicated
// message double-counts and a dropped one leaves a replica behind) running
// over @sx4im/chronos-net's fault network WITH chaos enabled. It deliberately
// exercises every determinism-critical surface — seeded RNG (latency draws),
// the (time, seq) scheduler, network drop/dup, and the chaos engine
// (partition/crash/restart) — so that ANY change that alters trace ordering
// breaks the committed capsule's bit-for-bit replay in replay.test.ts.
//
// DO NOT casually regenerate the capsules: they are the regression artifact.
// If a deliberate, understood change to the trace format or event ordering
// requires it, run ./generateFixture.ts (see its header) and explain why in
// the commit message.

import {
  Simulator,
  type SimEnv,
  type NetworkContext,
  type NetworkFactory,
} from "@sx4im/chronos-core";
import type { ChaosConfig, NetworkConfig } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";

export const nodes = 3;
export const maxSteps = 10_000;

export const network: Partial<NetworkConfig> = {
  minLatency: 1,
  maxLatency: 10,
  dropProb: 0.15,
  dupProb: 0.15,
};

export const chaos: ChaosConfig = {
  partitionProb: 0.02,
  crashProb: 0.02,
  restartProb: 0.05,
  maxPartitionMs: 50,
  maxCrashFraction: 0.34,
};

export const netFactory: NetworkFactory = (ctx: NetworkContext) =>
  new SimNetwork({
    ...ctx,
    config: { minLatency: 1, maxLatency: 10, dropProb: 0.15, dupProb: 0.15 },
  });

class Counter {
  private value = 0;
  private peers: string[] = [];
  constructor(private env: SimEnv) {
    env.net.onReceive(() => {
      this.value++; // BUG: not idempotent — double-counts duplicates.
    });
  }
  setPeers(p: string[]): void {
    this.peers = p;
  }
  increment(): void {
    this.value++;
    for (const peer of this.peers) this.env.net.send(peer, "inc");
  }
  get count(): number {
    return this.value;
  }
}

export const body = (sim: Simulator): void => {
  const ids = sim.nodes.map((n) => n.id);
  const counters = sim.nodes.map((n) => {
    const c = new Counter(n.env);
    c.setPeers(ids);
    return c;
  });
  counters.forEach((c) => c.increment());

  // Safety invariant: once the queue settles, every replica agrees.
  sim.addInvariant({
    name: "all counts equal",
    kind: "safety",
    check: () =>
      sim.scheduler.pendingCount() > 0 ||
      counters.every((c) => c.count === counters[0]!.count),
  });
};
