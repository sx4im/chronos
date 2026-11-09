// Failure capsule I/O (§3.18). Capsules are shared, untrusted JSON inputs:
// validate size, keys, and schema before any field reaches the Simulator or renderers.

import { mkdir, writeFile, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, join, basename } from "node:path";
import { CHRONOS_VERSION } from "@sx4im/chronos-core";
import type { Simulator, NetworkConfig, ChaosConfig, Trace } from "@sx4im/chronos-core";
import type { FailureCapsule } from "./types.js";

export interface CapsuleWriteResult {
  path: string;
}

/** Content-free validation error (never echoes raw file bytes). */
export class InvalidCapsule extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCapsule";
  }
}

function fail(message: string): never {
  throw new InvalidCapsule(message);
}
const isFiniteNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isFiniteInt = (x: unknown): x is number => typeof x === "number" && Number.isInteger(x);
const isBoundedString = (x: unknown, max: number): x is string =>
  typeof x === "string" && x.length <= max;
const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

const RE_SEED = /^-?\d{1,100}$/;
const MAX_NODES = 256;
const MAX_NODE_ID = 64;
const MAX_NAME = 256;
const MAX_DETAIL = 4096;
const MAX_VERSION = 64;
const MAX_STEPS = 10_000_000;
const MAX_EVENTS = 2_000_000;
const MAX_SUMMARY = 4096;
const DEFAULT_MAX_CAPSULE_BYTES = 128 * 1024 * 1024;

function maxCapsuleBytes(): number {
  const raw = process.env.CHRONOS_MAX_CAPSULE_BYTES;
  if (raw === undefined || !/^\d{1,19}$/.test(raw)) return DEFAULT_MAX_CAPSULE_BYTES;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : DEFAULT_MAX_CAPSULE_BYTES;
}

function inUnitInterval(x: unknown, label: string): void {
  if (!isFiniteNum(x) || x < 0 || x > 1) {
    fail(`\`config.${label}\` must be a finite number in [0, 1]`);
  }
}

function validateNetwork(n: unknown): asserts n is NetworkConfig {
  if (!isRecord(n)) fail("`config.network` is not an object");
  if (!isFiniteNum(n.minLatency)) fail("`config.network.minLatency` is not a finite number");
  if (!isFiniteNum(n.maxLatency)) fail("`config.network.maxLatency` is not a finite number");
  if (n.minLatency < 0) fail("`config.network.minLatency` must be >= 0");
  if (n.maxLatency < n.minLatency) fail("`config.network.maxLatency` must be >= minLatency");
  inUnitInterval(n.dropProb, "network.dropProb");
  inUnitInterval(n.dupProb, "network.dupProb");
}

function validateChaos(c: unknown): asserts c is Required<ChaosConfig> {
  if (!isRecord(c)) fail("`config.chaos` is not an object");
  inUnitInterval(c.partitionProb, "chaos.partitionProb");
  inUnitInterval(c.crashProb, "chaos.crashProb");
  inUnitInterval(c.restartProb, "chaos.restartProb");
  if (!isFiniteNum(c.maxPartitionMs) || c.maxPartitionMs < 0) {
    fail("`config.chaos.maxPartitionMs` must be a finite number >= 0");
  }
  inUnitInterval(c.maxCrashFraction, "chaos.maxCrashFraction");
}

function validateEvent(e: unknown, i: number): void {
  const at = `\`trace.events[${i}]\``;
  if (!isRecord(e)) fail(`${at} is not an object`);
  if (!isFiniteNum(e.t)) fail(`${at}.t must be a finite number`);
  if (!isFiniteInt(e.seq)) fail(`${at}.seq must be an integer`);

  switch (e.kind) {
    case "timer":
      if (e.nodeId !== undefined && !isBoundedString(e.nodeId, MAX_NODE_ID)) {
        fail(`${at}.nodeId must be a string (max ${MAX_NODE_ID} chars) when present`);
      }
      return;
    case "wake":
    case "crash":
    case "restart":
      if (!isBoundedString(e.nodeId, MAX_NODE_ID)) {
        fail(`${at}.nodeId must be a string (max ${MAX_NODE_ID} chars) for kind "${e.kind}"`);
      }
      return;
    case "send":
    case "deliver":
      if (!isBoundedString(e.from, MAX_NODE_ID) || !isBoundedString(e.to, MAX_NODE_ID)) {
        fail(`${at}.from/.to must be strings (max ${MAX_NODE_ID} chars) for kind "${e.kind}"`);
      }
      if (!isBoundedString(e.summary, MAX_SUMMARY)) {
        fail(`${at}.summary must be a string (max ${MAX_SUMMARY} chars) for kind "${e.kind}"`);
      }
      return;
    case "partition": {
      if (!Array.isArray(e.groups) || e.groups.length > MAX_NODES) {
        fail(`${at}.groups must be an array of at most ${MAX_NODES} groups`);
      }
      for (const g of e.groups as unknown[]) {
        if (!Array.isArray(g) || g.length > MAX_NODES) {
          fail(`${at}.groups entries must be arrays of at most ${MAX_NODES} node ids`);
        }
        for (const n of g as unknown[]) {
          if (!isBoundedString(n, MAX_NODE_ID)) {
            fail(`${at}.groups node ids must be strings (max ${MAX_NODE_ID} chars)`);
          }
        }
      }
      if (!isFiniteNum(e.healAt)) fail(`${at}.healAt must be a finite number`);
      return;
    }
    case "invariant-violation":
      if (!isBoundedString(e.name, MAX_NAME)) fail(`${at}.name must be a string (max ${MAX_NAME} chars)`);
      if (!isBoundedString(e.detail, MAX_DETAIL)) {
        fail(`${at}.detail must be a string (max ${MAX_DETAIL} chars)`);
      }
      return;
    default:
      fail(`${at}.kind is not a known trace event kind`);
  }
}

