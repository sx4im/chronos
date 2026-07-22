# Virtual time and the scheduler

Simulations execute through a single event queue. The scheduler design controls event ordering and virtual time progression.

## The event heap: `(time, seq)`

The scheduler uses a binary min-heap ordered by a tuple:

1. **`time`**: the virtual timestamp in milliseconds when the event triggers.
2. **`seq`**: a monotonic insertion counter.

`seq` breaks ties when multiple events share the same virtual timestamp. Events scheduled for the same millisecond execute in insertion order. The pop sequence is determined entirely by scheduling history.

## Step loop execution

```
while (queue not empty and steps < maxSteps):
  event = pop min (time, seq)
  clock.advanceTo(event.time)
  run event.callback
  await microtask barrier
  run per-step hooks
```

System properties resulting from this loop:

- **Virtual time jumps**: sleeping for `1_000_000_000` ms schedules a wake event for that timestamp. The clock advances instantly without waiting for real time.
- **Monotonic clock**: virtual time never moves backward.

## The microtask barrier

When an event callback resolves a promise, V8 queues microtasks. The scheduler pauses execution until V8 completes the microtask queue, using `setImmediate` as a boundary marker:

```ts
export function drainMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
```

`setImmediate` executes after V8 empties the microtask queue. When the next scheduler event pops, pending promises have resolved.

## `await env.sleep(ms)` implementation

```ts
sleep(ms) {
  return new Promise((resolve) => {
    scheduler.schedule(clock.now() + ms, resolve, { kind: "wake", nodeId });
  });
}
```

The promise `resolve` function serves as the event callback. When virtual time reaches `now + ms`, the event pops, resolves the promise, and allows the async continuation to proceed.

`env.setTimeout(cb, ms)` uses the same scheduling path with a cancellation handle.

## Event trace logs

Events retain metadata (`timer`, `wake`, `send`, `deliver`, `crash`, `restart`, `partition`, `invariant-violation`). `TraceLogger` appends an entry as each event executes, recording event order for replay validation.

## Step limits

`maxSteps` bounds simulation runs (default: 10,000,000 steps). Reaching `maxSteps` before the event queue settles returns a step limit result rather than an invariant violation.
