// chronos export — export capsule traces to CSV or Markdown format.

import { writeFile } from "node:fs/promises";
import { readCapsule, type FailureCapsule } from "@sx4im/chronos-vitest/engine";
import { resolveCapsulePath, capsuleReadError } from "./util.js";
import { C } from "./ui.js";

export interface ExportResult {
  exitCode: number;
  message: string;
}

export interface ExportOptions {
  format?: "csv" | "markdown" | "md" | undefined;
  output?: string | undefined;
}

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export async function exportCommand(
  capsulePath: string,
  opts: ExportOptions = {},
): Promise<ExportResult> {
  let capsule: FailureCapsule;
  try {
    capsule = await readCapsule(resolveCapsulePath(capsulePath));
  } catch (e) {
    return {
      exitCode: 2,
      message: capsuleReadError(capsulePath, e),
    };
  }

  const format = opts.format ?? "markdown";
  const events = capsule.trace.events;

  let content = "";
  let ext = "";

  if (format === "csv") {
    ext = ".csv";
    const headers = ["t", "seq", "kind", "nodeId", "from", "to", "summary", "detail"];
    content += headers.join(",") + "\n";
    for (const ev of events) {
      const row = [
        String(ev.t),
        String(ev.seq),
        ev.kind,
        (ev as { nodeId?: string }).nodeId ?? "",
        (ev as { from?: string }).from ?? "",
        (ev as { to?: string }).to ?? "",
        (ev as { summary?: string }).summary ?? "",
        (ev as { detail?: string }).detail ?? "",
      ];
      content += row.map(escapeCSV).join(",") + "\n";
    }
  } else {
    // Markdown/md
    ext = ".md";
    content += `# Chronos Simulation Trace Export\n\n`;
    content += `- **Seed**: ${capsule.seed}\n`;
    content += `- **Nodes**: ${capsule.nodes.join(", ")}\n`;
    content += `- **Invariant**: ${capsule.invariant.name} (${capsule.invariant.detail || "no detail"})\n`;
    content += `- **Outcome**: ${capsule.trace.result}\n\n`;

    content += `## Event Timeline\n\n`;
    content += `| Virtual Time (t) | Log Index (seq) | Event Kind | Node / Lane | Description |\n`;
    content += `|---|---|---|---|---|\n`;

    for (const ev of events) {
      const nodeId = (ev as { nodeId?: string }).nodeId ?? "";
      let desc = "";

      if (ev.kind === "send" || ev.kind === "deliver") {
        const from = (ev as { from?: string }).from ?? "";
        const to = (ev as { to?: string }).to ?? "";
        const sum = (ev as { summary?: string }).summary ?? "";
        const dir = ev.kind === "send" ? "→" : "📥";
        desc = `\`${from}\` ${dir} \`${to}\` : \`${sum}\``;
      } else if (ev.kind === "partition") {
        const groups = (ev as { groups?: string[][] }).groups ?? [];
        const healAt = (ev as { healAt?: number }).healAt ?? 0;
        desc = `Partition [${groups.map((g) => g.join(",")).join("] | [")}] healAt=${healAt}`;
      } else if (ev.kind === "invariant-violation") {
        const detail = (ev as { detail?: string }).detail ?? "";
        desc = `**VIOLATION** - ${detail}`;
      } else {
        desc = (ev as { summary?: string }).summary || (ev as { detail?: string }).detail || JSON.stringify(ev);
      }

      const nodeCol = nodeId ? `\`${nodeId}\`` : "";
      content += `| ${ev.t} | ${ev.seq} | \`${ev.kind}\` | ${nodeCol} | ${desc} |\n`;
    }
  }

  // Determine output file path
  let outPath = opts.output;
  if (!outPath) {
    const base = capsulePath.replace(/\.json$/i, "");
    outPath = `${base}.export${ext}`;
  }

  try {
    await writeFile(outPath, content, "utf8");
    return {
      exitCode: 0,
      message: `\n${C.badgeEmerald(" SUCCESS ")} Exported trace to ${C.bold(outPath)} (${events.length} events)\n`,
    };
  } catch (e) {
    return {
      exitCode: 2,
      message: `\n${C.badgeRose(" ERROR ")} Could not write export file ${outPath}: ${e instanceof Error ? e.message : String(e)}\n`,
    };
  }
}
