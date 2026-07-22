// RealEnv — the production adapter with the SAME shape as SimEnv.
// This proves the abstraction is real, not a test-only toy: the same business
// logic runs in tests (against an injected simulated env) and in production
// (against this real env). Only the `env` differs; the code doesn't.

import type { SimEnv, SimNet, TimerHandle } from "./env.js";

export interface RealTransport {
  send(to: string, payload: unknown): void;
  onReceive(handler: (from: string, payload: unknown) => void): void;
}

export interface RealEnvOptions {
  nodeId: string;
  transport: RealTransport;
}

export class RealEnv implements SimEnv {
  readonly net: SimNet;

  constructor(private opts: RealEnvOptions) {
    this.net = {
      send: (to, payload) => opts.transport.send(to, payload),
      onReceive: (handler) =>
        opts.transport.onReceive((from, payload) => handler(from, payload)),
    };
  }

  get nodeId(): string {
    return this.opts.nodeId;
  }

  now(): number {
    return Date.now();
  }

  random(): number {
    return Math.random();
  }

  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  setTimeout(cb: () => void, ms: number): TimerHandle {
    const id = globalThis.setTimeout(cb, ms);
    return { cancel: () => globalThis.clearTimeout(id) };
  }
}
