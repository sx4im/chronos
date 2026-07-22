# Raft-lite — a dogfood for Chronos

A **simplified Raft** consensus module run entirely under Chronos, exercising the
two safety properties that make Raft Raft:

1. **Election Safety** — *at most one leader per term, ever.*
2. **Commit Agreement** — *committed entries never diverge across alive nodes.*

Each `RaftNode` gets its clock, randomness, timers, and network **only** from the
injected `env: SimEnv` — no `Date.now`, no `Math.random`, no real timers, no real
sockets. A run is therefore bit-for-bit reproducible from its integer seed, and
under chaos (drops, duplicates, partitions, crashes, restarts) Chronos checks the
two invariants after **every** scheduler step, stopping at the first virtual
millisecond they break.

> This is the build-plan Phase 6.1 flagship: implement a real distributed
> algorithm on `env`, beat on it with thousands of seeds of chaos, and either
> find a subtle bug or confirm safety. **Outcome: safety confirmed — see
> [Findings](#findings).**

## Layout

| File        | Role                                                                                  |
| ----------- | ------------------------------------------------------------------------------------- |
| `raft.ts`   | The `RaftNode` — pure `env`-only logic (election + single-entry-per-term replication). |
| `harness.ts`| Safety invariants, fault/chaos configs, and the shared `simTest` body.               |
| `raft.test.ts` | The `simTest`s + a 2000-seed `runSimTest` sweep + a determinism proof.           |

## The algorithm (simplified, but safe)

- **Leader election.** Each follower arms a randomized election timer
  (`env.setTimeout` with `env.random()`-jittered 150–300 virtual ms). On timeout
  it becomes a candidate, bumps its term, votes for itself, and sends
  `RequestVote` to its peers. A `RequestVoteReply` is counted only if it carries
  the candidate's *current* term (the stale-reply guard — see below). A strict
  majority wins.
- **Replication.** The leader appends one no-op entry per term
  (`{ term, command: term }`) and resends its **full** log on every heartbeat
  (`AppendEntries` with `prevLogIndex = -1`). Logs stay tiny (one entry per
  term), so resending is cheap. Followers append/overwrite Raft-style
  (keep overlapping entries, truncate on the first conflict, drop stale trailing
  entries) — idempotent under duplicated messages.
- **Commit (Figure-8 safe).** The leader advances `commitIndex` only for an
  entry from its *current* term that a majority has replicated. Committing that
  entry transitively commits all prior (previous-term) entries in the leader's
  log — the rule that closes the classic Raft Figure-8 hole.

Membership is static (3 nodes); there is no snapshotting, prevote, membership
change, or client-session dedup. Those are scope cuts, not safety cuts.

### The invariants in code

```ts
expectInvariant("at most one leader per term", (_world) => electionSafetyHolds(raft));
expectInvariant("committed entries never diverge", (world) =>
  committedPrefixesAgree(raft, new Set(world.crashedNodes)),
);
```

A 1-arg predicate is the **safety** form — the Simulator checks it after every
step. On violation the predicate *throws* with the offending term / divergent
holders, so the failure capsule's `invariant-violation` event names the causal
neighborhood a human opens the Inspector on.

## Chaos config

```ts
{ partitionProb: 0.05, crashProb: 0.05, restartProb: 0.15,
  maxPartitionMs: 200, maxCrashFraction: 0.34 }   // + net {drop 5%, dup 3%, 1–10ms}
```

With 3 nodes, `maxCrashFraction 0.34` caps concurrent crashes at 1, so a majority
(2) always stays alive and the system keeps churning (re-electing, recommitting)
rather than fully stalling. That maximizes the *interesting* churn Chronos gets
to check.

## Findings

**Confirming safety.** Across **2000 seeds** of chaos (drops + duplicates +
partitions + crashes + restarts), Chronos found **no violation** of either safety
property. Election Safety held on every seed: no two nodes ever led the same
term. Commit Agreement held on every seed: every alive node that had committed
through index `i` held the identical `{term, command}` entry there.

Two design points were the plausible bug sources Iterator Chronos watched — both
held:

- **Stale `RequestVoteReply`.** A candidate only counts a vote whose `term`
  equals the candidate's *current* term. A reply delayed across a term bump (the
  candidate lost, then stood again) or a duplicated reply is ignored, so it can
  neither manufacture a fake majority nor elect two leaders in one term. Election
  Safety rests on this guard plus the one-vote-per-term `votedFor`.
- **Full-log resend + Figure-8 commit.** Because the leader resends its whole
  log, a follower that accepted an entry always ends up with the leader's complete
  committed prefix (Leader Completeness + the `{term===current}` commit rule
  guarantee the leader's log ⊇ every committed entry). No seed produced a node
  whose committed log diverged from a peer's.

That a from-scratch simplified Raft here held under this much chaos is itself a
useful signal, not a let-down: it means the two invariants and the fault model
are tight enough to be meaningful, and the next move in the bug hunt (a prevote
phase, or a `nextIndex`-based incremental replication that's easier to get subtly
wrong) is where one would most expect a real finding. The harness is set up to
find it the moment it appears — a violating seed writes a capsule and the
`simTest` fails with the seed + path.

### Reproduce

```bash
pnpm test examples/raft-lite/                 # the 4 tests (≈20s)
pnpm test -- examples/raft-lite/raft.test.ts    # filter just this file
```

A hypothetical violator would name its seed and capsule; `npx chronos replay
<capsule>` (once an example scenario module is wired) reproduces it in the
Inspector, virtual millisecond for millisecond.
