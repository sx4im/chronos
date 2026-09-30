---
name: Good First Issue / Contributor Task
about: Template for scoped community tasks and starter issues
title: 'feat: '
labels: 'good first issue, help wanted'
assignees: ''
---

<!-- 
Tip: You can find pre-scoped tasks in GOOD_FIRST_ISSUES.md in the repo root!
-->

### Problem Statement & Context
A concise explanation of the problem, motivation, or feature opportunity.

### Desired Implementation
- **Target Package**: (e.g. `@sx4im/chronos-core`, `@sx4im/chronos-net`, `@sx4im/chronos-vitest`, `@sx4im/chronos-cli`, `@sx4im/chronos-inspector`, `examples/`)
- **Target Files**:
  - Implementation: `packages/.../src/...`
  - Tests: `packages/.../test/...`
- **Architectural Boundary**: (e.g. zero runtime deps in core, fail-closed, strictly deterministic)

### Step-by-Step Guidance
1. Step 1...
2. Step 2...
3. Step 3...

### Acceptance Criteria
- [ ] Positive and negative edge cases covered by automated tests
- [ ] Determinism guard remains 100% green (`pnpm vitest run packages/core/test/determinism.test.ts`)
- [ ] TypeScript strict mode and ESLint pass without warnings
- [ ] Zero new dependencies in `@sx4im/chronos-core`

### Verification Commands
```bash
# Run the specific test file
pnpm test <path/to/test>

# Full pre-flight verification bar
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

### Interested in working on this?
Leave a comment below saying you'd like to take it! Maintainers will confirm and assign you.
