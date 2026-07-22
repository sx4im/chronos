// Reliable-network variant of the counter scenario: the same buggy body, but a
// fault-free network (drop=0, dup=0) → the counter converges every time. Used
// to test the "could NOT reproduce" exit path: replaying a real violation
// capsule with this factory produces no violation, so reproduction fails.

import { Simulator, type SimEnv, type NetworkContext, type NetworkFactory } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";

export const netFactory: NetworkFactory = (ctx: NetworkContext) =>
  new SimNetwork({ ...ctx, config: { minLatency: 1, maxLatency: 10, dropProb: 0, dupProb: 0 } });

export const nodes = 3;

class Counter {
  private value = 0;
  private peers: string[] = [];
  constructor(private env: SimEnv) {
    env.net.onReceive(() => {
      this.value++;
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
  sim.addInvariant({
    name: "all counts equal",
    kind: "safety",
    check: () =>
      sim.scheduler.pendingCount() > 0 ||
      counters.every((c) => c.count === counters[0]!.count),
  });
};
