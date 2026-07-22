import { useMemo } from "react";
import type { ParsedCapsule } from "./capsule.js";
import {
  eventKindCounts,
  findViolation,
  eventsBeforeViolation,
  highlightSeqs,
  describeEvent,
  pairMessages,
} from "./capsule.js";
import { KIND_STYLE, KIND_ORDER } from "./colors.js";
import { Timeline } from "./Timeline.js";
import { SequenceDiagram } from "./SequenceDiagram.js";
import { MetricsDashboard } from "./MetricsDashboard.js";

export function InspectorWorkspace({
  capsule,
  filename,
  view,
  onView,
  selectedSeq,
  onSelect,
  filterKind,
  onFilterKind,
  searchQuery,
  onSearchQuery,
}: {
  capsule: ParsedCapsule;
  filename: string;
  view: "timeline" | "diagram" | "metrics";
  onView: (v: "timeline" | "diagram" | "metrics") => void;
  selectedSeq: number | null;
  onSelect: (seq: number) => void;
  filterKind: string;
  onFilterKind: (k: string) => void;
  searchQuery: string;
  onSearchQuery: (q: string) => void;
}): JSX.Element {
  const { nodes, seed, invariant, trace } = capsule;
  const rawEvents = trace.events;

  const filteredEvents = useMemo(() => {
    return rawEvents.filter((ev) => {
      if (filterKind !== "all" && ev.kind !== filterKind) return false;
      if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase();
        const desc = describeEvent(ev).toLowerCase();
        return desc.includes(q) || String(ev.seq).includes(q) || String(ev.t).includes(q);
      }
      return true;
    });
  }, [rawEvents, filterKind, searchQuery]);

  const counts = useMemo(() => eventKindCounts(rawEvents), [rawEvents]);
  const highlight = useMemo(() => highlightSeqs(rawEvents), [rawEvents]);
  const violation = useMemo(() => findViolation(rawEvents), [rawEvents]);
  const before = useMemo(() => eventsBeforeViolation(rawEvents), [rawEvents]);
  const selected = useMemo(
    () => rawEvents.find((e) => e.seq === selectedSeq) ?? null,
    [rawEvents, selectedSeq],
  );

  const netStats = useMemo(() => {
    let sends = 0;
    let delivers = 0;
    let drops = 0;
    let dups = 0;

    const flows = pairMessages(rawEvents);
    for (const f of flows) {
      sends++;
      if (f.status === "dropped") drops++;
      else if (f.status === "duplicated") dups++;
      else delivers++;
    }

    const linkMap = new Map<string, { sends: number; delivers: number; drops: number; dups: number }>();
    for (const f of flows) {
      const key = `${f.send.from}->${f.send.to}`;
      const entry = linkMap.get(key) ?? { sends: 0, delivers: 0, drops: 0, dups: 0 };
      entry.sends++;
      if (f.status === "dropped") entry.drops++;
      else if (f.status === "duplicated") entry.dups++;
      else entry.delivers++;
      linkMap.set(key, entry);
    }

    return { sends, delivers, drops, dups, linkMap };
  }, [rawEvents]);

  return (
    <>
      <div className="summary-strip">
        <div className="summary-row">
          <div className="chip">
            <span className="k">seed</span>
            <span className="v">{seed}</span>
          </div>
          <div className="chip">
            <span className="k">file</span>
            <span className="v">{filename}</span>
          </div>
          <div className="chip">
            <span className="k">result</span>
            <span className={`v ${trace.result === "violation" ? "badge-viol" : "badge-good"}`}>{trace.result}</span>
          </div>
          <div className="chip">
            <span className="k">nodes</span>
            <span className="v">{nodes.length}</span>
          </div>
          <div className="chip">
            <span className="k">events</span>
            <span className="v">{rawEvents.length}</span>
          </div>
        </div>

        {violation && (
          <div className="viol-box">
            <strong>INVARIANT VIOLATION: {invariant.name}</strong> — {invariant.detail || "(no detail)"}
          </div>
        )}
      </div>

      <div className="inspector-toolbar">
        <div className="view-tabs">
          <button className={`tab-btn ${view === "timeline" ? "active" : ""}`} onClick={() => onView("timeline")}>
            Timeline Ribbon
          </button>
          <button className={`tab-btn ${view === "diagram" ? "active" : ""}`} onClick={() => onView("diagram")}>
            Sequence Diagram
          </button>
          <button className={`tab-btn ${view === "metrics" ? "active" : ""}`} onClick={() => onView("metrics")}>
            Metrics & Links
          </button>
        </div>

        <div className="filter-bar">
          <input
            type="text"
            className="search-box"
            placeholder="Search events (node, payload, seq)..."
            value={searchQuery}
            onChange={(e) => onSearchQuery(e.target.value)}
          />
          <div className="pills-group">
            <button
              className={`pill-btn ${filterKind === "all" ? "active" : ""}`}
              onClick={() => onFilterKind("all")}
            >
              All ({rawEvents.length})
            </button>
            {KIND_ORDER.filter((k) => counts.has(k)).map((k) => (
              <button
                key={k}
                className={`pill-btn ${filterKind === k ? "active" : ""}`}
                onClick={() => onFilterKind(k)}
              >
                {KIND_STYLE[k].label} ({counts.get(k)})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="canvas-area">
        {view === "timeline" && (
          <Timeline events={filteredEvents} selectedSeq={selectedSeq} highlight={highlight} onSelect={onSelect} />
        )}
        {view === "diagram" && (
          <SequenceDiagram events={filteredEvents} nodes={nodes} selectedSeq={selectedSeq} highlight={highlight} onSelect={onSelect} />
        )}
        {view === "metrics" && (
          <MetricsDashboard capsule={capsule} netStats={netStats} counts={counts} />
        )}
      </div>

      <div className="detail-drawer">
        {selected ? (
          <div>
            <span style={{ color: KIND_STYLE[selected.kind].color, fontWeight: 700, marginRight: "10px" }}>
              {KIND_STYLE[selected.kind].label}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", color: "#8b949e", marginRight: "12px" }}>
              t={selected.t} · seq={selected.seq}
            </span>
            <span className="detail-desc">{describeEvent(selected)}</span>
          </div>
        ) : (
          <span style={{ color: "#8b949e" }}>
            Select any marker or arrow to inspect event properties · {before.length} events precede violation
          </span>
        )}
      </div>
    </>
  );
}

export function ErrorView({ error }: { error: string }): JSX.Element {
  return (
    <div style={{ padding: "40px", color: "#ff7b72" }}>
      <h3 style={{ marginTop: 0 }}>Could not load capsule</h3>
      <pre style={{ background: "#21262d", padding: "16px", borderRadius: "8px", color: "#ffa198" }}>{error}</pre>
    </div>
  );
}
