# 🌟 Good First Issues & Contributor Roadmap

Welcome! We are excited to have you contribute to **Chronos**.

Whether this is your first open-source pull request or you are an experienced distributed systems engineer, this guide provides **curated, well-scoped starter tasks** that are open and ready to build.

Each issue has:
- A clear problem description
- The exact files to touch
- Recommended implementation steps
- Acceptance criteria and verification commands

---

## ⚡ 2-Minute Local Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/<your-username>/chronos.git
cd chronos

# 2. Install dependencies (requires Node >= 20 and pnpm >= 9)
pnpm install

# 3. Verify that all tests pass
pnpm vitest run packages/core/test/determinism.test.ts
pnpm test
```

> **The Golden Rule**: *Determinism is the product.* Any change that causes the same seed to produce a different trace is a bug. Never use real timers, `Date.now()`, or `Math.random()` in simulated paths. `@sx4im/chronos-core` must maintain **zero external runtime dependencies**.

---

## 📋 Open Issues Catalog

Click any issue to view or claim it on GitHub:

| # | Live GitHub Issue | Area | Difficulty | Package |
|---|---|---|---|---|
| 1 | [#22 Deterministic UUID v4 Generator (`env.uuid()`)](https://github.com/sx4im/chronos/issues/22) | Core / API | 🟢 Beginner | `@sx4im/chronos-core` |
| 2 | [#23 Packet Corruption Fault Injection (`corruptProb`)](https://github.com/sx4im/chronos/issues/23) | Network / Chaos | 🟡 Intermediate | `@sx4im/chronos-net` |
| 3 | [#24 Machine-Readable `--json` Flag for CLI Commands](https://github.com/sx4im/chronos/issues/24) | CLI / Tooling | 🟢 Beginner | `@sx4im/chronos-cli` |
| 4 | [#25 One-Click "Copy as Mermaid Diagram" in Inspector](https://github.com/sx4im/chronos/issues/25) | Frontend / DX | 🟡 Intermediate | `@sx4im/chronos-inspector` |
| 5 | [#26 Distributed Rate-Limiter (Token Bucket) Example](https://github.com/sx4im/chronos/issues/26) | Examples / SUT | 🟡 Intermediate | `examples/rate-limiter` |
| 6 | [#21 Keyboard Navigation in Time-Travel Inspector](https://github.com/sx4im/chronos/issues/21) | Frontend / UI | 🟢 Beginner | `@sx4im/chronos-inspector` |
| 7 | [#20 Distributed Lock with Lease Expiration Recipe](https://github.com/sx4im/chronos/issues/20) | Examples / SUT | 🟡 Intermediate | `examples/distributed-lock` |
| 8 | [#19 Burst Packet Loss via Gilbert-Elliott Channel Model](https://github.com/sx4im/chronos/issues/19) | Network / Chaos | 🔴 Advanced | `@sx4im/chronos-net` |
| 9 | [#18 Trace Divergence Diff Command (`chronos diff`)](https://github.com/sx4im/chronos/issues/18) | CLI / Tooling | 🟡 Intermediate | `@sx4im/chronos-cli` |

---

### Issue Details: #22 Deterministic UUID v4 Generator in `SimEnv`
- **Link**: [Issue #22](https://github.com/sx4im/chronos/issues/22)
- **Package**: `@sx4im/chronos-core`
- **Difficulty**: 🟢 Beginner

#### Problem Statement
Distributed systems code frequently creates unique identifiers (request IDs, correlation IDs, transaction tokens). When running under Chronos, calling Node's native `crypto.randomUUID()` triggers strict entropy guards or causes non-deterministic divergence across runs. Providing a built-in deterministic `env.uuid()` backed by the seeded PRNG lets users write clean, idiomatically reproducible code.

#### Implementation Steps
1. In `packages/core/src/random.ts`, add a method `uuid(): string` to `Rng`:
   - Generate 16 pseudo-random bytes from the seeded PRNG (e.g. using `nextU64()`).
   - Set version bits to `4` (UUID v4) and variant bits to `RFC 4122` (`0b10xx`).
   - Format into canonical hex string: `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.
2. In `packages/core/src/env.ts`, add `uuid: () => string` to the `SimEnv` interface and implement it in `SimEnvImpl`.
3. In `packages/core/src/real.ts`, implement `uuid()` in `RealEnv` using `crypto.randomUUID()`.
4. Add unit tests in `packages/core/test/random.test.ts` verifying format and deterministic replay.

