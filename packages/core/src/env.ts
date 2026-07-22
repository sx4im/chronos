// SimEnv — the *only* surface user code touches at runtime.
// In tests, user code receives a SimEnv bound to the simulator.
// In production, the same code receives a RealEnv (see real.ts) with the same shape.

import type { Scheduler } from "./scheduler.js";
import type { VirtualClock } from "./clock.js";
import type { Rng } from "./random.js";

export interface TimerHandle {
  cancel(): void;
}

export interface SimNet {
  send(to: string, payload: unknown): void;
  onReceive(handler: (from: string, payload: unknown) => void): void;
}

export interface SimEnv {
  readonly nodeId: string;
  now(): number;
  random(): number; // [0,1) from the sim RNG
  sleep(ms: number): Promise<void>; // resolves after virtual ms
  setTimeout(cb: () => void, ms: number): TimerHandle;
  net: SimNet;
}

/** `await env.sleep(ms)` parks the continuation as a future wake event;
 *  the scheduler resumes it when virtual time reaches it. */
export function makeSleep(
  scheduler: Scheduler,
  clock: VirtualClock,
  nodeId: string,
): (ms: number) => Promise<void> {
  return (ms: number) =>
    new Promise<void>((resolve) => {
      const delay = Math.max(0, Number.isFinite(ms) ? ms : 0);
      scheduler.schedule(clock.now() + delay, resolve, { kind: "wake", nodeId });
    });
}

/** Deterministic setTimeout: schedules a timer event, returns a cancel handle. */
export function makeSetTimeout(
  scheduler: Scheduler,
  clock: VirtualClock,
  nodeId: string,
): (cb: () => void, ms: number) => TimerHandle {
  return (cb: () => void, ms: number) => {
    const delay = Math.max(0, Number.isFinite(ms) ? ms : 0);
    const ev = scheduler.schedule(clock.now() + delay, cb, {
      kind: "timer",
      nodeId,
    });
    return {
      cancel(): void {
        ev.canceled = true;
      },
    };
  };
}

/** A network stub for envs that don't send messages (used before @sx4im/chronos-net is wired in). */
export const noopNet: SimNet = {
  send(): void {
    /* no-op */
  },
  onReceive(): void {
    /* no-op */
  },
};

export interface CreateEnvOptions {
  scheduler: Scheduler;
  clock: VirtualClock;
  rng: Rng;
  nodeId: string;
  net?: SimNet;
}

import { AsyncLocalStorage } from "node:async_hooks";

const simEnvStorage = new AsyncLocalStorage<SimEnv>();

/** Run a sync/async scope with an implicit SimEnv, accessible downstream via `getSimEnv()`. */
export function withSimEnv<T>(env: SimEnv, fn: () => T): T {
  return simEnvStorage.run(env, fn);
}

/** Retrieve the current implicit SimEnv if set in the current execution context. */
export function getSimEnv(): SimEnv | undefined {
  return simEnvStorage.getStore();
}

export function createEnv(opts: CreateEnvOptions): SimEnv {
  const { scheduler, clock, rng, nodeId, net } = opts;
  const env: SimEnv = {
    nodeId,
    now: () => clock.now(),
    random: () => rng.nextFloat(),
    sleep: makeSleep(scheduler, clock, nodeId),
    setTimeout: makeSetTimeout(scheduler, clock, nodeId),
    net: net ?? noopNet,
  };
  return env;
}
