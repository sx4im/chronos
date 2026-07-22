// Pure-logic tests for the inspector's deterministic-data helpers (Phase 4).
// These run under the repo Vitest config (no DOM, no react) — they pin the
// pairing/highlight logic the React views render so a JSX refactor can't
// silently change what "dropped" vs "duplicated" means.

import { describe, it, expect } from "vitest";
import type { TraceEvent, Trace } from "@sx4im/chronos-core";
import {
  parseCapsule,
  pairMessages,
  eventKindCounts,
  timeBounds,
  findViolation,
  eventsBeforeViolation,
  highlightSeqs,
  partitionSpans,
  describeEvent,
  isSameOriginCapsuleUrl,
  capsuleParamError,
} from "../src/capsule.js";

function ev(e: TraceEvent): TraceEvent {
  return e;
}

const aTrace: Trace = {
  seed: "42",
  config: {},
  nodes: ["0", "1", "2"],
  events: [],
  result: "ok",
};

function capsuleWith(
  events: TraceEvent[],
  invariant = { name: "all counts equal", detail: "n0=2 n1=3" }
): string {
  return JSON.stringify({
    chronosVersion: "0.0.0",
    seed: "42",
    nodes: ["0", "1", "2"],
    config: {},
    maxSteps: 10_000,
    invariant,
    trace: { ...aTrace, events, result: "violation" },
  });
}

describe("parseCapsule", () => {
  it("parses a valid capsule and prefers the trace's node list", () => {
    const parsed = parseCapsule(capsuleWith([]));
    expect(parsed.seed).toBe("42");
    expect(parsed.nodes).toEqual(["0", "1", "2"]);
    expect(parsed.invariant.name).toBe("all counts equal");
    expect(parsed.trace.events).toEqual([]);
  });

  it("throws on non-JSON", () => {
    expect(() => parseCapsule("not json")).toThrow("not valid JSON");
  });

  it("throws when the trace is missing", () => {
    expect(() =>
      parseCapsule(JSON.stringify({ seed: "1", nodes: [] }))
    ).toThrow("trace");
  });

  it("throws when invariant is malformed", () => {
    expect(() =>
      parseCapsule(JSON.stringify({ invariant: { name: 1 }, trace: aTrace }))
    ).toThrow("invariant");
  });

  it("rejects a trace with more events than the browser-safe bound", () => {
    // A sparse array of 2M+1 entries JSON-stringifies to nulls; we only need
    // the length check to fire, so build the JSON string directly.
    const eventsJson = `[${"null,".repeat(2_000_000)}null]`;
    const json =
      `{"seed":"1","nodes":["0"],"invariant":{"name":"x","detail":""},` +
      `"trace":{"seed":"1","config":{},"nodes":["0"],"events":${eventsJson},"result":"ok"}}`;
    expect(() => parseCapsule(json)).toThrow("exceeds the maximum");
  });
});

// `?capsule=` was the client-side SSRF path (audit A2): before the fix, a
// crafted link could make the browser fetch any cross-origin URL on the viewer's
// behalf. isSameOriginCapsuleUrl is the code-level gate (the CSP `connect-src
// 'self'` is the browser-level backstop). It must accept ONLY same-origin
// absolute paths — the single form `chronos open` ever emits (`/capsule`).
describe("isSameOriginCapsuleUrl", () => {
  it("accepts the only form `chronos open` sets: a same-origin absolute path", () => {
    expect(isSameOriginCapsuleUrl("/capsule")).toBe(true);
    expect(isSameOriginCapsuleUrl("/foo/bar?x=1#frag")).toBe(true);
  });
  it("rejects protocol-relative URLs (cross-origin via //host)", () => {
    expect(isSameOriginCapsuleUrl("//attacker.com/x")).toBe(false);
    expect(isSameOriginCapsuleUrl("//127.0.0.1:8080/x")).toBe(false);
  });
  it("rejects absolute schemes (http/data/blob)", () => {
    expect(isSameOriginCapsuleUrl("https://attacker.com/cap")).toBe(false);
    expect(isSameOriginCapsuleUrl("data:application/json,{}")).toBe(false);
    expect(isSameOriginCapsuleUrl("blob:https://attacker/uuid")).toBe(false);
    expect(isSameOriginCapsuleUrl("file:///etc/passwd")).toBe(false);
  });
  it("rejects bare relative paths (no leading slash)", () => {
    expect(isSameOriginCapsuleUrl("foo/bar")).toBe(false);
    expect(isSameOriginCapsuleUrl("failures/5.json")).toBe(false);
  });
  it("capsuleParamError renders the value JSON-quoted + truncated, never a clickable URL", () => {
    const msg = capsuleParamError("//attacker.com/x");
    expect(msg).toContain("same-origin");
    // JSON-quoted → not a clickable hyperlink, and truncated to 80 chars.
    expect(msg).toContain('"//attacker.com/x"');
    const long = capsuleParamError("//" + "a".repeat(200));
    expect(long.length).toBeLessThan(160);
  });
});

