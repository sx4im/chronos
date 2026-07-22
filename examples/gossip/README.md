# Gossip Protocol — a dogfood for Chronos

A **gossip protocol** (epidemic dissemination) run under Chronos, exercising eventual consistency via periodic random peer exchange:

1. **Gossip Consistency** — *after messages drain, all alive nodes that hold a given key agree on its (value, version, origin) tuple.*
2. **Version Monotonicity** — *a node's stored version for any key never decreases.*

Each `GossipNode` uses only the injected `SimEnv` for timers, randomness, and networking. On each gossip round, a node picks `fanout` random peers and sends its full key-value store. Receivers merge via a last-writer-wins rule (highest version, then highest origin ID as tiebreaker).

## Findings

Across **1000 seeds** of chaos (packet drops, duplicates, network partitions, and node crashes), Chronos confirmed **100% consistency** with zero invariant violations.
