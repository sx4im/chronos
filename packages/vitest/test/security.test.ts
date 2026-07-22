// Security regression tests for the @sx4im/chronos-vitest layer (audit areas A1 / B1 /
// B2 / B3). A capsule is shared, untrusted input — JSON someone hands you in an
// issue or that CI produces — so `readCapsule`/`validateCapsule` must turn a
// malformed capsule into a clear, content-free `InvalidCapsule` BEFORE any of
// its fields touch the Simulator. In particular: a NaN/Infinity/negative
// `maxSteps`/`network.minLatency`/chaos-prob must not reach the scheduler (B2 —
// it would silently corrupt event ordering or disable chaos), and a non-JSON
// file must not disclose its bytes via the `JSON.parse` SyntaxError (the
// `chronos replay /etc/passwd` content-disclosure path).
//
// Also pins the A1 wiring: `executeScenario` installs strict guards by default
// (route level; `CHRONOS_STRICT=throw` makes them throw), so a forgotten
// `Date.now()` in a sim body can no longer silently turn a deterministic run
// nondeterministic — and `resolveSeeds` rejects a non-decimal `CHRONOS_SEED`
// up front rather than throwing deep inside `BigInt`.
//
// Real `fs` here is the test harness, not simulated code — the prime directive's
// in-simulation entropy ban is untouched. Capsules go to per-test temp dirs
// (mkdtemp under os.tmpdir) so the suite leaves no artifacts.

import { describe, it, expect } from "vitest";
import { mkdtempSync, existsSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateCapsule,
  InvalidCapsule,
  readCapsule,
  writeCapsule,
  runSimTest,
  resolveSeeds,
  type SimTestBody,
} from "@sx4im/chronos-vitest";
import { StrictModeViolation } from "@sx4im/chronos-core";
import { buildSimulator } from "../src/engine.js";

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), "chronos-sec-"));
}

// A capsule object that validateCapsule accepts. Returns a fresh deep copy typed
// as a record so individual malformed cases can mutate one field without
// disturbing the others (and without `any`).
function net(): Record<string, unknown> {
  return { minLatency: 0, maxLatency: 10, dropProb: 0.1, dupProb: 0.05 };
}
function chaos(): Record<string, unknown> {
  return {
    partitionProb: 0.1,
    crashProb: 0.1,
    restartProb: 0.1,
    maxPartitionMs: 200,
    maxCrashFraction: 0.5,
  };
}
function cfg(): Record<string, unknown> {
  return { network: { ...net() }, chaos: { ...chaos() } };
}
function trace(): Record<string, unknown> {
  return { seed: "42", config: {}, nodes: ["a", "b"], events: [], result: "violation" };
}
function base(): Record<string, unknown> {
  return {
    chronosVersion: "0.0.0",
    seed: "42",
    nodes: ["a", "b"],
    config: cfg(),
    maxSteps: 10_000,
    invariant: { name: "all counts equal", detail: "n0=1 n1=2" },
    trace: trace(),
  };
}
function asMap(v: unknown): Record<string, unknown> {
  return v as Record<string, unknown>;
}

// Shorthand: mutating `base()` with `m` must make validateCapsule throw a
// message matching `re`. Keeps every rejection case to one line in the test.
function rej(m: (c: Record<string, unknown>) => void, re: RegExp): void {
  const c = base();
  m(c);
  expect(() => validateCapsule(c)).toThrow(re);
}

describe("validateCapsule — happy path", () => {
  it("accepts a well-formed capsule and returns it typed", () => {
    const c = base();
    const cap = validateCapsule(c);
    expect(cap.seed).toBe("42");
    expect(cap.nodes).toEqual(["a", "b"]);
    expect(cap.maxSteps).toBe(10_000);
    expect(cap.config.network.minLatency).toBe(0);
    expect(cap.config.chaos.partitionProb).toBe(0.1);
    expect(cap.invariant.name).toBe("all counts equal");
    expect(Array.isArray(cap.trace.events)).toBe(true);
  });

  it("accepts a capsule with chronosVersion omitted (defaulted to empty)", () => {
    const c = base();
    delete c.chronosVersion;
    expect(validateCapsule(c).chronosVersion).toBe("");
  });

  it("accepts a negative seed string", () => {
    const c = base();
    c.seed = "-5";
    expect(validateCapsule(c).seed).toBe("-5");
  });
});

