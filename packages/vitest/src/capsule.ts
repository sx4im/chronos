// Failure capsule I/O (§3.18) — the {seed, config} minimum + the Trace.
//
// A capsule is plain JSON so it can be saved, shared, and `chronos replay`ed:
// rebuilding a Simulator from the same seed+config+nodes and re-running the
// body reproduces the violation — and the trace — bit-for-bit.
//
// A capsule is a *shared artifact* (CI artifact, attachment in an issue, a file
// handed to a teammate) and therefore UNTRUSTED input. `readCapsule` parses it
// and runs it through `validateCapsule` before anything touches the Simulator:
// a malformed capsule must produce a clear `InvalidCapsule` error, never a
// confusing NaN/Infinity/negative-value that silently corrupts the scheduler or
// disables chaos (see Area 2 / B2 of the security audit). In particular the
// JSON.parse failure is converted to a content-free error — Node's SyntaxError
// embeds the offending file bytes, which on `chronos replay <arbitrary-file>`
// would disclose that file's contents via the error string.

import { mkdir, writeFile, readFile, rename } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { CHRONOS_VERSION } from "@sx4im/chronos-core";
import type { Simulator, NetworkConfig, ChaosConfig, Trace } from "@sx4im/chronos-core";
import type { FailureCapsule } from "./types.js";

export interface CapsuleWriteResult {
  path: string;
}

/** Raised by `readCapsule`/`validateCapsule` when a capsule is malformed. The
 *  message is deliberately content-free (never echoes capsule bytes) so it is
 *  safe to print on an untrusted path. */
export class InvalidCapsule extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCapsule";
  }
}

function fail(message: string): never {
  throw new InvalidCapsule(message);
}

function isFiniteNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

function isFiniteInt(x: unknown): x is number {
  return typeof x === "number" && Number.isInteger(x) && Number.isFinite(x);
}

// Decimal integer, optional leading minus, up to 100 digits — bounds the BigInt
// allocation so a giant `seed` string can't be used as a trivial DoS. Matches
// exactly what `BigInt(str)` accepts on the happy path (no hex, no whitespace).
const RE_SEED = /^-?\d{1,100}$/;

const MAX_NODES = 256; // an array of any more is an obvious malformed/crafted capsule
const MAX_NODE_ID = 64;
const MAX_NAME = 256;
const MAX_DETAIL = 4096;
const MAX_VERSION = 64; // chronosVersion field — bound it so a malformed capsule
// can't ship a multi-GB string as a trivial memory DoS.
const MAX_STEPS = 10_000_000; // matches the engine's safe upper bound
const MAX_EVENTS = 2_000_000; // bounds the parse; the replay cap is maxSteps anyway

function inUnitInterval(x: unknown, label: string): void {
  if (!isFiniteNum(x) || (x as number) < 0 || (x as number) > 1) {
    fail(`\`config.${label}\` must be a finite number in [0, 1]`);
  }
}

function validateNetwork(n: unknown): asserts n is NetworkConfig {
  if (typeof n !== "object" || n === null || Array.isArray(n)) {
    fail("`config.network` is not an object");
  }
  const cfg = n as Record<string, unknown>;
  if (!isFiniteNum(cfg.minLatency)) fail("`config.network.minLatency` is not a finite number");
  if (!isFiniteNum(cfg.maxLatency)) fail("`config.network.maxLatency` is not a finite number");
  if ((cfg.minLatency as number) < 0) fail("`config.network.minLatency` must be >= 0");
  if ((cfg.maxLatency as number) < (cfg.minLatency as number)) {
    fail("`config.network.maxLatency` must be >= minLatency");
  }
  inUnitInterval(cfg.dropProb, "network.dropProb");
  inUnitInterval(cfg.dupProb, "network.dupProb");
}

function validateChaos(c: unknown): asserts c is Required<ChaosConfig> {
  if (typeof c !== "object" || c === null || Array.isArray(c)) {
    fail("`config.chaos` is not an object");
  }
  const o = c as Record<string, unknown>;
  inUnitInterval(o.partitionProb, "chaos.partitionProb");
  inUnitInterval(o.crashProb, "chaos.crashProb");
  inUnitInterval(o.restartProb, "chaos.restartProb");
  if (!isFiniteNum(o.maxPartitionMs) || (o.maxPartitionMs as number) < 0) {
    fail("`config.chaos.maxPartitionMs` must be a finite number >= 0");
  }
  inUnitInterval(o.maxCrashFraction, "chaos.maxCrashFraction");
}

/** Strictly validate an already-parsed capsule object. Returns the object typed
 *  as a `FailureCapsule`; throws `InvalidCapsule` (content-free message) on any
 *  shape/range violation. The fields the Simulator reads (`seed`, `nodes`,
 *  `maxSteps`, `config.network`, `config.chaos`) are the load-bearing checks:
 *  a NaN/Infinity/negative there is the scheduler-corruption / silent-chaos-off
 *  path (B2). `trace.events` is bounded but not deeply validated — entries there
 *  are never re-scheduled (they're compared for reproduction only), so they
 *  cannot poison the run. */