describe("pairMessages", () => {
  it("pairs a normal send with its single deliver as 'delivered'", () => {
    const events: TraceEvent[] = [
      ev({ kind: "send", from: "0", to: "1", summary: "inc", t: 10, seq: 0 }),
      ev({
        kind: "deliver",
        from: "0",
        to: "1",
        summary: "inc",
        t: 25,
        seq: 1,
      }),
    ];
    const flows = pairMessages(events);
    expect(flows).toHaveLength(1);
    expect(flows[0]!.status).toBe("delivered");
    expect(flows[0]!.delivers).toHaveLength(1);
    expect(flows[0]!.delivers[0]!.seq).toBe(1);
  });

  it("marks a dropped delivery (random-drop prefix) as 'dropped'", () => {
    const events: TraceEvent[] = [
      ev({
        kind: "send",
        from: "0",
        to: "1",
        summary: "dropped inc",
        t: 10,
        seq: 0,
      }),
    ];
    const flows = pairMessages(events);
    expect(flows).toHaveLength(1);
    expect(flows[0]!.status).toBe("dropped");
    expect(flows[0]!.delivers).toHaveLength(0);
  });

  it("marks a send lost in flight (no matching deliver) as 'dropped'", () => {
    const events: TraceEvent[] = [
      ev({ kind: "send", from: "0", to: "1", summary: "inc", t: 10, seq: 0 }),
      // no deliver — destination crashed before delivery
    ];
    expect(pairMessages(events)[0]!.status).toBe("dropped");
  });

  it("marks an independently duplicated delivery as 'duplicated'", () => {
    const events: TraceEvent[] = [
      ev({ kind: "send", from: "0", to: "1", summary: "inc", t: 10, seq: 0 }),
      ev({
        kind: "deliver",
        from: "0",
        to: "1",
        summary: "inc",
        t: 25,
        seq: 1,
      }),
      ev({
        kind: "deliver",
        from: "0",
        to: "1",
        summary: "inc",
        t: 38,
        seq: 2,
      }),
    ];
    const flows = pairMessages(events);
    expect(flows).toHaveLength(1);
    expect(flows[0]!.status).toBe("duplicated");
    expect(flows[0]!.delivers).toHaveLength(2);
  });

  it("is FIFO per (from,to,summary): interleaved duplicate messages keep order", () => {
    const events: TraceEvent[] = [
      ev({ kind: "send", from: "0", to: "1", summary: "inc", t: 10, seq: 0 }),
      ev({ kind: "send", from: "0", to: "1", summary: "inc", t: 11, seq: 1 }),
      ev({
        kind: "deliver",
        from: "0",
        to: "1",
        summary: "inc",
        t: 40,
        seq: 2,
      }),
      ev({
        kind: "deliver",
        from: "0",
        to: "1",
        summary: "inc",
        t: 41,
        seq: 3,
      }),
    ];
    const flows = pairMessages(events);
    expect(flows).toHaveLength(2);
    expect(flows[0]!.send.seq).toBe(0);
    expect(flows[0]!.delivers[0]!.seq).toBe(2); // first deliver → first send
    expect(flows[1]!.send.seq).toBe(1);
    expect(flows[1]!.delivers[0]!.seq).toBe(3);
  });

  it("never crosses lanes: sends and delivers with different summaries don't pair", () => {
    const events: TraceEvent[] = [
      ev({ kind: "send", from: "0", to: "1", summary: "ping", t: 10, seq: 0 }),
      ev({
        kind: "deliver",
        from: "0",
        to: "1",
        summary: "pong",
        t: 20,
        seq: 1,
      }),
    ];
    const flows = pairMessages(events);
    expect(flows[0]!.status).toBe("dropped"); // ping never delivered
    // The "pong" deliver has no matching send and is dropped (no flow for it).
    expect(flows).toHaveLength(1);
  });
});

