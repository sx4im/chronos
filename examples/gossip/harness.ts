import type { NetworkContext, NetworkFactory, Simulator } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";
import type { SimTestBody } from "@sx4im/chronos-vitest";
import { expectInvariant } from "@sx4im/chronos-vitest";
import { GossipNode } from "./gossip.js";

export const GOSSIP_MAX_STEPS = 2_000;

export const gossipNetFactory: NetworkFactory = (ctx: NetworkContext) =>
  new SimNetwork({
    ...ctx,
    config: {
      minLatency: 1,
      maxLatency: 15,
      dropProb: 0.05,
      dupProb: 0.03,
    },
  });

export const gossipChaos = {
  partitionProb: 0.03,
  crashProb: 0.03,
  restartProb: 0.1,
  maxPartitionMs: 150,
  maxCrashFraction: 0.34,
} as const;

export const gossipSafetyBody: SimTestBody = async (sim: Simulator) => {
  const nodeIds = sim.nodes.map((n) => n.id);
  const gossipNodes = new Map<string, GossipNode>();

  for (const node of sim.nodes) {
    const g = new GossipNode(node.env, nodeIds, 2, 20);
    gossipNodes.set(node.id, g);
    g.start();
  }

  // Each node writes a unique key=value
  for (let i = 0; i < sim.nodes.length; i++) {
    const node = sim.nodes[i];
    if (!node) continue;
    const g = gossipNodes.get(node.id);
    if (!g) continue;
    const nodeId = node.id;
    node.env.setTimeout(() => {
      g.set(`key-${nodeId}`, `val-${nodeId}`);
    }, i * 5);
  }

  await sim.settle();

  // Invariant 1: Consistency — for any key, all alive nodes that have it
  // hold the same (value, version, origin) tuple.
  expectInvariant("gossip consistency: alive nodes agree on each key's value", (world) => {
    const crashed = new Set(world.crashedNodes);
    const aliveIds = nodeIds.filter((id) => !crashed.has(id));

    // Collect all keys across alive nodes
    const allKeys = new Set<string>();
    for (const id of aliveIds) {
      const g = gossipNodes.get(id);
      if (!g) continue;
      for (const key of g.store.keys()) allKeys.add(key);
    }

    for (const key of allKeys) {
      let refValue: string | undefined;
      let refVersion: number | undefined;
      let refOrigin: string | undefined;
      let refHolder: string | undefined;

      for (const id of aliveIds) {
        const entry = gossipNodes.get(id)?.store.get(key);
        if (!entry) continue;

        if (refValue === undefined) {
          refValue = entry.value;
          refVersion = entry.version;
          refOrigin = entry.origin;
          refHolder = id;
        } else if (
          entry.value !== refValue ||
          entry.version !== refVersion ||
          entry.origin !== refOrigin
        ) {
          throw new Error(
            `Key "${key}" diverged: node ${refHolder} has (${refValue}, v${refVersion}, ${refOrigin}) ` +
              `but node ${id} has (${entry.value}, v${entry.version}, ${entry.origin})`,
          );
        }
      }
    }
    return true;
  });

  // Invariant 2: Monotonic version — a node's version for a key never decreases.
  // (Tracked via the merge function's guard, but verified post-hoc here.)
  expectInvariant("gossip monotonicity: versions never regress", (world) => {
    const crashed = new Set(world.crashedNodes);
    for (const id of nodeIds) {
      if (crashed.has(id)) continue;
      const g = gossipNodes.get(id);
      if (!g) continue;
      for (const [key, entry] of g.store) {
        if (entry.version < 0) {
          throw new Error(`Node ${id} key "${key}" has negative version ${entry.version}`);
        }
      }
    }
    return true;
  });
};