function validateTrace(t: unknown): void {
  if (!isRecord(t)) fail("`trace` is not an object");
  if (typeof t.seed !== "string" || !RE_SEED.test(t.seed)) {
    fail("`trace.seed` must be a decimal integer string");
  }
  if (!Array.isArray(t.nodes) || t.nodes.length > MAX_NODES) {
    fail(`\`trace.nodes\` must be an array of at most ${MAX_NODES} strings`);
  }
  for (let i = 0; i < t.nodes.length; i++) {
    if (!isBoundedString(t.nodes[i], MAX_NODE_ID)) {
      fail(`\`trace.nodes[${i}]\` must be a string (max ${MAX_NODE_ID} chars)`);
    }
  }
  if (t.result !== "ok" && t.result !== "violation" && t.result !== "timeout") {
    fail('`trace.result` must be "ok", "violation", or "timeout"');
  }
  if (!Array.isArray(t.events) || t.events.length > MAX_EVENTS) {
    fail(`\`trace.events\` must be an array (max ${MAX_EVENTS} entries)`);
  }
  for (let i = 0; i < t.events.length; i++) validateEvent(t.events[i], i);
}

export function validateCapsule(obj: unknown): FailureCapsule {
  if (!isRecord(obj)) fail("capsule root is not a JSON object");
  const seed = obj.seed;
  if (typeof seed !== "string" || !RE_SEED.test(seed)) {
    fail("`seed` must be a decimal integer string");
  }
  const nodes = obj.nodes;
  if (!Array.isArray(nodes) || nodes.length < 1 || nodes.length > MAX_NODES) {
    fail(`\`nodes\` must be an array of 1..${MAX_NODES} strings`);
  }
  for (let i = 0; i < nodes.length; i++) {
    const id = nodes[i];
    if (typeof id !== "string" || id.length < 1 || id.length > MAX_NODE_ID) {
      fail(`\`nodes[${i}]\` must be a non-empty string (max ${MAX_NODE_ID} chars)`);
    }
  }
  const maxSteps = obj.maxSteps;
  if (!isFiniteInt(maxSteps) || maxSteps < 1 || maxSteps > MAX_STEPS) {
    fail(`\`maxSteps\` must be an integer in [1, ${MAX_STEPS}]`);
  }
  if (!isRecord(obj.config)) fail("`config` is not an object");
  validateNetwork(obj.config.network);
  validateChaos(obj.config.chaos);

  if (!isRecord(obj.invariant)) fail("`invariant` is not an object");
  if (!isBoundedString(obj.invariant.name, MAX_NAME)) {
    fail(`\`invariant.name\` must be a string (max ${MAX_NAME} chars)`);
  }
  if (!isBoundedString(obj.invariant.detail, MAX_DETAIL)) {
    fail(`\`invariant.detail\` must be a string (max ${MAX_DETAIL} chars)`);
  }

  validateTrace(obj.trace);

  if (typeof obj.chronosVersion === "string" && obj.chronosVersion.length > MAX_VERSION) {
    fail(`\`chronosVersion\` length must be <= ${MAX_VERSION}`);
  }
  return {
    chronosVersion: typeof obj.chronosVersion === "string" ? obj.chronosVersion : "",
    seed,
    nodes: nodes as string[],
    config: obj.config as { network: NetworkConfig; chaos: Required<ChaosConfig> },
    maxSteps,
    invariant: obj.invariant as { name: string; detail: string },
    trace: obj.trace as Trace,
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

/** Write a capsule atomically via an exclusive (`wx`, 0600) same-directory temp file + rename. */
export async function writeCapsuleTo(path: string, capsule: FailureCapsule): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  const gitignoreTarget = basename(dir) === "failures" ? dirname(dir) : dir;
  const gitignorePath = join(gitignoreTarget, ".gitignore");
  await writeFile(gitignorePath, "*\n", { flag: "wx" }).catch(() => {});
  const json = JSON.stringify(capsule, null, 2);
  const tmp = `${path}.${process.pid}.${nextTmpSuffix()}.tmp`;
  await writeFile(tmp, json, { encoding: "utf8", flag: "wx", mode: 0o600 });
  try {
    await rename(tmp, path);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

let tmpCounter = 0;
function nextTmpSuffix(): string {
  tmpCounter = (tmpCounter + 1) >>> 0;
  return tmpCounter.toString(36);
}

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

export async function readCapsule(path: string): Promise<FailureCapsule> {
  const limit = maxCapsuleBytes();
  const info = await stat(path);
  if (info.size > limit) {
    throw new InvalidCapsule(
      `capsule file is larger than the ${limit}-byte limit (set CHRONOS_MAX_CAPSULE_BYTES to raise it)`,
    );
  }
  const data = await readFile(path, "utf8");
  let obj: unknown;
  try {
    obj = JSON.parse(data, reviveSafely);
  } catch (e) {
    if (e instanceof InvalidCapsule) throw e;
    throw new InvalidCapsule("capsule is not valid JSON");
  }
  return validateCapsule(obj);
}

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function reviveSafely(this: unknown, key: string, value: unknown): unknown {
  if (FORBIDDEN_KEYS.has(key)) {
    throw new InvalidCapsule(`capsule contains a forbidden \`${key}\` key`);
  }
  return value;
}
