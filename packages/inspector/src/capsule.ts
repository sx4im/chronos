// Pure capsule parsing and trace derivations for the Inspector views.

import type { Trace, TraceEvent } from "@sx4im/chronos-core";
import type { Capsule } from "./types.js";

export interface ParsedCapsule {
  seed: string;
  nodes: string[];
  invariant: { name: string; detail: string };
  trace: Trace;
  totalEvents: number;
  droppedEvents: number;
  truncatedEvents: number;
}

/** Accept only a genuine same-origin path (`/` prefix, no WHATWG authority/control bypass). */
export function isSameOriginCapsuleUrl(u: string): boolean {
  if (!u.startsWith("/") || u.startsWith("//") || /[\\\s\x00-\x1f\x7f]/.test(u)) {
    return false;
  }
  try {
    const parsed = new URL(u, "http://localhost");
    return parsed.origin === "http://localhost" && parsed.pathname.startsWith("/");
  } catch {
    return false;
  }
}

export function capsuleParamError(u: string): string {
  return `capsule URL must be a same-origin path (got ${JSON.stringify(u).slice(0, 80)})`;
}

const MAX_EVENTS = 2_000_000;
export const MAX_RENDERED_EVENTS = 50_000;
const MAX_NODES = 256;
export const MAX_RENDERED_SPAN = 10_000_000;
const MAX_STR = 4096;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isStr(x: unknown, max = MAX_STR): x is string {
  return typeof x === "string" && x.length <= max;
}

function reviveSafely(this: unknown, key: string, value: unknown): unknown {
  if (FORBIDDEN_KEYS.has(key)) {
    throw new Error(`capsule contains a forbidden \`${key}\` key`);
  }
  return value;
}

function isValidEvent(e: unknown): e is TraceEvent {
  if (typeof e !== "object" || e === null || Array.isArray(e)) return false;
  const ev = e as Record<string, unknown>;
  if (typeof ev.t !== "number" || !Number.isFinite(ev.t)) return false;
  if (typeof ev.seq !== "number" || !Number.isInteger(ev.seq)) return false;
  switch (ev.kind) {
    case "timer":
      return ev.nodeId === undefined || isStr(ev.nodeId, 64);
    case "wake":
    case "crash":
    case "restart":
      return isStr(ev.nodeId, 64);
    case "send":
    case "deliver":
      return isStr(ev.from, 64) && isStr(ev.to, 64) && isStr(ev.summary);
    case "partition":
      return (
        Array.isArray(ev.groups) &&
        ev.groups.length <= MAX_NODES &&
        ev.groups.every(
          (g) => Array.isArray(g) && g.length <= MAX_NODES && g.every((n) => isStr(n, 64)),
        ) &&
        typeof ev.healAt === "number" &&
        Number.isFinite(ev.healAt)
      );
    case "invariant-violation":
      return isStr(ev.name, 256) && isStr(ev.detail);
    default:
      return false;
  }
}

export function parseCapsule(json: string): ParsedCapsule {
  let obj: unknown;
  try {
    obj = JSON.parse(json, reviveSafely);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("capsule contains a forbidden")) {
      throw e;
    }
    throw new Error("not valid JSON");
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new Error("capsule root is not an object");
  }
  const c = obj as Partial<Capsule>;
  const trace = c.trace;
  if (!trace || !Array.isArray(trace.events) || !Array.isArray(trace.nodes)) {
    throw new Error("capsule is missing a valid `trace` (expected { events: [], nodes: [] })");
  }
  if (trace.events.length > MAX_EVENTS) {
    throw new Error(`capsule \`trace.events\` exceeds the maximum of ${MAX_EVENTS} entries`);
  }
  if (typeof trace.seed !== "string") {
    throw new Error("capsule `trace.seed` is missing");
  }
  const invariant = c.invariant ?? { name: "unknown", detail: "" };
  if (typeof invariant.name !== "string" || typeof invariant.detail !== "string") {
    throw new Error("capsule `invariant` must be { name, detail }");
  }
  const rawNodes = trace.nodes.length > 0 ? trace.nodes : Array.isArray(c.nodes) ? c.nodes : [];
  const nodes = rawNodes.filter((n): n is string => isStr(n, 64)).slice(0, MAX_NODES);

  const valid = trace.events.filter(isValidEvent);
  const dropped = trace.events.length - valid.length;
  const truncated = Math.max(0, valid.length - MAX_RENDERED_EVENTS);
  const events = truncated > 0 ? valid.slice(0, MAX_RENDERED_EVENTS) : valid;
  const result: Trace["result"] =
    trace.result === "ok" || trace.result === "timeout" ? trace.result : "violation";

  return {
    seed: trace.seed,
    nodes,
    invariant: { name: invariant.name, detail: invariant.detail },
    trace: { seed: trace.seed, config: trace.config, nodes, events, result },
    totalEvents: trace.events.length,
    droppedEvents: dropped,
    truncatedEvents: truncated,
  };
}

export type SendEvent = Extract<TraceEvent, { kind: "send" }>;
export type DeliverEvent = Extract<TraceEvent, { kind: "deliver" }>;

