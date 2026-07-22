// Raft-lite — a simplified Raft consensus module run *entirely* under Chronos.
//
// Each `RaftNode` obtains its clock, randomness, timers, and network ONLY from
// the injected `env: SimEnv`. There is no `Date.now`, no `Math.random`, no real
// `setTimeout`, no real sockets — so a run is bit-for-bit reproducible from its
// integer seed. The same `RaftNode` code would run against a `RealEnv` in
// production; only the `env` differs.
//
// This is a *simplified* Raft (leader election + single-entry-per-term
// replication), faithful on the two safety properties we test:
//   1. Election Safety — at most one leader per term.
//   2. Commit Agreement — committed entries never diverge across alive nodes.
// It is NOT a full Raft (no snapshotting, no membership change, no client
// sessions, no.prevote); see README.md for the scope and the subtle-bug hunt.

import type { SimEnv, TimerHandle } from "@sx4im/chronos-core";

/** A single replicated log entry. `command` is just `term` (one entry per term). */
export interface LogEntry {
  term: number;
  command: number;
}

/** The RPC set. All messages are JSON-serializable (they cross `env.net`). */
export type RaftMsg =
  | { type: "RequestVote"; term: number; candidateId: string; lastLogTerm: number; lastLogIndex: number }
  | { type: "RequestVoteReply"; term: number; voteGranted: boolean; from: string }
  | {
      type: "AppendEntries";
      term: number;
      leaderId: string;
      prevLogIndex: number;
      prevLogTerm: number;
      entries: LogEntry[];
      leaderCommit: number;
    }
  | { type: "AppendEntriesReply"; term: number; success: boolean; from: string; matchIndex: number };

export type Role = "follower" | "candidate" | "leader";

// Raft's classic 5–10x heartbeat-to-election-timeout ratio, in virtual ms.
const ELECTION_MIN_MS = 150;
const ELECTION_MAX_MS = 300;
const HEARTBEAT_MS = 50;

/**
 * A single Raft node.
 *
 * Lifecycle: construct all nodes, then call `start()` on each (arms the
 * election timer). The simulator drives everything from there via `env.net`
 * deliveries and `env.setTimeout` firings. On crash the scheduler cancels the
 * node's pending events (its timers); on restart the node is passive until an
 * incoming RPC re-arms its timer — which is correct: a freshly-restarted node
 * has no legitimate leadership claim and waits to hear from a real leader.
 */
export class RaftNode {
  readonly id: string;

  // Persistent-ish state (survives restart in this simplified model).
  term = 0;
  votedFor: string | null = null; // null ⇒ has not yet voted this term
  role: Role = "follower";
  log: LogEntry[] = [];
  commitIndex = -1; // -1 ⇒ nothing committed

  /** Terms in which THIS node ever became leader — for the election-safety check. */
  readonly termsLed = new Set<number>();

  private readonly env: SimEnv;
  private readonly peers: string[];
  private readonly majority: number;

  private votesReceived = new Set<string>();
  private matchIndex = new Map<string, number>();
  private electionTimer: TimerHandle | null = null;
  private heartbeatTimer: TimerHandle | null = null;
  private started = false;

  constructor(id: string, env: SimEnv, allIds: string[]) {
    this.id = id;
    this.env = env;
    this.peers = allIds.filter((x) => x !== id);
    this.majority = Math.floor(allIds.length / 2) + 1;
    env.net.onReceive((from, payload) => this.onReceive(from, payload as RaftMsg));
  }

