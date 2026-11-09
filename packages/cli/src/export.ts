// chronos export — export capsule traces to CSV or Markdown format.

import { lstat, writeFile } from "node:fs/promises";
import { readCapsule, type FailureCapsule } from "@sx4im/chronos-vitest/engine";
import { resolveCapsulePath, capsuleReadError, CapsulePathRefused } from "./util.js";
import { escapeCsvCell, escapeMarkdownCell, safeText } from "./sanitize.js";
import { C } from "./ui.js";

export interface ExportResult {
  exitCode: number;
  message: string;
}

export interface ExportOptions {
  format?: "csv" | "markdown" | "md" | undefined;
  output?: string | undefined;
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
      content += row.map(escapeCsvCell).join(",") + "\n";
    }
  } else {
    // Markdown/md
    ext = ".md";
    content += `# Chronos Simulation Trace Export\n\n`;
    content += `- **Seed**: ${escapeMarkdownCell(capsule.seed)}\n`;
    content += `- **Nodes**: ${capsule.nodes.map(escapeMarkdownCell).join(", ")}\n`;
    content += `- **Invariant**: ${escapeMarkdownCell(capsule.invariant.name)} (${escapeMarkdownCell(capsule.invariant.detail) || "no detail"})\n`;
    content += `- **Outcome**: ${escapeMarkdownCell(capsule.trace.result)}\n\n`;

    content += `## Event Timeline\n\n`;
    content += `| Virtual Time (t) | Log Index (seq) | Event Kind | Node / Lane | Description |\n`;
    content += `|---|---|---|---|---|\n`;

    for (const ev of events) {
      const nodeId = escapeMarkdownCell((ev as { nodeId?: string }).nodeId ?? "");
      let desc = "";

      if (ev.kind === "send" || ev.kind === "deliver") {
        const from = escapeMarkdownCell((ev as { from?: string }).from ?? "");
        const to = escapeMarkdownCell((ev as { to?: string }).to ?? "");
        const sum = escapeMarkdownCell((ev as { summary?: string }).summary ?? "");
        const dir = ev.kind === "send" ? "→" : "📥";
        desc = `${from} ${dir} ${to} : ${sum}`;
      } else if (ev.kind === "partition") {
        const groups = (ev as { groups?: string[][] }).groups ?? [];
        const healAt = (ev as { healAt?: number }).healAt ?? 0;
        const rendered = groups.map((g) => g.map(escapeMarkdownCell).join(",")).join("] | [");
        desc = `Partition [${rendered}] healAt=${healAt}`;
      } else if (ev.kind === "invariant-violation") {
        desc = `**VIOLATION** - ${escapeMarkdownCell((ev as { detail?: string }).detail ?? "")}`;
      } else {
        const fallback =
          (ev as { summary?: string }).summary ||
          (ev as { detail?: string }).detail ||
          JSON.stringify(ev);
        desc = escapeMarkdownCell(fallback);
      }

      content += `| ${ev.t} | ${ev.seq} | ${escapeMarkdownCell(ev.kind)} | ${nodeId} | ${desc} |\n`;
    }
  }

  let outPath = opts.output;
  if (!outPath) {
    const base = capsulePath.replace(/\.json$/i, "");
    outPath = `${base}.export${ext}`;
  }

  try {
    const confinedOut = resolveCapsulePath(outPath);
    const existing = await lstat(confinedOut).catch(() => null);
    if (existing?.isSymbolicLink()) {
      throw new CapsulePathRefused("refusing to write export through a symbolic link");
    }
    await writeFile(confinedOut, content, "utf8");
    return {
      exitCode: 0,
      message: `\n${C.badgeEmerald(" SUCCESS ")} Exported trace to ${C.bold(safeText(outPath))} (${events.length} events)\n`,
    };
  } catch (e) {
    return {
      exitCode: 2,
      message: `\n${C.badgeRose(" ERROR ")} Could not write export file ${safeText(outPath)}: ${e instanceof Error ? e.message : String(e)}\n`,
    };
  }
}