describe("highlight helpers", () => {
  const events: TraceEvent[] = [
    ev({ kind: "wake", nodeId: "0", t: 1, seq: 0 }),
    ev({ kind: "send", from: "0", to: "1", summary: "inc", t: 2, seq: 1 }),
    ev({ kind: "timer", nodeId: "1", t: 3, seq: 2 }),
    ev({ kind: "deliver", from: "0", to: "1", summary: "inc", t: 4, seq: 3 }),
    ev({ kind: "crash", nodeId: "1", t: 5, seq: 4 }),
    ev({
      kind: "invariant-violation",
      name: "all counts equal",
      detail: "n0!=n1",
      t: 6,
      seq: 5,
    }),
  ];

  it("findViolation returns the first violation", () => {
    expect(findViolation(events)?.seq).toBe(5);
    expect(findViolation([])).toBeUndefined();
  });

  it("eventsBeforeViolation returns the preceding window", () => {
    expect(eventsBeforeViolation(events, 3).map((e) => e.seq)).toEqual([
      2, 3, 4,
    ]);
  });

  it("highlightSeqs contains the violation + preceding window", () => {
    const set = highlightSeqs(events, 3);
    expect(set.has(5)).toBe(true);
    expect(set.has(4)).toBe(true);
    expect(set.size).toBe(4);
  });

  it("handles a trace with no violation", () => {
    expect(eventsBeforeViolation(events.slice(0, 4), 5)).toEqual([]);
    expect(highlightSeqs(events.slice(0, 4), 5).size).toBe(0);
  });
});

describe("small derivations", () => {
  const events: TraceEvent[] = [
    ev({ kind: "wake", nodeId: "0", t: 5, seq: 0 }),
    ev({ kind: "send", from: "0", to: "1", summary: "inc", t: 12, seq: 1 }),
    ev({
      kind: "send",
      from: "0",
      to: "1",
      summary: "dropped inc",
      t: 30,
      seq: 2,
    }),
    ev({
      kind: "partition",
      groups: [["0"], ["1", "2"]],
      healAt: 60,
      t: 40,
      seq: 3,
    }),
  ];

  it("timeBounds returns [min,max]", () => {
    expect(timeBounds(events)).toEqual({ tMin: 5, tMax: 40 });
    expect(timeBounds([])).toEqual({ tMin: 0, tMax: 0 });
  });

  it("eventKindCounts tallies by kind", () => {
    const c = eventKindCounts(events);
    expect(c.get("send")).toBe(2);
    expect(c.get("wake")).toBe(1);
    expect(c.get("partition")).toBe(1);
    expect(c.get("deliver")).toBeUndefined();
  });

  it("partitionSpans clamps end >= start", () => {
    const spans = partitionSpans(events);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.start).toBe(40);
    expect(spans[0]!.end).toBe(60);
  });

  it("describeEvent produces a readable string per kind", () => {
    expect(describeEvent(events[0]!)).toContain("timer fired @ node 0");
    expect(describeEvent(events[1]!)).toContain("0 → 1  inc");
    expect(describeEvent(events[3]!)).toContain("partition");
  });
});