describe("validateCapsule — rejects malformed shape (B1/B2)", () => {
  it("rejects a non-object root", () => {
    expect(() => validateCapsule(null)).toThrow(/root/);
    expect(() => validateCapsule([])).toThrow(/root/);
    expect(() => validateCapsule("not an object")).toThrow(/root/);
    expect(() => validateCapsule(42)).toThrow(/root/);
  });

  it("rejects a non-decimal seed", () => {
    rej((c) => (c.seed = 123), /seed/);
    rej((c) => (c.seed = "0x10"), /seed/);
    rej((c) => (c.seed = "1.5"), /seed/);
    rej((c) => (c.seed = "abc"), /seed/);
    rej((c) => (c.seed = ""), /seed/);
    rej((c) => (c.seed = "1".repeat(101)), /seed/); // over-long → DoS bound
  });

  it("rejects a malformed nodes array", () => {
    rej((c) => (c.nodes = "a,b"), /nodes/); // not an array
    rej((c) => (c.nodes = []), /nodes/); // empty
    rej((c) => (c.nodes = new Array(257).fill("n")), /nodes/); // over count
    rej((c) => (c.nodes = ["a", 1]), /nodes/); // non-string element
    rej((c) => (c.nodes = ["a", ""]), /nodes/); // empty-string element
    rej((c) => (c.nodes = ["a", "x".repeat(65)]), /nodes/); // over-length id
  });

  it("rejects an out-of-range maxSteps (the scheduler corruption path, B2)", () => {
    rej((c) => (c.maxSteps = 1.5), /maxSteps/); // non-integer
    rej((c) => (c.maxSteps = 0), /maxSteps/);
    rej((c) => (c.maxSteps = -1), /maxSteps/);
    rej((c) => (c.maxSteps = 10_000_001), /maxSteps/); // over MAX_STEPS
    rej((c) => (c.maxSteps = NaN), /maxSteps/);
    rej((c) => (c.maxSteps = Infinity), /maxSteps/);
    rej((c) => delete c.maxSteps, /maxSteps/);
  });

  it("rejects a malformed network config (NaN latency → nondeterminism, B2)", () => {
    rej((c) => delete asMap(c.config).network, /network/);
    rej((c) => (asMap(c.config).network = "x"), /network/);
    rej((c) => (asMap(asMap(c.config).network).minLatency = NaN), /minLatency/);
    rej((c) => (asMap(asMap(c.config).network).minLatency = -1), /minLatency/);
    rej((c) => (asMap(asMap(c.config).network).maxLatency = -5), /maxLatency/);
    rej(
      (c) => {
        const n = asMap(asMap(c.config).network);
        n.minLatency = 50; // max(10) < min
        n.maxLatency = 10;
      },
      /maxLatency/,
    );
    rej((c) => (asMap(asMap(c.config).network).dropProb = 1.5), /dropProb/);
    rej((c) => (asMap(asMap(c.config).network).dropProb = -0.1), /dropProb/);
    rej((c) => (asMap(asMap(c.config).network).dropProb = NaN), /dropProb/);
    rej((c) => (asMap(asMap(c.config).network).dupProb = 2), /dupProb/);
  });

  it("rejects a malformed chaos config (silent chaos-off path, B2)", () => {
    rej((c) => delete asMap(c.config).chaos, /chaos/);
    rej((c) => (asMap(c.config).chaos = "x"), /chaos/);
    rej((c) => (asMap(asMap(c.config).chaos).partitionProb = NaN), /chaos.partitionProb/);
    rej((c) => (asMap(asMap(c.config).chaos).partitionProb = 1.5), /chaos.partitionProb/);
    rej((c) => (asMap(asMap(c.config).chaos).maxPartitionMs = -1), /maxPartitionMs/);
    rej((c) => (asMap(asMap(c.config).chaos).maxPartitionMs = NaN), /maxPartitionMs/);
    rej((c) => (asMap(asMap(c.config).chaos).maxCrashFraction = 2), /maxCrashFraction/);
  });

  it("rejects a malformed invariant", () => {
    rej((c) => (c.invariant = "x"), /invariant/);
    rej((c) => (asMap(c.invariant).name = 1), /invariant.name/);
    rej((c) => delete asMap(c.invariant).name, /invariant.name/);
    rej((c) => (asMap(c.invariant).detail = 1), /invariant.detail/);
    rej((c) => (asMap(c.invariant).detail = "x".repeat(4097)), /invariant.detail/);
  });

  it("rejects a malformed trace", () => {
    rej((c) => delete c.trace, /trace/);
    rej((c) => (c.trace = "x"), /trace/);
    rej((c) => (asMap(c.trace).events = "x"), /events/);
    rej((c) => (asMap(c.trace).events = new Array(2_000_001)), /events/); // over MAX_EVENTS
  });

  it("rejects a chronosVersion over the length bound (memory DoS guard)", () => {
    rej((c) => (c.chronosVersion = "x".repeat(65)), /chronosVersion/); // > MAX_VERSION (64)
  });
});

