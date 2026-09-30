# Contributing to Chronos

Thanks for your interest in contributing to **Chronos**! As an open-source Deterministic Simulation Testing (DST) framework, community contributions help make concurrent and distributed software in the JavaScript/TypeScript ecosystem rock solid.

---

## 🌟 Start Here: Good First Issues

If you're looking for an impactful way to get started, check out our curated list of beginner and intermediate tasks:

👉 **[Browse the Good First Issues Catalog](./GOOD_FIRST_ISSUES.md)**

Each issue in the catalog contains:
- Exact problem statement and motivation
- Target package and file paths
- Step-by-step implementation guide
- Acceptance criteria and verification commands

You can also browse open issues on GitHub tagged with [`good first issue`](https://github.com/sx4im/chronos/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) and [`help wanted`](https://github.com/sx4im/chronos/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22).

---

## ⚖️ The Golden Rule

> **Determinism is the product.** Any change that causes the same seed to produce a different trace is a breaking bug. The core promise of Chronos is: *same seed ⇒ byte-identical run, forever*.

The determinism guard test (`packages/core/test/determinism.test.ts`) must **never fail**. If it fails or flakes, stop all other work and fix it first.

### Safe Simulation Patterns

**Never** introduce real-world time, real-world entropy, or native I/O inside simulation paths. Always use the injected `env`:

| Avoid (Inside Simulations) | Use Injected Interface | Why |
| :--- | :--- | :--- |
| `Date.now()`, `new Date()`, `performance.now()`, `process.hrtime()` | `env.now()` | Virtual clock fast-forwards instantly and deterministically. |
| `Math.random()`, `crypto.randomBytes()`, `crypto.randomUUID()` | `env.random()` | Seeded `xoshiro256**` PRNG ensures reproducible randomness. |
| Native `setTimeout`, `setInterval`, `setImmediate` | `env.setTimeout()`, `env.sleep()` | Virtual scheduler coordinates all async operations via a deterministic min-heap. |
| Native `net.Socket`, `fetch`, `WebSocket` | `env.net` | Simulated network injects latency, drops, duplicates, and partitions deterministically. |

The same user business logic runs in production via `RealEnv` with the same `SimEnv` interface.

### Architectural Rules
- `@sx4im/chronos-core` has **zero external runtime dependencies**. Do not add any.
- TypeScript is configured in **strict mode** with `noUncheckedIndexedAccess`. Do not loosen type definitions or add `any` casts to make code compile.
- Single responsibility: Keep source files modular and under 300 lines where practical.

---

## ⚡ 2-Minute Local Development Setup

Prerequisites: **Node.js >= 20** and **pnpm >= 9** (`corepack enable && corepack prepare pnpm@latest --activate`).

```bash
# 1. Clone the repository
git clone https://github.com/sx4im/chronos.git
cd chronos

# 2. Install workspace dependencies
pnpm install

# 3. Fast sanity smoke test (~5 seconds)
pnpm vitest run packages/core/test/determinism.test.ts

# 4. Run the full test suite
pnpm test

# 5. Full pre-flight verification bar (must pass before opening a PR)
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

### Useful Development Commands

- `pnpm test:watch`: Runs Vitest in interactive watch mode for instant feedback during TDD.
- `pnpm --filter @sx4im/chronos-inspector dev`: Launches the interactive visual Time-Travel Inspector locally at `http://localhost:5173`.
- `pnpm format`: Formats all files with Prettier.

---

## 🛠️ Contribution Workflow

1. **Find or open an issue**: Choose an issue from [GOOD_FIRST_ISSUES.md](./GOOD_FIRST_ISSUES.md) or open a new issue describing what you'd like to build.
2. **Claim the issue**: Leave a short comment so others know you're working on it. Maintainers will confirm and assign you.
3. **Create a topic branch**:
   ```bash
   git checkout -b feat/add-uuid-generator
   ```
4. **Implement incrementally**: Write tests first or alongside your implementation.
5. **Run the pre-flight checks**:
   ```bash
   pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```
6. **Commit with Conventional Commits**: Use clean commit messages like `feat(core): add deterministic uuid generator` or `fix(net): handle zero latency edge case`.
7. **Open a Pull Request**: Provide a concise description of your changes and reference the issue (e.g. `Closes #12`).

---

## 📋 Pull Request Checklist

Before submitting your PR, ensure:
- [ ] Determinism guard passes: `pnpm vitest run packages/core/test/determinism.test.ts`
- [ ] Complete CI verification passes: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
- [ ] Tests added or updated for any new functionality
- [ ] `@sx4im/chronos-core` has zero new runtime dependencies
- [ ] No native `Date.now()`, `Math.random()`, or unvirtualized timers in simulated code
- [ ] Commits follow [Conventional Commits](https://www.conventionalcommits.org/)

---

## 🐛 Found a Bug in Your Own System Using Chronos?

That's the best kind of issue! When Chronos discovers an invariant violation, it writes a **failure capsule** file (`.chronos/failures/<seed>.json`).

You can report it or share the failure reproduction with your team. Include:
1. The failure seed
2. The scenario configuration
3. The violated invariant message
4. The failure capsule JSON (if shareable)

Anyone with Chronos can instantly run `chronos replay <seed>.json` and replay the exact race condition.

---

## 💬 Community & Questions

Have questions, ideas, or need guidance?
- Open a discussion in [GitHub Discussions](https://github.com/sx4im/chronos/discussions)
- Report issues in [GitHub Issues](https://github.com/sx4im/chronos/issues)
- Review our [Code of Conduct](./CODE_OF_CONDUCT.md)

Thank you for helping make distributed systems testing accessible and reproducible for everyone!