  /** Arm the election timer. Must be called once per node after construction. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.armElectionTimer();
  }

  // ── timers ──────────────────────────────────────────────────────────────
  private armElectionTimer(): void {
    this.electionTimer?.cancel();
    const span = ELECTION_MAX_MS - ELECTION_MIN_MS;
    const jitter = ELECTION_MIN_MS + Math.floor(this.env.random() * span);
    this.electionTimer = this.env.setTimeout(() => this.onElectionTimeout(), jitter);
  }

  private onElectionTimeout(): void {
    // Heard from no leader (or lost an election): stand for election.
    this.startElection();
  }

  private armHeartbeat(): void {
    this.heartbeatTimer?.cancel();
    this.heartbeatTimer = this.env.setTimeout(() => {
      this.sendHeartbeats();
      this.armHeartbeat();
    }, HEARTBEAT_MS);
  }

  // ── election ───────────────────────────────────────────────────────────
  private startElection(): void {
    if (this.role === "leader") return;
    this.role = "candidate";
    this.term += 1;
    this.votedFor = this.id;
    this.votesReceived = new Set<string>([this.id]);
    this.heartbeatTimer?.cancel();
    this.armElectionTimer(); // if no majority reply arrives, time out and retry
    const lastLogIndex = this.lastLogIndex();
    const lastLogTerm = this.lastLogTerm();
    for (const peer of this.peers) {
      this.env.net.send(peer, {
        type: "RequestVote",
        term: this.term,
        candidateId: this.id,
        lastLogTerm,
        lastLogIndex,
      });
    }
  }

  private becomeLeader(): void {
    this.role = "leader";
    this.termsLed.add(this.term);
    this.electionTimer?.cancel();
    // Append one no-op entry for this term. This both asserts the new
    // leadership and (once committed) safely commits any prior-term entries
    // still uncommitted when the previous leader died — the Figure-8 rule.
    this.log.push({ term: this.term, command: this.term });
    this.matchIndex = new Map<string, number>();
    for (const peer of this.peers) this.matchIndex.set(peer, -1);
    this.maybeAdvanceCommit();
    this.sendHeartbeats();
    this.armHeartbeat();
  }

  // ── RPC dispatch ───────────────────────────────────────────────────────
  private onReceive(_from: string, msg: RaftMsg): void {
    switch (msg.type) {
      case "RequestVote":
        return this.onRequestVote(msg);
      case "RequestVoteReply":
        return this.onRequestVoteReply(msg);
      case "AppendEntries":
        return this.onAppendEntries(msg);
      case "AppendEntriesReply":
        return this.onAppendEntriesReply(msg);
    }
  }

  private onRequestVote(msg: Extract<RaftMsg, { type: "RequestVote" }>): void {
    if (msg.term > this.term) this.seeHigherTerm(msg.term);
    if (msg.term < this.term) {
      this.replyVote(msg.candidateId, this.term, false);
      return;
    }
    // msg.term === this.term
    const ok =
      (this.votedFor === null || this.votedFor === msg.candidateId) &&
      this.logUpToDate(msg.lastLogTerm, msg.lastLogIndex);
    if (ok) {
      this.votedFor = msg.candidateId;
      this.armElectionTimer(); // a candidate contacted us; reset our timer
    }
    this.replyVote(msg.candidateId, this.term, ok);
  }

  private onRequestVoteReply(msg: Extract<RaftMsg, { type: "RequestVoteReply" }>): void {
    if (msg.term > this.term) {
      this.seeHigherTerm(msg.term);
      return;
    }
    if (this.role !== "candidate" || msg.term !== this.term) return; // stale reply
    if (msg.voteGranted) {
      this.votesReceived.add(msg.from);
      if (this.votesReceived.size >= this.majority) this.becomeLeader();
    }
  }

  private onAppendEntries(msg: Extract<RaftMsg, { type: "AppendEntries" }>): void {
    if (msg.term > this.term) this.seeHigherTerm(msg.term);
    if (msg.term < this.term) {
      // Stale leader — reject, and do NOT reset our election timer.
      this.replyAppend(this.term, msg.leaderId, false, this.lastLogIndex());
      return;
    }
    // Accept this leader: step down if a candidate/stale leader, reset timer.
    if (this.role !== "follower") {
      this.role = "follower";
      this.heartbeatTimer?.cancel();
    }
    this.armElectionTimer();

    if (!this.logMatchesPrev(msg.prevLogIndex, msg.prevLogTerm)) {
      this.replyAppend(this.term, msg.leaderId, false, this.lastLogIndex());
      return;
    }
    this.mergeEntries(msg.prevLogIndex, msg.entries);
    if (msg.leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(msg.leaderCommit, this.lastLogIndex());
    }
    this.replyAppend(this.term, msg.leaderId, true, this.lastLogIndex());
  }

  private onAppendEntriesReply(msg: Extract<RaftMsg, { type: "AppendEntriesReply" }>): void {
    if (msg.term > this.term) {
      this.seeHigherTerm(msg.term);
      return;
    }
    if (this.role !== "leader" || msg.term !== this.term) return; // stale
    if (msg.success) {
      this.matchIndex.set(msg.from, msg.matchIndex);
      this.maybeAdvanceCommit();
    }
    // !success: with the full-log resend model the next heartbeat retries the
    // whole log; no nextIndex bookkeeping needed.
  }

  // ── helpers ────────────────────────────────────────────────────────────
  private sendHeartbeats(): void {
    // Simplified replication: resend the FULL log each heartbeat (prevLogIndex
    // = -1, the start, always matches). Replication is O(log) per heartbeat but
    // the logs stay tiny (one entry per term), and correctness rests on Leader
    // Completeness rather than incremental bookkeeping.
    const entries = this.log.slice();
    for (const peer of this.peers) {
      this.env.net.send(peer, {
        type: "AppendEntries",
        term: this.term,
        leaderId: this.id,
        prevLogIndex: -1,
        prevLogTerm: 0,
        entries,
        leaderCommit: this.commitIndex,
      });
    }
  }

  /** Figure-8-safe commit: only a current-term entry backed by a majority. */
  private maybeAdvanceCommit(): void {
    for (let n = this.log.length - 1; n > this.commitIndex; n--) {
      if (this.log[n]!.term !== this.term) continue; // Figure-8 rule
      let count = 1; // self always has the entry
      for (const peer of this.peers) {
        if ((this.matchIndex.get(peer) ?? -1) >= n) count++;
      }
      if (count >= this.majority) {
        // Commit the highest such n; all lower indices are committed transitively.
        this.commitIndex = n;
        return;
      }
    }
  }

