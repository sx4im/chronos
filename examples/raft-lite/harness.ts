// Raft-lite test harness — the safety invariants, the scenario wiring, and the
// fault/chaos configs. Lives apart from raft.ts so the node stays a pure
// `env`-only module (no @sx4im/chronos-vitest import) and the invariants read like
// the §4.1 examples: `expectInvariant("…", (world) => …)`.

import type { NetworkContext, NetworkFactory, Simulator } from "@sx4im/chronos-core";
import { SimNetwork } from "@sx4im/chronos-net";
import type { SimTestBody } from "@sx4im/chronos-vitest";
import { expectInvariant } from "@sx4im/chronos-vitest";
import { RaftNode, type LogEntry } from "./raft.js";

// Packets drop 5% / duplicate 3%, latency 1–10 virtual ms. Drops force
// re-election; duplicates stress idempotency (a duplicated AppendEntries must
// not double-append, a duplicated RequestVoteReply must not double-count).
export const raftNetFactory: NetworkFactory = (ctx: NetworkContext) =>
  new SimNetwork({
    ...ctx,
    config: { minLatency: 1, maxLatency: 10, dropProb: 0.05, dupProb: 0.03 },
  });

// Chaos on top of the fault network: partitions heal inside 200 virtual ms and
// at most ~1/3 of nodes are crashed at once. With 3 nodes, maxCrashFraction
// 0.34 caps crashes at 1 (majority of 2 stays alive), so Raft can always
// re-elect — the system keeps churning rather than fully stalling.
export const raftChaos = {
  partitionProb: 0.05,
  crashProb: 0.05,
  restartProb: 0.15,
  maxPartitionMs: 200,
  maxCrashFraction: 0.34,
} as const;

/** The number of scheduler steps a single seed runs. Heartbeats re-arm, so the
 *  event queue never drains — `sim.run` stops at this cap. ~800 steps ≈ tens of
 *  election terms under chaos: enough for the invariants to bite, small enough
 *  to sweep thousands of seeds quickly. */
export const RAFT_MAX_STEPS = 800;

/** Construct one RaftNode per simulator node and start their election timers. */
export function buildRaft(sim: Simulator): RaftNode[] {
  const ids = sim.nodes.map((n) => n.id);
  const raft = sim.nodes.map((n) => new RaftNode(n.id, n.env, ids));
  for (const r of raft) r.start();
  return raft;
}

/**
 * Election Safety: at most one leader per term, ever. A node records a term in
 * `termsLed` exactly when it wins a majority for that term. Two distinct nodes
 * leading the same term means two disjoint majorities shared a single voter —
 * impossible if each node grants at most one vote per term (`votedFor`).
 *
 * Throws (rather than returning false) so the capsule's violation detail names
 * the offending term and the competing leaders — the causal neighborhood a
 * human scans first in the Inspector.
 */
export function electionSafetyHolds(nodes: RaftNode[]): boolean {
  const termLeaders = new Map<number, string[]>();
  for (const n of nodes) {
    for (const t of n.termsLed) {
      const arr = termLeaders.get(t) ?? [];
      arr.push(n.id);
      termLeaders.set(t, arr);
    }
  }
  for (const [t, ids] of termLeaders) {
    if (ids.length > 1) {
      throw new Error(`term ${t} elected ${ids.length} leaders: ${ids.sort().join(",")}`);
    }
  }
  return true;
}

/**
 * Commit Agreement: if two alive nodes have both committed the entry at index i,
 * the entries are identical — committed logs never diverge. We compare every
 * index up to the highest any alive node has committed, across every alive node
 * that claims it. (Crashed nodes are excluded: their state is frozen at crash
 * time, and a restarted node re-learns its commit index, so its stale value
 * isn't a real divergence.)
 */
export function committedPrefixesAgree(nodes: RaftNode[], crashed: Set<string>): boolean {
  const alive = nodes.filter((n) => !crashed.has(n.id));
  let maxCommit = -1;
  for (const n of alive) if (n.commitIndex > maxCommit) maxCommit = n.commitIndex;
  for (let i = 0; i <= maxCommit; i++) {
    let ref: LogEntry | null = null;
    for (const n of alive) {
      if (n.commitIndex < i) continue;
      const e = n.log[i]!;
      if (ref === null) ref = e;
      else if (e.term !== ref.term || e.command !== ref.command) {
        const holders = alive
          .filter((m) => m.commitIndex >= i)
          .map((m) => `${m.id}:{term=${m.log[i]!.term},cmd=${m.log[i]!.command}}`)
          .join("  ");
        throw new Error(`committed entry #${i} diverged — ${holders}`);
      }
    }
  }
  return true;
}

/**
 * The shared sim body: wire the nodes, then register the two safety invariants
 * for per-step checking. `expectInvariant` with a 1-arg predicate is the safety
 * form — the Simulator checks it after every scheduler step. We must take a
 * `world` param (even when unused) so it's the per-step form, not the
 * evaluate-now post-condition form.
 */
export const raftSafetyBody: SimTestBody = (sim) => {
  const raft = buildRaft(sim);
  expectInvariant("at most one leader per term", (_world) => electionSafetyHolds(raft));
  expectInvariant("committed entries never diverge", (world) =>
    committedPrefixesAgree(raft, new Set(world.crashedNodes)),
  );
};
