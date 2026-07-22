import type { NetworkContext, NetworkFactory, Simulator } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";
import type { SimTestBody } from "@sx4im/chronos-vitest";
import { expectInvariant } from "@sx4im/chronos-vitest";
import { LwwRegister, type RegisterState } from "./crdt.js";

export const CRDT_MAX_STEPS = 10_000;

export const crdtNetFactory: NetworkFactory = (ctx: NetworkContext) =>
  new SimNetwork({
    ...ctx,
    config: {
      minLatency: 1,
      maxLatency: 15,
      dropProb: 0.05,
      dupProb: 0.05,
    },
  });

export const crdtChaos = {
  partitionProb: 0.03,
  crashProb: 0.03,
  restartProb: 0.1,
  maxPartitionMs: 150,
  maxCrashFraction: 0.34,
} as const;

export const crdtSafetyBody: SimTestBody = async (sim: Simulator) => {
  const nodeIds = sim.nodes.map((n) => n.id);
  const registers = new Map<string, LwwRegister<string>>();

  for (const node of sim.nodes) {
    registers.set(
      node.id,
      new LwwRegister<string>(node.env, "initial", nodeIds),
    );
  }

  // Driven concurrent writes across nodes
  for (let i = 0; i < sim.nodes.length; i++) {
    const node = sim.nodes[i];
    if (!node) continue;
    const reg = registers.get(node.id);
    if (!reg) continue;

    const nodeId = node.id;
    node.env.setTimeout(() => {
      reg.write(`val-from-${nodeId}-${i}`);
    }, i * 10);
  }

  // Allow system to process events and heal partitions
  await sim.settle();

  // Invariant 1: Convergence across all alive/non-partitioned nodes
  expectInvariant("strong eventual consistency (all alive nodes agree on state)", (world) => {
    const crashed = new Set(world.crashedNodes);
    const aliveNodes = sim.nodes.filter((n) => !crashed.has(n.id));
    if (aliveNodes.length === 0) return true;

    const firstNode = aliveNodes[0];
    if (!firstNode) return true;
    const firstState = registers.get(firstNode.id)?.state;
    if (!firstState) return true;

    for (const node of aliveNodes) {
      const state = registers.get(node.id)?.state;
      if (!state) continue;
      if (
        state.value !== firstState.value ||
        state.timestamp !== firstState.timestamp ||
        state.writerId !== firstState.writerId
      ) {
        throw new Error(
          `Node ${node.id} has value "${state.value}" (t=${state.timestamp}, w=${state.writerId}) ` +
            `but Node ${firstNode.id} has "${firstState.value}" (t=${firstState.timestamp}, w=${firstState.writerId})`,
        );
      }
    }
    return true;
  });

  // Invariant 2: Highest timestamp written is the winner
  expectInvariant("LWW rule: final value matches highest timestamp writer", (world) => {
    const crashed = new Set(world.crashedNodes);
    const aliveNodes = sim.nodes.filter((n) => !crashed.has(n.id));
    if (aliveNodes.length === 0) return true;

    let highest: RegisterState<string> | undefined;
    for (const node of sim.nodes) {
      const state = registers.get(node.id)?.state;
      if (!state) continue;
      if (
        !highest ||
        state.timestamp > highest.timestamp ||
        (state.timestamp === highest.timestamp && state.writerId > highest.writerId)
      ) {
        highest = state;
      }
    }

    if (highest) {
      for (const node of aliveNodes) {
        const state = registers.get(node.id)?.state;
        if (!state) continue;
        if (state.value !== highest.value) {
          throw new Error(
            `Node ${node.id} value "${state.value}" does not match winning state "${highest.value}"`,
          );
        }
      }
    }
    return true;
  });
};
