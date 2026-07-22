import type { NetworkContext, NetworkFactory, Simulator } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";
import type { SimTestBody } from "@sx4im/chronos-vitest";
import { expectInvariant } from "@sx4im/chronos-vitest";
import {
  TwoPhaseCoordinator,
  TwoPhaseParticipant,
} from "./twoPhaseCommit.js";

export const TWO_PHASE_MAX_STEPS = 2_000;

export const twoPhaseNetFactory: NetworkFactory = (ctx: NetworkContext) =>
  new SimNetwork({
    ...ctx,
    config: {
      minLatency: 1,
      maxLatency: 10,
      dropProb: 0.05,
      dupProb: 0.03,
    },
  });

export const twoPhaseChaos = {
  partitionProb: 0.03,
  crashProb: 0.03,
  restartProb: 0.1,
  maxPartitionMs: 150,
  maxCrashFraction: 0.34,
} as const;

export const twoPhaseSafetyBody: SimTestBody = async (sim: Simulator) => {
  const coordNode = sim.nodes[0];
  if (!coordNode) return;

  const participantNodes = sim.nodes.slice(1);
  const participantIds = participantNodes.map((n) => n.id);
  const txId = "tx-1001";

  const coordinator = new TwoPhaseCoordinator(coordNode.env, txId, participantIds);
  const participants: TwoPhaseParticipant[] = [];

  for (let i = 0; i < participantNodes.length; i++) {
    const node = participantNodes[i]!;
    // Participant 0 votes ABORT in some runs, others vote COMMIT
    const willCommit = i !== 0;
    participants.push(new TwoPhaseParticipant(node.env, txId, coordNode.id, willCommit));
  }

  coordinator.start();

  // Step the simulation until messages drain
  await sim.settle();

  // Safety Invariant 1: Atomicity — no participant commits while another aborts
  expectInvariant("2PC Atomicity: all participants reach consistent decision", (world) => {
    const crashed = new Set(world.crashedNodes);
    let committedCount = 0;
    let abortedCount = 0;

    for (const p of participants) {
      if (crashed.has(p.env.nodeId)) continue;
      if (p.state === "COMMITTED") committedCount++;
      if (p.state === "ABORTED") abortedCount++;
    }

    if (committedCount > 0 && abortedCount > 0) {
      throw new Error(
        `Atomicity violation: ${committedCount} participants COMMITTED and ${abortedCount} ABORTED!`,
      );
    }
    return true;
  });

  // Safety Invariant 2: Non-spontaneous Commit
  expectInvariant("2PC Non-spontaneous commit: no commit if any participant voted abort", (world) => {
    const crashed = new Set(world.crashedNodes);
    const hasAbortVote = participants.some((p) => p.vote === "ABORT");

    if (hasAbortVote) {
      for (const p of participants) {
        if (crashed.has(p.env.nodeId)) continue;
        if (p.state === "COMMITTED") {
          throw new Error(
            `Participant ${p.env.nodeId} COMMITTED despite a participant voting ABORT!`,
          );
        }
      }
    }
    return true;
  });
};