  private seeHigherTerm(t: number): void {
    this.term = t;
    this.votedFor = null;
    this.role = "follower";
    this.heartbeatTimer?.cancel();
    this.armElectionTimer();
  }

  private lastLogIndex(): number {
    return this.log.length - 1;
  }

  private lastLogTerm(): number {
    return this.log.length > 0 ? this.log[this.log.length - 1]!.term : 0;
  }

  private logUpToDate(theirTerm: number, theirIndex: number): boolean {
    const mine = this.lastLogTerm();
    if (theirTerm !== mine) return theirTerm > mine;
    return theirIndex >= this.lastLogIndex();
  }

  private logMatchesPrev(prevIndex: number, prevTerm: number): boolean {
    if (prevIndex === -1) return true; // the start always matches
    if (this.log.length <= prevIndex) return false; // missing entry
    return this.log[prevIndex]!.term === prevTerm;
  }

  /** Append/overwrite entries starting at `prevIndex + 1`, Raft-style:
   *  keep overlapping entries, truncate on the first conflict, and (for the
   *  full-log resend with prevIndex = -1) drop any stale trailing entries. */
  private mergeEntries(prevIndex: number, entries: LogEntry[]): void {
    let pos = prevIndex + 1;
    let i = 0;
    while (i < entries.length) {
      const e = entries[i]!;
      if (pos < this.log.length) {
        if (this.log[pos]!.term === e.term) {
          pos++;
          i++;
          continue;
        }
        // conflict at pos → truncate here and append the rest of `entries`
        this.log = this.log.slice(0, pos);
        for (let j = i; j < entries.length; j++) this.log.push(entries[j]!);
        this.clampCommit();
        return;
      }
      this.log.push(e);
      pos++;
      i++;
    }
    // Full resend (prevIndex === -1) defines the whole log: drop trailing stale extras.
    if (prevIndex === -1 && pos < this.log.length) {
      this.log = this.log.slice(0, pos);
      this.clampCommit();
    }
  }

  private clampCommit(): void {
    if (this.commitIndex >= this.log.length) this.commitIndex = this.log.length - 1;
  }

  private replyVote(to: string, term: number, granted: boolean): void {
    this.env.net.send(to, { type: "RequestVoteReply", term, voteGranted: granted, from: this.id });
  }

  private replyAppend(term: number, leaderId: string, success: boolean, matchIndex: number): void {
    this.env.net.send(leaderId, {
      type: "AppendEntriesReply",
      term,
      success,
      from: this.id,
      matchIndex,
    });
  }
}
