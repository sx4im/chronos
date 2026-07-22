// Timeline view (Phase 4.1) — a horizontal event ribbon keyed by VIRTUAL time,
// not wall clock. The user zooms (px-per-ms slider) and scrubs (click a marker,
// or drive the playhead with the range input). Color encodes event kind; the
// invariant-violation and its immediate predecessor window are highlighted so
// the causal neighborhood jumps out. No real time anywhere — `t` is the
// simulator's virtual clock, the same `t` replay reproduces.

import { useMemo, useState } from "react";
import type { TraceEvent } from "@sx4im/chronos-core";
import { timeBounds, partitionSpans, describeEvent } from "./capsule.js";
import { KIND_STYLE, KIND_ORDER } from "./colors.js";

interface TimelineProps {
  events: TraceEvent[];
  selectedSeq: number | null;
  highlight: Set<number>;
  onSelect: (seq: number) => void;
}

const TOP = 40; // axis region height
const BOTTOM = 8;
const MARKER_AREA_H = 200;
const H = TOP + MARKER_AREA_H + BOTTOM;
const PAD_L = 56; // room for the first time label
const PAD_R = 24;

function niceStep(span: number): number {
  if (Number.isNaN(span) || !Number.isFinite(span) || span <= 0) return 1;
  const target = span / 10;
  const log = Math.log10(target);
  if (Number.isNaN(log) || !Number.isFinite(log)) return 1;
  const pow = 10 ** Math.floor(log);
  const n = target / pow;
  const mult = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return Math.max(1, mult * pow);
}

export function Timeline({ events, selectedSeq, highlight, onSelect }: TimelineProps): JSX.Element {
  const [scale, setScale] = useState(4); // px per virtual ms
  const { tMin, tMax } = useMemo(() => timeBounds(events), [events]);
  const spans = useMemo(() => partitionSpans(events), [events]);

  const span = Math.max(1, tMax - tMin);
  const innerW = span * scale + PAD_R;
  const width = PAD_L + innerW;
  const step = niceStep(span);
  const ticks: number[] = [];
  for (let t = Math.ceil(tMin / step) * step; t <= tMax; t += step) ticks.push(t);

  const xOf = (t: number) => PAD_L + (t - tMin) * scale;
  const selected = events.find((e) => e.seq === selectedSeq) ?? null;

  const tAtCursor = (clientX: number, svg: SVGSVGElement): number => {
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * width;
    const t = Math.round(tMin + (svgX - PAD_L) / scale);
    return Math.min(tMax, Math.max(tMin, t));
  };

  return (
    <section className="timeline">
      <div className="timeline-controls">
        <label className="zoom">
          zoom&nbsp;
          <input
            type="range"
            min={0.5}
            max={40}
            step={0.5}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
          />
          &nbsp;<code>{scale.toFixed(1)}px/ms</code>
        </label>
        <span className="hint">click a marker to scrub · here&nbsp;⇣ = virtual ms (simulator clock)</span>
      </div>

      <div className="timeline-scroll">
        <svg
          width={width}
          height={H}
          role="img"
          aria-label="event timeline"
          onClick={(e) => {
            const t = tAtCursor(e.clientX, e.currentTarget);
            // Scrub to the event nearest this virtual time.
            let nearest = events[0] ?? null;
            let best = Infinity;
            for (const ev of events) {
              const d = Math.abs(ev.t - t);
              if (d < best) {
                best = d;
                nearest = ev;
              }
            }
            if (nearest) onSelect(nearest.seq);
          }}
        >
          {/* partition bands */}
          {spans.map((s) => (
            <rect
              key={`part-${s.event.seq}`}
              x={xOf(s.start)}
              y={TOP}
              width={Math.max(2, (s.end - s.start) * scale)}
              height={MARKER_AREA_H}
              className="part-band"
            />
          ))}

          {/* axis baseline */}
          <line x1={PAD_L} y1={TOP} x2={width} y2={TOP} className="axis" />
          {ticks.map((t) => (
            <g key={`tick-${t}`}>
              <line x1={xOf(t)} y1={TOP - 6} x2={xOf(t)} y2={TOP} className="axis" />
              <text x={xOf(t)} y={TOP - 10} className="tick-label">
                {t}
              </text>
            </g>
          ))}

          {/* highlight band for the violation neighborhood */}
          {highlightSeqRange(events, highlight) !== null && (() => {
            const r = highlightSeqRange(events, highlight)!;
            const xs = xOf(r.tStart) - 3;
            const xe = xOf(r.tEnd) + 3;
            return <rect x={xs} y={TOP} width={Math.max(4, xe - xs)} height={MARKER_AREA_H} className="highlight-band" />;
          })()}

          {/* event markers */}
          {events.map((ev) => {
            const x = xOf(ev.t);
            const style = KIND_STYLE[ev.kind];
            const isViol = ev.kind === "invariant-violation";
            const isHi = highlight.has(ev.seq);
            const isSel = ev.seq === selectedSeq;
            // Row jitter (0..3) so same-time events don't perfectly stack.
            const row = ev.seq % 4;
            const y = TOP + 10 + row * ((MARKER_AREA_H - 20) / 4);
            return (
              <g
                key={ev.seq}
                className={`marker ${isSel ? "sel" : ""} ${isViol ? "viol" : ""} ${isHi ? "hi" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(ev.seq);
                }}
              >
                <circle cx={x} cy={y} r={isViol ? 6 : isHi ? 4 : 3} fill={style.color} />
                <line x1={x} y1={y + 4} x2={x} y2={TOP + MARKER_AREA_H} stroke={style.color} strokeWidth={isViol ? 2.5 : 1} />
                <title>{`t=${ev.t} seq=${ev.seq} · ${describeEvent(ev)}`}</title>
              </g>
            );
          })}

          {/* playhead over the selected event */}
          {selected && (
            <line
              x1={xOf(selected.t)}
              y1={TOP - 8}
              x2={xOf(selected.t)}
              y2={H}
              className="playhead"
            />
          )}
        </svg>
      </div>

      <Legend />
    </section>
  );
}

function highlightSeqRange(
  events: TraceEvent[],
  highlight: Set<number>,
): { tStart: number; tEnd: number } | null {
  let tStart = Infinity;
  let tEnd = -Infinity;
  for (const ev of events) {
    if (highlight.has(ev.seq)) {
      if (ev.t < tStart) tStart = ev.t;
      if (ev.t > tEnd) tEnd = ev.t;
    }
  }
  if (!Number.isFinite(tStart)) return null;
  return { tStart, tEnd };
}

function Legend(): JSX.Element {
  return (
    <ul className="legend">
      {KIND_ORDER.map((k) => {
        const s = KIND_STYLE[k];
        return (
          <li key={k}>
            <span className="swatch" style={{ background: s.color }} />
            {s.label}
          </li>
        );
      })}
    </ul>
  );
}