export interface MessageFlow {
  id: number;
  send: SendEvent;
  delivers: DeliverEvent[];
  status: "delivered" | "dropped" | "duplicated";
}

const DROP_PREFIX = "dropped ";
const PARTITION_DROP_PREFIX = "dropped by partition ";
const flowKey = (from: string, to: string, summary: string) => `${from} ${to} ${summary}`;

export function pairMessages(events: TraceEvent[]): MessageFlow[] {
  const flows: MessageFlow[] = [];
  // Two FIFO queues per key: `unmatched` (0 delivers) and `once` (1 deliver), for O(1) pairing.
  const unmatched = new Map<string, MessageFlow[]>();
  const once = new Map<string, MessageFlow[]>();
  let nextId = 0;

  for (const ev of events) {
    if (ev.kind === "send") {
      const flow: MessageFlow = {
        id: nextId++,
        send: ev,
        delivers: [],
        status: "delivered",
      };
      flows.push(flow);
      if (ev.summary.startsWith(DROP_PREFIX)) {
        flow.status = "dropped";
        continue;
      }
      const key = flowKey(ev.from, ev.to, ev.summary);
      const q = unmatched.get(key) ?? [];
      q.push(flow);
      unmatched.set(key, q);
    } else if (ev.kind === "deliver") {
      if (ev.summary.startsWith(PARTITION_DROP_PREFIX)) {
        const origSummary = ev.summary.slice(PARTITION_DROP_PREFIX.length);
        const key = flowKey(ev.from, ev.to, origSummary);
        const q = unmatched.get(key);
        if (q && q.length > 0) q.shift();
        continue;
      }
      const key = flowKey(ev.from, ev.to, ev.summary);
      const q0 = unmatched.get(key);
      if (q0 && q0.length > 0) {
        const target = q0.shift()!;
        target.delivers.push(ev);
        const q1 = once.get(key) ?? [];
        q1.push(target);
        once.set(key, q1);
      } else {
        const q1 = once.get(key);
        if (q1 && q1.length > 0) {
          const target = q1.shift()!;
          target.delivers.push(ev);
        }
      }
    }
  }

  for (const f of flows) {
    if (f.delivers.length === 0) f.status = "dropped";
    else if (f.delivers.length >= 2) f.status = "duplicated";
    else f.status = "delivered";
  }
  return flows;
}

export function eventKindCounts(events: TraceEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ev of events) {
    counts.set(ev.kind, (counts.get(ev.kind) ?? 0) + 1);
  }
  return counts;
}

export function timeBounds(events: TraceEvent[]): {
  tMin: number;
  tMax: number;
} {
  if (events.length === 0) return { tMin: 0, tMax: 0 };
  let tMin = events[0]!.t;
  let tMax = events[0]!.t;
  for (const ev of events) {
    if (ev.t < tMin) tMin = ev.t;
    if (ev.t > tMax) tMax = ev.t;
  }
  return { tMin, tMax };
}

export function findViolation(events: TraceEvent[]): TraceEvent | undefined {
  return events.find((e) => e.kind === "invariant-violation");
}

export function eventsBeforeViolation(events: TraceEvent[], window = 5): TraceEvent[] {
  const i = events.findIndex((e) => e.kind === "invariant-violation");
  if (i === -1) return [];
  return events.slice(Math.max(0, i - window), i);
}

export function highlightSeqs(events: TraceEvent[], window = 5): Set<number> {
  const set = new Set<number>();
  const v = findViolation(events);
  if (!v) return set;
  set.add(v.seq);
  for (const e of eventsBeforeViolation(events, window)) set.add(e.seq);
  return set;
}

export type PartitionEvent = Extract<TraceEvent, { kind: "partition" }>;

export interface PartitionSpan {
  event: PartitionEvent;
  start: number;
  end: number;
}

export function partitionSpans(events: TraceEvent[]): PartitionSpan[] {
  const spans: PartitionSpan[] = [];
  for (const ev of events) {
    if (ev.kind === "partition") {
      spans.push({ event: ev, start: ev.t, end: Math.max(ev.t, ev.healAt) });
    }
  }
  return spans;
}

export function describeEvent(ev: TraceEvent): string {
  switch (ev.kind) {
    case "timer":
      return ev.nodeId ? `timer scheduled @ node ${ev.nodeId}` : "timer scheduled";
    case "wake":
      return `timer fired @ node ${ev.nodeId}`;
    case "send":
      return `${ev.from} → ${ev.to}  ${ev.summary}`;
    case "deliver":
      return `delivered ${ev.from} → ${ev.to}  ${ev.summary}`;
    case "crash":
      return `node ${ev.nodeId} crashed`;
    case "restart":
      return `node ${ev.nodeId} restarted`;
    case "partition":
      return `partition ${ev.groups.map((g) => `[${g.join(",")}]`).join(" | ")} until t=${ev.healAt}`;
    case "invariant-violation":
      return `VIOLATION — ${ev.name}: ${ev.detail}`;
    default:
      return `${String((ev as { kind: string }).kind)}: ${JSON.stringify(ev)}`;
  }
}
