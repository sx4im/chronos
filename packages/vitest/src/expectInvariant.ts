// expectInvariant (§4.4) — assert a property inside a sim body.
//
// Two forms, dispatched on arity so the same call site reads naturally:
//   expectInvariant("name", () => cond)        // synchronous post-condition:
//                                              //   evaluated immediately;
//                                              //   throws on failure.
//   expectInvariant("name", (w) => cond)       // safety invariant: registered
//                                              //   on the sim and checked
//                                              //   after every scheduler step.
//
// The "active sim" is a module-level registrar set by simTest/replayTest around
// each body invocation, so `expectInvariant` can be imported bare and called
// inside the body — matching the spec's §4.1 example. With `exactOptional...`
// in mind the only shared state is the active sim reference.

import { AsyncLocalStorage } from "node:async_hooks";
import { InvariantViolated, type Simulator, type WorldView } from "@sx4im/chronos-core";

type InvariantPredicate =
  | ((world: WorldView) => boolean | void)
  | (() => boolean | void);

const activeStorage = new AsyncLocalStorage<Simulator>();
let fallbackActive: Simulator | null = null;

/** Called by simTest/replayTest before invoking a body. */
export function setActiveSim(sim: Simulator): void {
  fallbackActive = sim;
}

/** Called in a `finally` after the body completes. */
export function clearActiveSim(): void {
  fallbackActive = null;
}

/** Run an async function within the context of an active Simulator. */
export function runWithActiveSim<R>(sim: Simulator, fn: () => R): R {
  setActiveSim(sim);
  try {
    return activeStorage.run(sim, fn);
  } finally {
    clearActiveSim();
  }
}

/** Retrieve the current active Simulator, preferring ALS context over fallback. */
export function getActiveSim(): Simulator | null {
  return activeStorage.getStore() ?? fallbackActive;
}

export function expectInvariant(name: string, predicate: InvariantPredicate): void {
  const sim = getActiveSim();
  if (sim === null) {
    throw new Error(
      "expectInvariant must be called inside a simTest/replayTest body while the sim is active",
    );
  }

  if (predicate.length === 0) {
    // Synchronous post-condition: evaluate now, after the body has progressed
    // (typically after `await sim.settle()`).
    let ok = true;
    let detail = "";
    try {
      const r = (predicate as () => unknown)();
      if (r !== null && typeof r === "object" && "then" in (r as Record<string, unknown>)) {
        throw new Error(`expectInvariant predicate "${name}" must be synchronous (returned a Promise)`);
      }
      if (r === false) {
        ok = false;
        detail = "expectInvariant returned false";
      }
    } catch (e) {
      ok = false;
      detail = `threw: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (!ok) {
      sim.trace.append(sim.clock.now(), {
        kind: "invariant-violation",
        name,
        detail: detail || "expectInvariant failed",
      });
      throw new InvariantViolated(name, detail || "expectInvariant failed");
    }
  } else {
    // Safety invariant: defer to the Simulator's per-step checker.
    sim.addInvariant({
      name,
      kind: "safety",
      check: predicate as (world: WorldView) => boolean | void,
    });
  }
}