describe("readCapsule — content-free errors (content disclosure)", () => {
  // Node's JSON.parse SyntaxError embeds the offending file bytes ("Unexpected
  // token 'r', \"root:x:0:0:…"). On `chronos replay /etc/passwd` that would
  // disclose the file's contents via the error string. readCapsule converts the
  // parse failure to a content-free InvalidCapsule.
  it("does NOT echo file contents on a non-JSON file", async () => {
    const dir = freshDir();
    const p = join(dir, "passwd.json");
    const secret = "root:x:0:0:root:/root:/bin/bash\nnobody:x:65534:65534::/:/usr/sbin/nologin\n";
    writeFileSync(p, secret);
    try {
      await readCapsule(p);
      throw new Error("expected readCapsule to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidCapsule);
      const msg = (e as Error).message;
      expect(msg).toBe("capsule is not valid JSON");
      // The raw file bytes must not appear anywhere in the message.
      expect(msg).not.toContain("root:x");
      expect(msg).not.toContain("nobody");
      expect(msg).not.toContain("/bin/bash");
    }
  });

  it("validates a well-formed capsule file and returns it", async () => {
    const dir = freshDir();
    const p = join(dir, "ok.json");
    writeFileSync(p, JSON.stringify(base()));
    const cap = await readCapsule(p);
    expect(cap.seed).toBe("42");
    expect(cap.nodes).toEqual(["a", "b"]);
  });
});

describe("writeCapsule — atomic writes (B3)", () => {
  it("writes atomically: exactly <seed>.json remains, no .tmp file", async () => {
    const dir = freshDir();
    const sim = buildSimulator({ seeds: 1, nodes: 3 }, 7n);
    const path = await writeCapsule(dir, 7n, sim, { name: "x", detail: "y" });
    expect(path).toBe(join(dir, "failures", "7.json"));
    expect(existsSync(path)).toBe(true);
    // A crash mid-write would leave a `.tmp`; on the happy path there is none.
    const files = readdirSync(join(dir, "failures"));
    expect(files).toEqual(["7.json"]);
    expect(files.some((f) => f.endsWith(".tmp"))).toBe(false);
  });

  it("produces a capsule readCapsule accepts (validator accepts the framework's own output)", async () => {
    const dir = freshDir();
    const sim = buildSimulator({ seeds: 1, nodes: 3 }, 11n);
    const path = await writeCapsule(dir, 11n, sim, { name: "inv", detail: "d" });
    const cap = await readCapsule(path); // readCapsule validates — must not throw
    expect(cap.seed).toBe("11");
    expect(cap.nodes).toHaveLength(3);
    expect(cap.maxSteps).toBe(sim.maxSteps);
  });

  it("an end-to-end failing run writes a capsule the validator accepts", async () => {
    const dir = freshDir();
    const violating: SimTestBody = (sim) => {
      // A safety invariant is checked after every scheduler step (onStepEnd),
      // so the body must schedule ≥1 event — else the queue drains with zero
      // steps and the never-false check is never evaluated.
      sim.addInvariant({ name: "never-true", kind: "safety", check: () => false });
      sim.nodes[1]!.env.setTimeout(() => {}, 1);
    };
    const out = await runSimTest({ seeds: [3n], nodes: 2, chronosDir: dir }, violating);
    expect(out.violated).toBe(true);
    expect(existsSync(out.capsulePath!)).toBe(true);
    const cap = await readCapsule(out.capsulePath!); // re-validate from disk
    expect(cap.seed).toBe("3");
    expect(cap.invariant.name).toBe("never-true");
  });
});

describe("resolveSeeds — CHRONOS_SEED input validation (A1)", () => {
  it("rejects a non-decimal CHRONOS_SEED up front (not deep in BigInt())", () => {
    const prev = process.env.CHRONOS_SEED;
    try {
      for (const bad of ["0x10", "1.5", "abc", "0b1", "1e3"]) {
        process.env.CHRONOS_SEED = bad;
        expect(() => resolveSeeds({ seeds: 1, nodes: 2 })).toThrow(/decimal integer/);
      }
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_SEED;
      else process.env.CHRONOS_SEED = prev;
    }
  });

  it("accepts a negative decimal CHRONOS_SEED", () => {
    const prev = process.env.CHRONOS_SEED;
    try {
      process.env.CHRONOS_SEED = "-5";
      expect(resolveSeeds({ seeds: 1, nodes: 2 })).toEqual([-5n]);
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_SEED;
      else process.env.CHRONOS_SEED = prev;
    }
  });

  it("treats an empty CHRONOS_SEED as unset (no override)", () => {
    const prev = process.env.CHRONOS_SEED;
    try {
      process.env.CHRONOS_SEED = "";
      expect(resolveSeeds({ seeds: 3, nodes: 2 })).toEqual([0n, 1n, 2n]);
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_SEED;
      else process.env.CHRONOS_SEED = prev;
    }
  });
});

describe("CHRONOS_STRICT wiring in executeScenario (A1)", () => {
  it("throw: a forgotten Date.now() in the body rejects the run loudly", async () => {
    const prev = process.env.CHRONOS_STRICT;
    try {
      process.env.CHRONOS_STRICT = "throw";
      const body: SimTestBody = () => {
        void Date.now(); // forgot the DI contract → StrictModeViolation
      };
      await expect(
        runSimTest({ seeds: 1, nodes: 2, chronosDir: freshDir() }, body),
      ).rejects.toBeInstanceOf(StrictModeViolation);
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_STRICT;
      else process.env.CHRONOS_STRICT = prev;
    }
  });

  it("off: a forgotten Date.now() is left untouched (no throw, no violation)", async () => {
    const prev = process.env.CHRONOS_STRICT;
    try {
      process.env.CHRONOS_STRICT = "off";
      let called = 0;
      const body: SimTestBody = () => {
        called++;
        void Date.now(); // real wall clock — fine in the harness, not a sim path
      };
      const out = await runSimTest({ seeds: 1, nodes: 2, chronosDir: freshDir() }, body);
      expect(out.violated).toBe(false);
      expect(called).toBe(1);
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_STRICT;
      else process.env.CHRONOS_STRICT = prev;
    }
  });

  it("route (default): a forgotten Date.now() is redirected to the sim clock (deterministic, no throw)", async () => {
    const prev = process.env.CHRONOS_STRICT;
    try {
      delete process.env.CHRONOS_STRICT; // default → route
      let saw: number | undefined;
      const body: SimTestBody = () => {
        saw = Date.now(); // routed to globalEnv(sim).clock.now() === 0 at body start
      };
      const out = await runSimTest({ seeds: 1, nodes: 2, chronosDir: freshDir() }, body);
      expect(out.violated).toBe(false);
      expect(saw).toBe(0);
      expect(Number.isFinite(saw)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_STRICT;
      else process.env.CHRONOS_STRICT = prev;
    }
  });

  it("guards are restored even when the body throws (no global leak)", async () => {
    const prev = process.env.CHRONOS_STRICT;
    const realRandom = Math.random;
    try {
      process.env.CHRONOS_STRICT = "throw";
      const body: SimTestBody = () => {
        void Math.random(); // throws StrictModeViolation → executeScenario re-throws in finally
      };
      await expect(
        runSimTest({ seeds: 1, nodes: 2, chronosDir: freshDir() }, body),
      ).rejects.toBeInstanceOf(StrictModeViolation);
      // After the run rejected, the globals are whole again (restore() ran in finally).
      expect(Math.random).toBe(realRandom);
      expect(() => Math.random()).not.toThrow();
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_STRICT;
      else process.env.CHRONOS_STRICT = prev;
    }
  });
});
