/**
 * Dogfood: a replicated counter with a deliberate race bug.
 *
 * Each node holds a local count. `increment()` sends a message to ALL nodes
 * (including self) over the simulated network. On receipt, each node naively
 * increments its counter by 1.
 *
 * BUG: the application is NOT idempotent.
 * - If a message is DROPPED, the destination misses the increment → values diverge.
 * - If a message is DUPLICATED, the destination applies the same increment twice
 *   → values diverge (double-counting).
 *
 * In vanilla operation (no loss / no duplication), all nodes converge to the
 * same total because every increment message reaches every node exactly once.
 * But with the simulated network injecting faults, the invariant
 *   "all local counts are equal"
 * is violated — and DST finds the exact seed that triggers it.
 */

import type { SimEnv } from "@sx4im/chronos-core";

export interface CounterEnv {
  nodeId: string;
  sim: SimEnv;
}

export class Counter {
  private _value = 0;
  private env: CounterEnv;

  constructor(env: CounterEnv) {
    this.env = env;
    this.env.sim.net.onReceive((_from, payload: unknown) => {
      void _from; // parameter required by handler signature
      if (payload === "inc") {
        this._incrementLocally();
      }
    });
  }

  /** The user-facing operation: broadcast an increment to all nodes. */
  increment(): void {
    this._value++;
    // Broadcast to the known set of peers could be passed in here,
    // but in the sim the counter just sends to its "peers" list which
    // the test wires when constructing the system.
    for (const peerId of this._allPeerIds) {
      this.env.sim.net.send(peerId, "inc");
    }
  }

  get value(): number {
    return this._value;
  }

  private _allPeerIds: string[] = [];
  setPeerIds(ids: string[]): void {
    this._allPeerIds = ids;
  }

  private _incrementLocally(): void {
    this._value += 1; // BUG: not idempotent — we'll double-count on dups.
  }
}