export function validateCapsule(obj: unknown): FailureCapsule {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    fail("capsule root is not a JSON object");
  }
  const c = obj as Record<string, unknown>;

  const seed = c.seed;
  if (typeof seed !== "string" || !RE_SEED.test(seed)) {
    fail("`seed` must be a decimal integer string");
  }

  const nodes = c.nodes;
  if (!Array.isArray(nodes) || nodes.length < 1 || nodes.length > MAX_NODES) {
    fail(`\`nodes\` must be an array of 1..${MAX_NODES} strings`);
  }
  for (let i = 0; i < nodes.length; i++) {
    const id = nodes[i];
    if (typeof id !== "string" || id.length < 1 || id.length > MAX_NODE_ID) {
      fail(`\`nodes[${i}]\` must be a non-empty string (max ${MAX_NODE_ID} chars)`);
    }
  }

  const maxSteps = c.maxSteps;
  if (!isFiniteInt(maxSteps) || maxSteps < 1 || maxSteps > MAX_STEPS) {
    fail(`\`maxSteps\` must be an integer in [1, ${MAX_STEPS}]`);
  }

  const config = c.config;
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    fail("`config` is not an object");
  }
  const configRec = config as Record<string, unknown>;
  validateNetwork(configRec.network);
  validateChaos(configRec.chaos);

  const invariant = c.invariant;
  if (typeof invariant !== "object" || invariant === null || Array.isArray(invariant)) {
    fail("`invariant` is not an object");
  }
  const invRec = invariant as Record<string, unknown>;
  if (typeof invRec.name !== "string" || invRec.name.length > MAX_NAME) {
    fail(`\`invariant.name\` must be a string (max ${MAX_NAME} chars)`);
  }
  if (typeof invRec.detail !== "string" || invRec.detail.length > MAX_DETAIL) {
    fail(`\`invariant.detail\` must be a string (max ${MAX_DETAIL} chars)`);
  }

  const trace = c.trace;
  if (typeof trace !== "object" || trace === null || Array.isArray(trace)) {
    fail("`trace` is not an object");
  }
  const traceRec = trace as Record<string, unknown>;
  if (!Array.isArray(traceRec.events) || traceRec.events.length > MAX_EVENTS) {
    fail(`\`trace.events\` must be an array (max ${MAX_EVENTS} entries)`);
  }

  // After validation the object satisfies the FailureCapsule shape; the
  // chronosVersion is optional (older capsules omitted it) and defaulted here.
  if (typeof c.chronosVersion === "string" && c.chronosVersion.length > MAX_VERSION) {
    fail(`\`chronosVersion\` length must be <= ${MAX_VERSION}`);
  }
  return {
    chronosVersion: typeof c.chronosVersion === "string" ? c.chronosVersion : "",
    seed,
    nodes: nodes as string[],
    config: config as { network: NetworkConfig; chaos: Required<ChaosConfig> },
    maxSteps,
    invariant: invRec as { name: string; detail: string },
    trace: trace as Trace,
  };
}

/** Build the in-memory capsule object from a violating Simulator. */
export function buildCapsule(
  seed: bigint,
  sim: Simulator,
  violation: { name: string; detail: string },
): FailureCapsule {
  const config = {
    network: sim.networkConfig,
    chaos: sim.chaosConfig,
  };
  const nodes = sim.nodes.map((n) => n.id);
  return {
    chronosVersion: CHRONOS_VERSION,
    seed: String(seed),
    nodes,
    config,
    maxSteps: sim.maxSteps,
    invariant: violation,
    trace: sim.trace.toTrace(String(seed), config, nodes, "violation"),
  };
}

/** Write a built capsule object to an explicit absolute path, ATOMICALLY: a
 *  per-process temp file in the SAME directory, then `rename` into place. A
 *  crash mid-write never leaves a half-written capsule — the reproduction
 *  artifact the framework exists to preserve stays intact. (The prime directive
 *  bans entropy *inside* simulations; this is the harness, so `process.pid` in
 *  the temp name is fine — it never enters the capsule or the trace.) The temp
 *  file is created in the destination directory so the `rename` never crosses a
 *  filesystem boundary (which would make it non-atomic on some platforms).
 *
 *  Used by `writeCapsule` (the `<dir>/failures/<seed>.json` layout) and by the
 *  shrinker (`shrinkCapsule`), which writes a `<seed>.shrunk.json` sibling next
 *  to an existing capsule — never overwriting the original. */
export async function writeCapsuleTo(path: string, capsule: FailureCapsule): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const gitignoreTarget = basename(dir) === "failures" ? dirname(dir) : dir;
  const gitignorePath = join(gitignoreTarget, ".gitignore");
  await writeFile(gitignorePath, "*\n", { flag: "wx" }).catch(() => {
    /* ignore if .gitignore already exists */
  });
  const json = JSON.stringify(capsule, null, 2);
  // Same directory as the final file → same filesystem → `rename` is atomic.
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, json, "utf8");
  await rename(tmp, path);
}

/** Write a capsule to `<dir>/failures/<seed>.json` and return its path.
 *  ATOMIC: delegates to `writeCapsuleTo` (same-directory temp + rename) so a
 *  crash mid-write never leaves a half-written capsule. */
export async function writeCapsule(
  dir: string,
  seed: bigint,
  sim: Simulator,
  violation: { name: string; detail: string },
): Promise<string> {
  const path = join(dir, "failures", `${seed}.json`);
  await writeCapsuleTo(path, buildCapsule(seed, sim, violation));
  return path;
}

/** Load and strictly validate a capsule from disk. Any malformed capsule (or a
 *  non-JSON file handed in by mistake) raises `InvalidCapsule` with a
 *  content-free message — never the raw `JSON.parse` SyntaxError, which embeds
 *  file bytes and would disclose e.g. `/etc/passwd` on a misdirected path. */
export async function readCapsule(path: string): Promise<FailureCapsule> {
  const data = await readFile(path, "utf8");
  let obj: unknown;
  try {
    obj = JSON.parse(data);
  } catch {
    throw new InvalidCapsule("capsule is not valid JSON");
  }
  return validateCapsule(obj);
}