---

### Issue Details: #23 Packet Corruption Fault Injection
- **Link**: [Issue #23](https://github.com/sx4im/chronos/issues/23)
- **Package**: `@sx4im/chronos-net`, `@sx4im/chronos-core`
- **Difficulty**: 🟡 Intermediate

#### Problem Statement
Real networks suffer from transmission errors, bit-flips, serialization glitches, and truncated packets. Adding configurable packet corruption (`corruptProb`) allows testing protocols for checksum validation and malformed message recovery.

#### Implementation Steps
1. In `packages/core/src/network.ts`, extend `NetworkConfig` with an optional `corruptProb?: number` (defaults to `0`).
2. In `packages/net/src/network.ts`, update `SimNetwork.send()`:
   - Check `this.o.rng.chance(this.o.config.corruptProb ?? 0)`.
   - If triggered, apply a deterministic payload mutator and log a `{ kind: "corrupt", from, to, summary }` event to the trace.
3. Deliver the corrupted payload to the recipient node.
4. Add tests in `packages/net/test/network.test.ts`.

---

### Issue Details: #24 Machine-Readable `--json` Flag for CLI
- **Link**: [Issue #24](https://github.com/sx4im/chronos/issues/24)
- **Package**: `@sx4im/chronos-cli`
- **Difficulty**: 🟢 Beginner

#### Problem Statement
When running Chronos inside CI/CD pipelines (GitHub Actions, GitLab CI), automation scripts need to programmatically inspect failure capsule statistics (`chronos stats <capsule>`) or replay results (`chronos replay <capsule>`). Adding a `--json` flag outputs clean, parseable JSON for `jq` and CI dashboards.

#### Implementation Steps
1. In `packages/cli/src/stats.ts`, check for `--json` in arguments or options.
2. If `--json` is passed, format the statistics object using `JSON.stringify(stats, null, 2)` and print directly to `stdout`.
3. In `packages/cli/src/replay.ts`, add `--json` support to output `{ seed, status: "passed" | "failed", durationMs, eventsCount }`.
4. Add tests in `packages/cli/test/stats.test.ts`.

---

### Issue Details: #25 One-Click Copy as Mermaid Diagram in Inspector
- **Link**: [Issue #25](https://github.com/sx4im/chronos/issues/25)
- **Package**: `@sx4im/chronos-inspector`
- **Difficulty**: 🟡 Intermediate

#### Problem Statement
When developers find a distributed bug with Chronos, they often share it on GitHub or Slack. The Inspector already calculates sequence flows. Adding a "Copy as Mermaid" button allows developers to paste interactive GitHub-flavored Mermaid sequence diagrams directly into GitHub pull requests and issues!

#### Implementation Steps
1. In `packages/inspector/src/SequenceDiagram.tsx`, add helper `exportToMermaid(events: TraceEvent[]): string`.
2. Add a "Copy Mermaid" button in the Sequence Diagram panel header.
3. On click, write to clipboard via `navigator.clipboard.writeText()` and display a brief "Copied!" notification.

---

### Issue Details: #26 Distributed Token Bucket Rate Limiter Example
- **Link**: [Issue #26](https://github.com/sx4im/chronos/issues/26)
- **Package**: `examples/rate-limiter`
- **Difficulty**: 🟡 Intermediate

#### Problem Statement
Rate limiters are critical microservice components that frequently suffer from race conditions under network latency and clock jitter. Creating a canonical rate limiter example under `examples/rate-limiter` showcases how Chronos tests token replenishment, burst capacity, and cluster-wide limits.

#### Implementation Steps
1. Create `examples/rate-limiter/limiter.ts`:
   - Implement a Token Bucket rate limiter that consumes tokens and replenishes over virtual time (`env.now()`).
2. Create `examples/rate-limiter/limiter.test.ts`:
   - Write a `simTest` simulating concurrent clients requesting tokens across 500 seeds.
   - Verify safety invariant: `consumedTokens <= maxCapacity + (elapsedTime * refillRate)`.
3. Add a concise `examples/rate-limiter/README.md`.

---

## 🚀 How to Claim and Submit Your Work

1. **Claim the task**: Open any of the issues above on GitHub and leave a comment saying you'd like to work on it! Maintainers will assign you.
2. **Create a branch**:
   ```bash
   git checkout -b feat/deterministic-uuid
   ```
3. **Run verification**:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```
4. **Submit a Pull Request**: Use Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`). Maintainers review PRs promptly!
