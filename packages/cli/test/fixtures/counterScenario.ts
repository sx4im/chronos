// Scenario fixture for the CLI integration tests (Phase 3.4): the buggy
// replicated counter over @sx4im/chronos-net's fault network. This is the shape a
// user ships as a `chronos` scenario — a plain module exporting { body, nodes,
// netFactory } — self-contained (no cross-package import of the example counter).

import { Simulator, type SimEnv, type NetworkContext, type NetworkFactory } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";

const FAULTS = { dropProb: 0.15, dupProb: 0.15 } as const;

export const netFactory: NetworkFactory = (ctx: NetworkContext) =>
  new SimNetwork({ ...ctx, config: { minLatency: 1, maxLatency: 10, ...FAULTS } });

export const nodes = 3;

// Non-idempotent counter: each receive increments by 1, so a dropped increment
// leaves a node behind and a duplicated increment double-counts — exactly the
// race DST exists to surface.
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
  // Each node broadcasts one increment to all peers (including itself).
  counters.forEach((c) => c.increment());

  // Safety invariant checked after every scheduler step: only decides once the
  // event queue has settled (else short-circuits to true while in flight).
  sim.addInvariant({
    name: "all counts equal",
    kind: "safety",
    check: () =>
      sim.scheduler.pendingCount() > 0 ||
      counters.every((c) => c.count === counters[0]!.count),
  });
};
