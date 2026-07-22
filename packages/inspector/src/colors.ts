// Visual encoding for each trace event kind (§3.8). One source of truth shared by
// the Timeline and SequenceDiagram so the two views stay visually consistent.

import type { TraceEvent } from "@sx4im/chronos-core";

export type EventKind = TraceEvent["kind"];

export interface KindStyle {
  /** Human label, e.g. "Send". */
  label: string;
  /** Swatch hex used for ticks, markers, and legend. */
  color: string;
  /** Short glyph rendered on a marker. */
  short: string;
  /** One-line description of when this event fires. */
  hint: string;
}

export const KIND_STYLE: Record<EventKind, KindStyle> = {
  timer: { label: "Timer", color: "#64748b", short: "T", hint: "A timer was scheduled (env.setTimeout)." },
  wake: { label: "Wake", color: "#0891b2", short: "W", hint: "A scheduled timer fired and woke its node." },
  send: { label: "Send", color: "#2563eb", short: "⇉", hint: "A node sent a message over the simulated net." },
  deliver: { label: "Deliver", color: "#16a34a", short: "→", hint: "A sent message was delivered to its destination." },
  crash: { label: "Crash", color: "#b91c1c", short: "✕", hint: "A node crashed (chaos) — its inbox goes down." },
  restart: { label: "Restart", color: "#7c3aed", short: "↻", hint: "A crashed node was restarted." },
  partition: { label: "Partition", color: "#d97706", short: "▤", hint: "A network partition began/ended between node groups." },
  "invariant-violation": { label: "Violation", color: "#be123c", short: "!", hint: "A safety/liveness invariant failed — the bug surfaced." },
};

/** Ordered kinds for the legend. */
export const KIND_ORDER: EventKind[] = [
  "wake",
  "send",
  "deliver",
  "timer",
  "crash",
  "restart",
  "partition",
  "invariant-violation",
];
