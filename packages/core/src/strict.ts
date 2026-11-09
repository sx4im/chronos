// Strict-mode guards (§3.5) — the *safety net*, not the primary mechanism.
//
// The blessed path is dependency injection (user code receives an `env` and uses
// env.now()/env.random()/env.setTimeout). These guards catch code that *forgot*
// the DI contract and reached for the globals instead — by either redirecting
// the globals to the simulator («route», the onboarding default) or throwing
// («throw», recommended in CI) so accidental entropy is caught loudly.
//
// Two levels:
//   "route"  — Date.now / Math.random / performance.now / process.hrtime / the
//              Date constructor and setTimeout are redirected to the injected
//              env; the program keeps running but deterministically.
//   "throw"  — entropy reads (Date.now, Math.random, performance.now,
//              new Date(), process.hrtime) throw a helpful error; setTimeout
//              still routes (a forgotten timer is recoverable, entropy is not).
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
  hrtime: (() => [number, number]) | undefined;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
  clearInterval: typeof globalThis.clearInterval;
  setInterval: typeof globalThis.setInterval;
}

/** Structural shape of `process.hrtime` (kept dependency-free of @types/node). */
interface HrtimeFn {
  (origin?: [number, number]): [number, number];
  bigint: () => bigint;
}

// Stack of saved global snapshots for nested installGuards calls.
const savedStack: SavedGlobals[] = [];

type GuardedDateCtor = DateConstructor & { (this: unknown, ...args: unknown[]): Date | string };

export function installGuards(env: SimEnv, level: StrictLevel = "route"): InstalledGuards {
  const proc = globalThis as {
    process?: { hrtime?: HrtimeFn };
  };
  const snapshot: SavedGlobals = {
    date: Date,
    mathRandom: Math.random,
    perfNow:
      typeof performance !== "undefined" ? (performance.now.bind(performance) as () => number) : undefined,
    hrtime: proc.process?.hrtime as (() => [number, number]) | undefined,
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    clearInterval: globalThis.clearInterval,
    setInterval: globalThis.setInterval,
  };
  const rootDate = savedStack[0]?.date ?? snapshot.date;
  savedStack.push(snapshot);

  let restored = false;
  const restore = (): void => {
    if (restored) return;
    restored = true;
    const idx = savedStack.lastIndexOf(snapshot);
    if (idx !== -1) savedStack.splice(idx, 1);
    if (idx === savedStack.length) {
      (globalThis as unknown as { Date: DateConstructor }).Date = snapshot.date;
      Math.random = snapshot.mathRandom;
      if (typeof performance !== "undefined" && snapshot.perfNow) {
        performance.now = snapshot.perfNow;
      }
      if (snapshot.hrtime !== undefined) {
        const p = globalThis as unknown as {
          process?: { hrtime?: HrtimeFn };
        };
        if (p.process) {
          p.process.hrtime = snapshot.hrtime as HrtimeFn;
        }
      }
      globalThis.setTimeout = snapshot.setTimeout;
      globalThis.clearTimeout = snapshot.clearTimeout;
      globalThis.clearInterval = snapshot.clearInterval;
      globalThis.setInterval = snapshot.setInterval;
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

    // --- entropy: process.hrtime — monotonic high-res wall clock, same bug
    //     class as performance.now but invisible to the guards above (and only
    //     caught statically by `chronos check` until this patch existed).
    //     Patched whenever a `process` global with an hrtime function exists. ---
    const proc = globalThis as unknown as {
      process?: { hrtime?: HrtimeFn };
    };
    if (proc.process && typeof proc.process.hrtime === "function") {
      if (level === "throw") {
        const throwing = thrown("process.hrtime") as unknown as HrtimeFn;
        throwing.bigint = thrown(
          "process.hrtime.bigint",
        ) as unknown as () => bigint;
        proc.process.hrtime = throwing;
      } else {
        proc.process.hrtime = makeRoutedHrtime(() => env.now());
      }
    }

    // --- the Date constructor: routes/throws for no-arg (wall-clock) reads;
    //     arg-ful construction always dispatches to the real ctor unchanged. ---
    const GuardedDate = makeGuardedDate(rootDate, level, () => env.now());
    (globalThis as unknown as { Date: DateConstructor }).Date = GuardedDate as DateConstructor;

    // --- setTimeout & clearTimeout: route to env in BOTH levels (a forgotten timer is
    //     recoverable; forcing it onto the sim keeps the run deterministic). ---
    //
    // String handlers are REFUSED, exactly as Node's own `setTimeout` refuses
    // them. Compiling one (`new Function(handler)`) would turn any string that
    // reaches a forgotten global timer — a message payload from a simulated
    // peer, a field of an untrusted capsule — into executed code, adding an
    // eval sink to the harness that the runtime it emulates does not even have.
    globalThis.setTimeout = ((handler: ((...args: unknown[]) => void) | string, ms = 0, ...args: unknown[]) => {
      if (typeof handler !== "function") {
        throw new TypeError(
          `The "callback" argument must be of type function. Received type ${typeof handler}. ` +
            `Chronos strict mode does not compile string timer handlers (neither does Node).`,
        );
      }
      const handle = env.setTimeout(() => handler(...args), ms);
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

/** A virtual-time `process.hrtime` stand-in: reads [s, ns] and .bigint() from
 *  the sim's clock instead of the monotonic wall clock. Supports the
 *  `hrtime(origin)` diff form (elapsed measurements keep working — just
 *  deterministically), which is hrtime's dominant real-world use. */
function makeRoutedHrtime(nowFn: () => number): HrtimeFn {
  const hrtime = (origin?: [number, number]): [number, number] => {
    const ms = nowFn();
    const sec = Math.floor(ms / 1000);
    // Round-to-nearest keeps sub-ms precision monotonic in virtual time; the
    // modulo guard is belt-and-braces against float edge cases.
    let ns = Math.round((ms / 1000 - sec) * 1e9);
    if (ns >= 1e9) {
      ns -= 1e9;
    }
    const cur: [number, number] = [sec, ns];
    if (origin === undefined) return cur;
    // Diff form: cur − origin, normalized so nsec ∈ [0, 10^9) per Node docs.
    let dSec = cur[0] - origin[0];
    let dNs = cur[1] - origin[1];
    if (dNs < 0) {
      dSec -= 1;
      dNs += 1e9;
    }
    return [dSec, dNs];
  };
  hrtime.bigint = (): bigint =>
    BigInt(Math.round(nowFn() * 1e6)); // virtual ms → virtual ns
  return hrtime;
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

