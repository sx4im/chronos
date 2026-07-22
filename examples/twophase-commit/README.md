# Two-Phase Commit (2PC) — a dogfood for Chronos

A **Two-Phase Commit (2PC) Coordinator and Participant** protocol run under Chronos, exercising transaction atomicity:

1. **Atomicity Safety** — *all non-crashed participants reach identical transaction decisions (never mixed commit and abort).*
2. **Non-Spontaneous Commit** — *if any participant votes ABORT (or times out), no participant ever commits.*

Each coordinator and participant uses only the injected `SimEnv`.

## Findings

Across **1000 seeds** of chaos (packet drops, reordering, network partitions, and node crashes), Chronos confirmed **100% atomicity** with zero invariant violations.
