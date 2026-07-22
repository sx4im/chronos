// Strict-mode guards (§3.5) — the *safety net*, not the primary mechanism.
//
// The blessed path is dependency injection (user code receives an `env` and uses
// env.now()/env.random()/env.setTimeout). These guards catch code that *forgot*
// the DI contract and reached for the globals instead — by either redirecting
// the globals to the simulator («route», the onboarding default) or throwing
// («throw», recommended in CI) so accidental entropy is caught loudly.
//
// Two levels:
//   "route"  — Date.now / Math.random / performance.now / the Date constructor
//              and setTimeout are redirected to the injected env; the program
//              keeps running but deterministically.
//   "throw"  — entropy reads (Date.now, Math.random, performance.now, new Date())
//              throw a helpful error; setTimeout still routes (a forgotten timer
//              is recoverable, entropy is not).
// setInterval always throws in both levels: env has no recurring primitive, so
// a real setInterval would be a genuine entropy/time leak. Use env.setTimeout
// + recursion, or convert to a single scheduled wake.
//
// installGuards returns a restore() — ALWAYS call it (in a finally) before
// yielding to the broader runtime, or the patched globals will leak into Vitest
// and other tooling. The Simulator does not install these by default (DI is the
// contract); tests/users opt in.

import type { SimEnv } from "./env.js";

export type StrictLevel = "route" | "throw";

export interface InstalledGuards {
  /** Restore every patched global. Idempotent. */
  restore(): void;
}

/** A thrown-entropy error carries the offending call site in its message. */
export class StrictModeViolation extends Error {
  constructor(public readonly what: string) {
    super(
      `Chronos strict mode (${what}): this global reads real-world entropy. ` +
        `Obtain it from the injected \`env\` instead (env.now()/env.random()/env.setTimeout).`,
    );
    this.name = "StrictModeViolation";
  }
}

interface SavedGlobals {
  date: DateConstructor;
  mathRandom: typeof Math.random;
  perfNow: (() => number) | undefined;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  clearInterval: typeof globalThis.clearInterval;
  setInterval: typeof globalThis.setInterval;
}

// Global nesting tracking for re-entrant installGuards calls
let patchDepth = 0;
let globalSaved: SavedGlobals | null = null;

// A function-shaped Date stand-in. Using `Function` (not a class) keeps `new
// Date()` returning a real Date instance whose prototype chain is unchanged, so
// `instanceof Date` and all Date methods keep working without touching the
// read-only `DateConstructor.prototype`.
type GuardedDateCtor = DateConstructor & { (this: unknown, ...args: unknown[]): Date | string };

