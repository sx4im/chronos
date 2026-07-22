// Sequence diagram view (Phase 4.2) — vertical lanes per node, time flowing
// DOWN, arrows for send→deliver. The distinct fault styles are the point:
//   delivered  → solid green arrow with a head.
//   dropped    → dashed red arrow that breaks before the far lane, marked ✕
//                (the message left its origin but the net lost it — random
//                drop, or the destination was partitioned/down).
//   duplicated → a second, ghosted dashed arrow for the net's extra delivery.
// Partitions span their node groups as an amber band; crashes/restarts mark
// their lane. Selection is shared with the Timeline (same selectedSeq).

import { useMemo, useState } from "react";
import type { TraceEvent } from "@sx4im/chronos-core";
import { pairMessages, partitionSpans, describeEvent, timeBounds } from "./capsule.js";
import { KIND_STYLE } from "./colors.js";

interface SequenceDiagramProps {
  events: TraceEvent[];
  nodes: string[];
  selectedSeq: number | null;
  highlight: Set<number>;
  onSelect: (seq: number) => void;
}

const HEADER = 36;
const PAD_L = 56;
const PAD_R = 24;
const PAD_B = 24;
const LANE_W = 110;

export function SequenceDiagram({
  events,
  nodes,
  selectedSeq,
  highlight,
  onSelect,
}: SequenceDiagramProps): JSX.Element {
  const [vScale, setVScale] = useState(3); // px per virtual ms (vertical=time)
  const { tMin, tMax } = useMemo(() => timeBounds(events), [events]);
  const flows = useMemo(() => pairMessages(events), [events]);
  const spans = useMemo(() => partitionSpans(events), [events]);

  const span = Math.max(1, tMax - tMin);
  const laneX = (id: string): number => {
    const i = nodes.indexOf(id);
    if (i === -1) return PAD_L + nodes.length * LANE_W + LANE_W / 2; // unknown → right void
    return PAD_L + i * LANE_W + LANE_W / 2;
  };
  const yOf = (t: number) => HEADER + (t - tMin) * vScale;
  const height = HEADER + span * vScale + PAD_B;
  const width = PAD_L + nodes.length * LANE_W + PAD_R;

  const selHits = (seqs: number[]): boolean => seqs.some((s) => s === selectedSeq);

  return (
    <section className="sequence">
      <div className="timeline-controls">
        <label className="zoom">
          zoom&nbsp;
          <input
            type="range"
            min={0.5}
            max={20}
            step={0.5}
            value={vScale}
            onChange={(e) => setVScale(parseFloat(e.target.value))}
          />
          &nbsp;<code>{vScale.toFixed(1)}px/ms</code>
        </label>
        <span className="hint">solid = delivered · dashed-red ✕ = dropped · ghosted = duplicated</span>
      </div>

      <div className="timeline-scroll">
        <svg width={width} height={height} role="img" aria-label="message sequence diagram">
          {/* lane headers + vertical lifelines */}
          {nodes.map((id, i) => {
            const x = PAD_L + i * LANE_W + LANE_W / 2;
            return (
              <g key={`lane-${id}`}>
                <rect x={PAD_L + i * LANE_W + 4} y={4} width={LANE_W - 8} height={HEADER - 10} rx={4} className="lane-head" />
                <text x={x} y={HEADER - 14} textAnchor="middle" className="lane-label">
                  {id}
                </text>
                <line x1={x} y1={HEADER} x2={x} y2={height} className="lifeline" />
              </g>
            );
          })}

          {/* invariant-violation band (full width) */}
          {events
            .filter((e) => e.kind === "invariant-violation")
            .map((e) => (
              <g key={`viol-${e.seq}`} onClick={() => onSelect(e.seq)} className="viol-area" role="button">
                <rect x={PAD_L} y={yOf(e.t) - 2} width={nodes.length * LANE_W} height={6} className="viol-band" />
                <text x={width - PAD_R} y={yOf(e.t) - 6} textAnchor="end" className="viol-label">
                  ✕ {e.name}
                </text>
                <title>{describeEvent(e)}</title>
              </g>
            ))}

          {/* partition bands across the involved lanes */}
          {spans.map((s) => {
            const xs = Math.min(...s.event.groups.flat().map((n) => laneX(n))) - 16;
            const xe = Math.max(...s.event.groups.flat().map((n) => laneX(n))) + 16;
            return (
              <rect
                key={`part-${s.event.seq}`}
                x={xs}
                y={yOf(s.start)}
                width={xe - xs}
                height={Math.max(2, (s.end - s.start) * vScale)}
                className="part-band"
              >
                <title>partition until t={s.end}</title>
              </rect>
            );
          })}

          {/* node lifecycle markers */}
          {events
            .filter((e) => e.kind === "crash" || e.kind === "restart")
            .map((e) => {
              const x = laneX(e.nodeId);
              const y = yOf(e.t);
              const c = KIND_STYLE[e.kind].color;
              return (
                <g key={`life-${e.seq}`} onClick={() => onSelect(e.seq)} className="life-marker" role="button">
                  <circle cx={x} cy={y} r={7} fill={c} />
                  <text x={x} y={y + 3.5} textAnchor="middle" className="life-glyph">
                    {e.kind === "crash" ? "✕" : "↻"}
                  </text>
                  <title>{describeEvent(e)}</title>
                </g>
              );
            })}

          {/* message arrows (sends → deliveries) */}
          {flows.map((f) => {
            const xFrom = laneX(f.send.from);
            const ySend = yOf(f.send.t);
            const isSel = selHits([f.send.seq, ...f.delivers.map((d) => d.seq)]) || highlight.has(f.send.seq);
            return (
              <g key={`flow-${f.id}`} className={isSel ? "flow sel" : "flow"}>
                <circle cx={xFrom} cy={ySend} r={3} fill={KIND_STYLE.send.color} />
                {f.status === "dropped" && (
                  <DroppedArrow xFrom={xFrom} xTo={laneX(f.send.to)} ySend={ySend} />
                )}
                {f.status === "delivered" && f.delivers[0] && (
                  <Arrow xFrom={xFrom} xTo={laneX(f.delivers[0].to)} ySend={ySend} yTo={yOf(f.delivers[0].t)} />
                )}
                {f.status === "duplicated" &&
                  f.delivers.map((d, i) => (
                    <Arrow
                      key={`dup-${i}`}
                      xFrom={xFrom}
                      xTo={laneX(d.to)}
                      ySend={ySend}
                      yTo={yOf(d.t)}
                      ghosted={i > 0}
                    />
                  ))}
                <title>
                  {`t=${f.send.t} → ${f.status}\n${describeEvent(f.send)}`}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}

/** A solid green arrow from the send origin down/across to the deliver lane. */
function Arrow({
  xFrom,
  xTo,
  ySend,
  yTo,
  ghosted = false,
}: {
  xFrom: number;
  xTo: number;
  ySend: number;
  yTo: number;
  ghosted?: boolean;
}): JSX.Element {
  const color = KIND_STYLE.deliver.color;
  if (xFrom === xTo) {
    // Self-message: a short leftward loop and back to the same lane.
    const bx = xFrom - 16;
    return (
      <g>
        <path
          d={`M ${xFrom} ${ySend} C ${bx} ${ySend}, ${bx} ${yTo}, ${xFrom} ${yTo}`}
          fill="none"
          stroke={color}
          strokeWidth={ghosted ? 1.5 : 2}
          strokeDasharray={ghosted ? "5 4" : undefined}
          opacity={ghosted ? 0.4 : 1}
        />
        <ArrowHead x={xFrom} y={yTo} color={color} />
      </g>
    );
  }
  const midY = (ySend + yTo) / 2;
  return (
    <g>
      <path
        d={`M ${xFrom} ${ySend} C ${xFrom} ${midY}, ${xTo} ${midY}, ${xTo} ${yTo}`}
        fill="none"
        stroke={color}
        strokeWidth={ghosted ? 1.5 : 2}
        strokeDasharray={ghosted ? "5 4" : undefined}
        opacity={ghosted ? 0.4 : 1}
      />
      <ArrowHead x={xTo} y={yTo} color={color} sideways={xTo > xFrom ? "right" : "left"} />
    </g>
  );
}

/** A dashed red arrow that breaks before the destination, marked ✕ — the
 * message left but never landed (drop / lost in flight). */
function DroppedArrow({ xFrom, xTo, ySend }: { xFrom: number; xTo: number; ySend: number }): JSX.Element {
  const breakY = ySend + 16;
  const color = "#b91c1c";
  const self = xFrom === xTo;
  const tip = self ? xFrom : xTo;
  const path = self
    ? `M ${xFrom} ${ySend} C ${xFrom - 16} ${ySend}, ${xFrom - 16} ${breakY}, ${xFrom} ${breakY}`
    : `M ${xFrom} ${ySend} C ${xFrom} ${breakY}, ${tip} ${breakY}, ${tip} ${breakY}`;
  return (
    <g className="dropped">
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeDasharray="5 4" />
      <text x={tip} y={breakY + 1} textAnchor="middle" className="drop-x">
        ✕
      </text>
    </g>
  );
}

/** Small triangular arrowhead drawn as a polygon (keeps the SVG self-contained
 * — no <defs>/<marker> reference needed across the two views). Points "down" by
 * default; `sideways` flips it into a horizontal head for cross-lane arrivals. */
function ArrowHead({
  x,
  y,
  color,
  sideways,
}: {
  x: number;
  y: number;
  color: string;
  sideways?: "left" | "right";
}): JSX.Element {
  let pts: string;
  if (sideways === "right") {
    pts = `${x - 7},${y - 4} ${x},${y} ${x - 7},${y + 4}`;
  } else if (sideways === "left") {
    pts = `${x + 7},${y - 4} ${x},${y} ${x + 7},${y + 4}`;
  } else {
    pts = `${x - 4},${y - 7} ${x},${y} ${x + 4},${y - 7}`;
  }
  return <polygon points={pts} fill={color} />;
}
