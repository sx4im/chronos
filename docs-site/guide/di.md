# Writing testable systems with DI

Chronos requires one core rule for systems under test:

> Obtain time, randomness, timers, and network operations from an injected `env: SimEnv` instead of global runtime methods.

Dependency injection is the primary mechanism. Strict mode guards act as a fallback to detect unhandled global calls.

## The `SimEnv` interface

```ts
interface SimEnv {
  readonly nodeId: string;
  now(): number; // virtual time in milliseconds
  random(): number; // [0, 1) from the seeded PRNG
  sleep(ms: number): Promise<void>; // resolves after virtual ms
  setTimeout(cb: () => void, ms: number): TimerHandle;
  net: SimNet; // send / onReceive
}
```

## The translation table

| Avoid in simulated code | Use instead |
| --- | --- |
| `Date.now()` / `new Date()` / `performance.now()` | `env.now()` |
| `Math.random()` / `crypto.getRandomValues()` | `env.random()` |
| `setTimeout` / `setInterval` / `setImmediate` | `env.setTimeout()` / `env.sleep()` |
| Native sockets / `net` / `http` | `env.net` |

Determinism depends on having single sources of time and entropy. A direct `Date.now()` call causes execution to diverge across runs with the same seed.

## Structuring code around `env`

Pass `env` through constructors or factory functions:

```ts
class Raft {
  private timer?: { cancel(): void };

  constructor(
    private env: SimEnv,
    private peers: string[]
  ) {
    env.net.onReceive((from, msg) => this.handle(from, msg));
    this.resetElectionTimer();
  }

  private resetElectionTimer() {
    this.timer?.cancel();
    // Randomized timeout using the seeded PRNG
    const ms = 150 + Math.floor(this.env.random() * 150);
    this.timer = this.env.setTimeout(() => this.startElection(), ms);
  }
}
```

Inside a simulation, `env` binds to the simulator's virtual clock and network. The class itself has no simulation-specific logic.

## Production adapter: `RealEnv`

The `@sx4im/chronos-core/real` entrypoint exports an adapter with the same interface: `now()` calls `Date.now()`, `random()` calls `Math.random()`, `setTimeout()` delegates to Node.js timers, and `net` hooks into your transport layer.

```ts
import { createRealEnv } from "@sx4im/chronos-core/real";

const env = createRealEnv({ nodeId: "node-1", net: myRealTransport });
const raft = new Raft(env, peers); // Uses identical application logic
```

Application code remains unchanged between test and production environments.

## Strict mode guards

`simTest` configures global guards around test execution to catch unseeded global calls:

- **`route`** (default): redirects `Date.now()`, `Math.random()`, and timer calls to the virtual clock and scheduler.
- **`throw`** (`CHRONOS_STRICT=throw`): throws a `StrictModeViolation` when an unseeded global call occurs.
- **`off`** (`CHRONOS_STRICT=off`): disables global guards.

Guards are restored after each test completes.

## `async` and `await` usage

Promises and microtasks run normally. V8 processes microtasks between scheduler steps. `await env.sleep(10)` schedules a virtual-time continuation while native microtask queues execute deterministically.
