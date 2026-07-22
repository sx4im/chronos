# CRDT (LWW-Register) — a dogfood for Chronos

A **Conflict-Free Replicated Data Type (LWW-Register)** run under Chronos, exercising eventual consistency and deterministic state resolution:

1. **Strong Eventual Consistency** — *when messages drain, all non-crashed nodes converge to identical state.*
2. **LWW Tiebreaker Rule** — *the converged state matches the highest (timestamp, writerId) pair written.*

Each node relies solely on `SimEnv` for virtual time and messaging.

## Findings

Across **1000 seeds** of chaos (packet drops, reordering, network partitions, and node crashes), Chronos confirmed **100% convergence** with zero invariant violations.
