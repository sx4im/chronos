// chronos stats — display detailed trace metrics from a capsule.

import { readCapsule, type FailureCapsule } from "@sx4im/chronos-vitest/engine";
import { resolveCapsulePath, capsuleReadError } from "./util.js";
import { C, drawBox, renderTopBanner } from "./ui.js";

export interface StatsResult {
  exitCode: number;
  message: string;
}

export async function statsCommand(capsulePath: string): Promise<StatsResult> {
  let capsule: FailureCapsule;
  try {
    capsule = await readCapsule(resolveCapsulePath(capsulePath));
  } catch (e) {
    return {
      exitCode: 2,
      message: capsuleReadError(capsulePath, e),
    };
  }

  const { seed, nodes, maxSteps, invariant, trace } = capsule;
  const events = trace.events;

  // Counts by kind
  const counts: Record<string, number> = {};
  for (const ev of events) {
    counts[ev.kind] = (counts[ev.kind] ?? 0) + 1;
  }

  // Network metrics
  let totalSends = 0;
  let totalDelivers = 0;
  let totalDups = 0;
  let totalDrops = 0;

  // To compute latency
  let totalLatency = 0;
  let minLatency = Infinity;
  let maxLatency = -Infinity;

  // FIFO pairing lists to handle latency calculation
  const pendingSends = new Map<string, number[]>(); // key -> array of send times

  const flowKey = (from: string, to: string, summary: string) => `${from}->${to}:${summary}`;

  for (const ev of events) {
    if (ev.kind === "send") {
      totalSends++;
      if (ev.summary.startsWith("dropped ")) {
        totalDrops++;
      } else {
        const key = flowKey(ev.from, ev.to, ev.summary);
        const list = pendingSends.get(key) ?? [];
        list.push(ev.t);
        pendingSends.set(key, list);
      }
    } else if (ev.kind === "deliver") {
      totalDelivers++;
      const key = flowKey(ev.from, ev.to, ev.summary);
      const list = pendingSends.get(key);
      if (list && list.length > 0) {
        // Normal delivery of oldest pending send
        const sendTime = list.shift()!;
        const lat = ev.t - sendTime;
        totalLatency += lat;
        if (lat < minLatency) minLatency = lat;
        if (lat > maxLatency) maxLatency = lat;
      } else {
        // This is a duplicate (the first delivery already popped the send)
        totalDups++;
        // Try to estimate latency based on the send timestamp if we still have it
        // Or if it was already cleared.
      }
    }
  }

  // Anything left in pendingSends without deliveries is lost in flight (dropped)
  for (const [, list] of pendingSends) {
    totalDrops += list.length;
  }

  const avgLatency = (totalDelivers - totalDups) > 0 ? (totalLatency / (totalDelivers - totalDups)) : 0;
  const finalMinLat = minLatency === Infinity ? 0 : minLatency;
  const finalMaxLat = maxLatency === -Infinity ? 0 : maxLatency;

  const dropRate = totalSends > 0 ? (totalDrops / totalSends) * 100 : 0;
  const dupRate = totalSends > 0 ? (totalDups / totalSends) * 100 : 0;
  const deliveryRate = totalSends > 0 ? ((totalDelivers - totalDups) / totalSends) * 100 : 0;

  const status = trace.result;

  const lines: string[] = [
    `${C.bold("Simulation Metadata")}:`,
    `  ${C.cyan("•")} Seed:            ${C.white(seed)}`,
    `  ${C.cyan("•")} Nodes:           ${C.white(String(nodes.length))} [${nodes.join(", ")}]`,
    `  ${C.cyan("•")} Steps Budget:    ${C.white(String(maxSteps))}`,
    `  ${C.cyan("•")} Result Outcome:  ${status === "violation" ? C.rose("✕ Invariant Violation") : C.emerald("✔ OK")}`,
    "",
    `${C.bold("Event Breakdown")}:`,
    `  ${C.cyan("•")} Total Events:     ${C.white(String(events.length))}`,
    `  ${C.cyan("•")} Timers Scheduled: ${C.white(String(counts.timer ?? 0))}`,
    `  ${C.cyan("•")} Timers Fired:     ${C.white(String(counts.wake ?? 0))}`,
    `  ${C.cyan("•")} Network Sends:    ${C.white(String(counts.send ?? 0))}`,
    `  ${C.cyan("•")} Network Delivers: ${C.white(String(counts.deliver ?? 0))}`,
    `  ${C.cyan("•")} Node Crashes:     ${C.white(String(counts.crash ?? 0))}`,
    `  ${C.cyan("•")} Node Restarts:    ${C.white(String(counts.restart ?? 0))}`,
    `  ${C.cyan("•")} Net Partitions:   ${C.white(String(counts.partition ?? 0))}`,
    `  ${C.cyan("•")} Invariant Viol:   ${C.white(String(counts["invariant-violation"] ?? 0))}`,
    "",
    `${C.bold("Virtual Network Metrics")}:`,
    `  ${C.cyan("•")} Messages Sent:    ${C.white(String(totalSends))}`,
    `  ${C.cyan("•")} Msg Deliver Rate: ${C.emerald(`${deliveryRate.toFixed(1)}%`)} (${totalDelivers - totalDups} delivered)`,
    `  ${C.cyan("•")} Msg Drop Rate:    ${totalDrops > 0 ? C.rose(`${dropRate.toFixed(1)}%`) : C.slate("0.0%")} (${totalDrops} dropped)`,
    `  ${C.cyan("•")} Msg Dup Rate:     ${totalDups > 0 ? C.amber(`${dupRate.toFixed(1)}%`) : C.slate("0.0%")} (${totalDups} duplicated)`,
    `  ${C.cyan("•")} Latency Bounds:   ${C.white(`${finalMinLat}–${finalMaxLat} ms`)} (avg: ${avgLatency.toFixed(1)} ms)`,
  ];

  if (status === "violation") {
    lines.push(
      "",
      `${C.bold("Violation Context")}:`,
      `  ${C.rose("✕")} Invariant:       ${C.bold(invariant.name)}`,
      `  ${C.rose("•")} Detail:          ${C.white(invariant.detail || "(no detail)")}`,
    );
  }

  const title = `${C.indigo("CHRONOS TRACE STATS")} ${C.muted(`v0.1.4`)}`;

  return {
    exitCode: 0,
    message: renderTopBanner("0.1.4") + drawBox(title, lines),
  };
}
