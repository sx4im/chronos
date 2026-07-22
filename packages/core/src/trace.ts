// The Trace schema (§3.8) — the source of truth for replay and the Inspector.
// Stable surface: user code and the Inspector depend on this shape.

export type TraceEventInit =
  | { kind: "timer"; nodeId?: string }
  | { kind: "wake"; nodeId: string }
  | {
      kind: "deliver";
      from: string;
      to: string;
      summary: string;
    }
  | { kind: "send"; from: string; to: string; summary: string }
  | { kind: "crash"; nodeId: string }
  | { kind: "restart"; nodeId: string }
  | { kind: "partition"; groups: string[][]; healAt: number }
  | { kind: "invariant-violation"; name: string; detail: string };

// Each recorded event gets t (virtual time) and seq (monotonic log index).
export type TraceEvent = TraceEventInit & { t: number; seq: number };

export interface Trace {
  seed: string; // stringified BigInt
  config: unknown; // network + chaos config used
  nodes: string[];
  events: TraceEvent[];
  result: "ok" | "violation";
}

/**
 * An append-only log with a single monotonic counter. The counter is the ONLY
 * source of `seq` in a Trace; append order is deterministic (it follows the
 * scheduler's execution order), so a replay from the same seed produces an
 * identical sequence of trace events with identical `seq` values.
 */
export class TraceLogger {
  readonly events: TraceEvent[] = [];
  private counter = 0;

  append(t: number, init: TraceEventInit): TraceEvent {
    const ev = { ...init, t, seq: this.counter++ } as TraceEvent;
    this.events.push(ev);
    return ev;
  }

  /** Snapshot for checkpointing / reproduction. */
  toTrace(seed: string, config: unknown, nodes: string[], result: "ok" | "violation"): Trace {
    return { seed, config, nodes, events: [...this.events], result };
  }

  // Deterministic helpers to shrink payload logs to a stable short string.
  // Safely handles circular references and deep structures.
  static summarize(payload: unknown, maxLen = 80): string {
    let s: string;
    try {
      if (payload === undefined) {
        s = "undefined";
      } else {
        // Safe JSON stringify that detects/redacts circular references
        const seen = new WeakSet();
        s = JSON.stringify(payload, (_key, value) => {
          if (typeof value === "object" && value !== null) {
            if (seen.has(value)) {
              return "[Circular]";
            }
            seen.add(value);
          }
          return value;
        });
      }
    } catch {
      s = String(payload);
    }
    if (s === undefined) s = "undefined";
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s;
  }
}
