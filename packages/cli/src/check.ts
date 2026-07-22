// chronos check — static analysis tool for DST (determinism) compliance.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve, relative } from "node:path";
import { C, drawBox, renderTopBanner } from "./ui.js";

export interface CheckResult {
  exitCode: number;
  message: string;
}

const IGNORE_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  ".git",
  ".chronos",
  ".github",
  "docs",
  "docs-site",
  "test",
  "tests",
  "coverage",
  ".next",
  ".vitepress",
  ".turbo",
]);

const IGNORE_FILES = new Set([
  "scheduler.ts", // owns the blessed setImmediate barrier
  "real.ts",      // owns real-time bindings
  "strict.ts",    // installs the guards themselves
  "check.ts",     // owns the rules themselves
  "explain.ts",   // CLI harness: real HTTP + abort timeout (not simulated)
  "open.ts",      // CLI harness: real HTTP server (not simulated)
]);

// Rule definition
interface Rule {
  name: string;
  regex: RegExp;
  suggestion: string;
}

const RULES: Rule[] = [
  {
    name: "Math.random()",
    regex: /\bMath\.random\s*\(/g,
    suggestion: "Use simulator's RNG: rng.nextFloat() or env.random()",
  },
  {
    name: "Date.now()",
    regex: /\bDate\.now\s*\(/g,
    suggestion: "Use virtual clock: env.now()",
  },
  {
    name: "new Date() (wall-clock)",
    regex: /\bnew\s+Date\s*\(\s*\)/g,
    suggestion: "Use virtual clock: new Date(env.now())",
  },
  {
    name: "performance.now()",
    regex: /\bperformance\.now\s*\(/g,
    suggestion: "Use virtual clock: env.now()",
  },
  {
    name: "process.hrtime()",
    regex: /\bprocess\.hrtime(\.bigint)?\s*\(/g,
    suggestion: "Use virtual clock: env.now()",
  },
  {
    name: "setInterval()",
    regex: /\b(globalThis\.)?setInterval\s*\(/g,
    suggestion: "Use recursive env.setTimeout() or scheduled events",
  },
  {
    name: "setTimeout()",
    regex: /\b(globalThis\.)?setTimeout\s*\(/g,
    suggestion: "Use simulator's clock: env.setTimeout()",
  },
  {
    name: "setImmediate()",
    regex: /\b(globalThis\.)?setImmediate\s*\(/g,
    suggestion: "Use simulator's clock: env.sleep(0) or env.setTimeout(cb, 0)",
  },
  {
    name: "clearTimeout()",
    regex: /\b(globalThis\.)?clearTimeout\s*\(/g,
    suggestion: "Use simulator's timer handle: handle.cancel()",
  },
  {
    name: "clearInterval()",
    regex: /\b(globalThis\.)?clearInterval\s*\(/g,
    suggestion: "Use simulator's timer handle: handle.cancel()",
  },
  {
    name: "clearImmediate()",
    regex: /\b(globalThis\.)?clearImmediate\s*\(/g,
    suggestion: "Use simulator's timer handle: handle.cancel()",
  },
];

async function getFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  const list = await readdir(dir).catch(() => [] as string[]);
  for (const file of list) {
    if (IGNORE_DIRS.has(file)) continue;
    const path = join(dir, file);
    const s = await stat(path).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      results.push(...(await getFiles(path)));
    } else if (s.isFile()) {
      if (
        /\.(ts|tsx|js|jsx|mjs)$/.test(file) &&
        !/\.test\./.test(file) &&
        !/\.spec\./.test(file) &&
        !IGNORE_FILES.has(file)
      ) {
        results.push(path);
      }
    }
  }
  return results;
}

export async function checkCommand(paths: string[] = []): Promise<CheckResult> {
  let filesToScan: string[] = [];

  if (paths.length > 0) {
    for (const p of paths) {
      const resolved = resolve(p);
      const s = await stat(resolved).catch(() => null);
      if (!s) continue;
      if (s.isDirectory()) {
        filesToScan.push(...(await getFiles(resolved)));
      } else if (s.isFile()) {
        filesToScan.push(resolved);
      }
    }
  } else {
    // Default: scan src, lib, app, packages, or examples
    const cwd = process.cwd();
    const candidateDirs = ["src", "lib", "app", "packages", "examples"];
    let foundDir = false;
    for (const d of candidateDirs) {
      const p = join(cwd, d);
      const s = await stat(p).catch(() => null);
      if (s && s.isDirectory()) {
        filesToScan.push(...(await getFiles(p)));
        foundDir = true;
      }
    }
    if (!foundDir) {
      filesToScan.push(...(await getFiles(cwd)));
    }
  }

  // Filter out duplicate paths
  filesToScan = Array.from(new Set(filesToScan));

  interface Finding {
    file: string;
    line: number;
    col: number;
    rule: string;
    text: string;
    suggestion: string;
  }

  const findings: Finding[] = [];

  for (const file of filesToScan) {
    const code = await readFile(file, "utf8").catch(() => "");
    const lines = code.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i]!;
      const trimmed = lineText.trim();

      // Ignore comments or disabled lines
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*") ||
        lineText.includes("chronos-disable-check")
      ) {
        continue;
      }

      for (const rule of RULES) {
        rule.regex.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = rule.regex.exec(lineText)) !== null) {
          // Truncate code snippet to 45 chars max so it fits cleanly inside terminal boxes
          let snippet = trimmed;
          if (snippet.length > 45) {
            snippet = snippet.slice(0, 42) + "...";
          }

          findings.push({
            file,
            line: i + 1,
            col: match.index + 1,
            rule: rule.name,
            text: snippet,
            suggestion: rule.suggestion,
          });
        }
      }
    }
  }

  const lines: string[] = [];
  const cleanMessage = findings.length === 0;

  if (cleanMessage) {
    lines.push(
      `${C.emerald("✔")} No non-deterministic globals detected!`,
      `  Scanned ${filesToScan.length} source files recursively.`,
      `  All code adheres to the Chronos Dependency Injection contract.`,
    );
  } else {
    lines.push(
      `${C.rose("✖")} Detected ${findings.length} potential DST compliance issues in ${Object.keys(groupByFile(findings)).length} file(s):`,
      "",
    );

    const byFile = groupByFile(findings);

    for (const [file, fileFindings] of Object.entries(byFile)) {
      const relPath = relative(process.cwd(), file);
      lines.push(`${C.bold(relPath)}:`);
      for (const f of fileFindings) {
        lines.push(
          `  ${C.muted(`L${f.line}:${f.col}`)} ${C.rose(f.rule)} used`,
          `    ${C.slate("Code:")}       ${f.text}`,
          `    ${C.emerald("Fix:")}        ${f.suggestion}`,
        );
      }
      lines.push("");
    }
    lines.pop(); // remove trailing empty line
  }

  const title = `${C.indigo("CHRONOS STATIC DST CHECKER")} ${C.muted(`v0.1.4`)}`;

  return {
    exitCode: cleanMessage ? 0 : 1,
    message: renderTopBanner("0.1.4") + drawBox(title, lines),
  };
}

function groupByFile(findings: { file: string; line: number; col: number; rule: string; text: string; suggestion: string }[]) {
  const byFile: Record<string, typeof findings> = {};
  for (const f of findings) {
    byFile[f.file] = byFile[f.file] ?? [];
    byFile[f.file]!.push(f);
  }
  return byFile;
}