export function installGuards(env: SimEnv, level: StrictLevel = "route"): InstalledGuards {
  if (patchDepth === 0) {
    globalSaved = {
      date: Date,
      mathRandom: Math.random,
      perfNow:
        typeof performance !== "undefined" ? (performance.now.bind(performance) as () => number) : undefined,
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      clearInterval: globalThis.clearInterval,
      setInterval: globalThis.setInterval,
    };
  }
  patchDepth++;

  let restored = false;
  const restore = (): void => {
    if (restored) return;
    restored = true;
    patchDepth--;
    if (patchDepth === 0 && globalSaved) {
      (globalThis as unknown as { Date: DateConstructor }).Date = globalSaved.date;
      Math.random = globalSaved.mathRandom;
      if (typeof performance !== "undefined" && globalSaved.perfNow) {
        performance.now = globalSaved.perfNow;
      }
      globalThis.setTimeout = globalSaved.setTimeout;
      globalThis.clearTimeout = globalSaved.clearTimeout;
      globalThis.clearInterval = globalSaved.clearInterval;
      globalThis.setInterval = globalSaved.setInterval;
      globalSaved = null;
    }
  };

  try {
    // --- entropy: Math.random / performance.now (plain function props) ---
    if (level === "throw") {
      Math.random = thrown("Math.random") as unknown as typeof Math.random;
      if (typeof performance !== "undefined") {
        performance.now = thrown("performance.now") as unknown as () => number;
      }
    } else {
      Math.random = (() => env.random()) as unknown as typeof Math.random;
      if (typeof performance !== "undefined") {
        performance.now = (() => env.now()) as unknown as () => number;
      }
    }

    // --- the Date constructor: routes/throws for no-arg (wall-clock) reads;
    //     arg-ful construction always dispatches to the real ctor unchanged. ---
    const RealDateToUse = globalSaved?.date ?? Date;
    const GuardedDate = makeGuardedDate(RealDateToUse, level, () => env.now());
    (globalThis as unknown as { Date: DateConstructor }).Date = GuardedDate as DateConstructor;

    // --- setTimeout & clearTimeout: route to env in BOTH levels (a forgotten timer is
    //     recoverable; forcing it onto the sim keeps the run deterministic). ---
    globalThis.setTimeout = ((handler: ((...args: unknown[]) => void) | string, ms = 0, ...args: unknown[]) => {
      const fn = typeof handler === "function" ? handler : () => new Function(String(handler))();
      const handle = env.setTimeout(() => fn(...args), ms);
      return handle as unknown as ReturnType<typeof globalThis.setTimeout>;
    }) as unknown as typeof globalThis.setTimeout;

    const clearHandle = ((id: unknown) => {
      if (id && typeof id === "object" && "cancel" in (id as Record<string, unknown>)) {
        (id as { cancel: () => void }).cancel();
      }
    }) as unknown as typeof globalThis.clearTimeout;

    globalThis.clearTimeout = clearHandle;
    globalThis.clearInterval = clearHandle as unknown as typeof globalThis.clearInterval;

    // --- setInterval: env has no recurring primitive → always throw. ---
    globalThis.setInterval = thrown("setInterval") as unknown as typeof globalThis.setInterval;
  } catch (err) {
    restore();
    throw err;
  }

  return { restore };
}

function thrown(what: string): () => never {
  return () => {
    throw new StrictModeViolation(what);
  };
}

function makeGuardedDate(
  RealDate: DateConstructor,
  level: StrictLevel,
  nowFn: () => number,
): GuardedDateCtor {
  // `Date()` called as a function (with or without arguments) always returns a
  // string representing the current time (reading the wall clock).
  // `new Date()` with no arguments reads the wall clock.
  // Arg-ful construction (e.g. `new Date(ms)`) is safe as it doesn't read wall clock.
  function GuardedDate(this: unknown, ...args: unknown[]): Date | string {
    const viaNew = new.target !== undefined;
    if (!viaNew) {
      if (level === "throw") throw new StrictModeViolation("Date()");
      return new RealDate(nowFn()).toString();
    }
    if (args.length === 0) {
      if (level === "throw") throw new StrictModeViolation("new Date()");
      return new RealDate(nowFn());
    }
    return new (RealDate as unknown as { new (...a: unknown[]): Date })(...args);
  }

  // Copy the statics so Date.parse / Date.UTC keep working; Date.now routes/throws.
  const g = GuardedDate as unknown as {
    now: typeof Date.now;
    parse: typeof Date.parse;
    UTC: typeof Date.UTC;
  };
  g.parse = RealDate.parse;
  g.UTC = RealDate.UTC;
  g.now =
    level === "throw"
      ? (thrown("Date.now") as unknown as typeof Date.now)
      : ((() => nowFn()) as unknown as typeof Date.now);

  // Point the wrapper's prototype at the real Date prototype so `instanceof Date`
  // keeps working for the real Date instances we construct. (DateConstructor's
  // `prototype` is read-only at the TS level but writable at runtime.)
  (GuardedDate as unknown as { prototype: DateConstructor["prototype"] }).prototype = RealDate.prototype;
  return GuardedDate as GuardedDateCtor;
}

