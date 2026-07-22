#!/usr/bin/env node
// chronos — the @sx4im/chronos-cli bin (§3.4, §4.5, §5.1). A thin argv dispatcher over
// the pure command functions (replay/trace/sweep/open/explain/doctor).

import { pathToFileURL } from "node:url";
import { traceCommand } from "./trace.js";
import { replayCommand } from "./replay.js";
import { sweepCommand } from "./sweep.js";
import { shrinkCommand } from "./shrink.js";
import { openCommand } from "./open.js";
import { explainCommand } from "./explain.js";
import { doctorCommand } from "./doctor.js";
import { statsCommand } from "./stats.js";
import { checkCommand } from "./check.js";
import { exportCommand } from "./export.js";
import { C, ASCII_BANNER, ASCII_LOGO_SPHERE, drawBox } from "./ui.js";

const VERSION = "0.1.5";

function buildHelpText(): string {
  const header = `${ASCII_BANNER}\n` +
    `  ${C.badgeIndigo(" CHRONOS CLI ")} ${C.cyan("Deterministic Simulation Tooling")} ${C.slate(`v${VERSION}`)}\n\n`;

  const helpLines = [
    `${C.bold("Usage")}: ${C.cyan("chronos")} ${C.white("<command>")} ${C.purple("[args]")} ${C.slate("[flags]")}`,
    "",
    `${C.bold("Commands")}:`,
    `  ${C.cyan("replay")}  ${C.purple("<capsule>")} ${C.slate("[scenario]")}   Re-run saved failure (proves bit-identical trace)`,
    `  ${C.cyan("trace")}   ${C.purple("<capsule>")}              Print event timeline in structured ASCII format`,
    `  ${C.cyan("sweep")}   ${C.purple("<scenario>")} ${C.slate("[seeds]")}     Run scenario across N seeds (capsules first violator)`,
    `  ${C.cyan("shrink")}  ${C.purple("<capsule>")} ${C.purple("<scenario>")}   Reduce failing fault config to minimal reproduction`,
    `  ${C.cyan("open")}    ${C.purple("<capsule>")}              Open Time-Travel Inspector UI preloaded with capsule`,
    `  ${C.cyan("explain")} ${C.purple("<capsule>")}              Summarize failure via AI (OpenRouter, Groq, OpenAI, etc.)`,
    `  ${C.cyan("stats")}   ${C.purple("<capsule>")}              Display detailed trace metrics from a capsule`,
    `  ${C.cyan("check")}   ${C.slate("[paths...]")}              Statically scan source files for DST determinism leaks`,
    `  ${C.cyan("export")}  ${C.purple("<capsule>")} ${C.slate("[flags]")}       Export trace to Markdown/CSV formats`,
    `  ${C.cyan("doctor")}                        Verify local environment setup, strict mode, & assets`,
    "",
    `${C.bold("Ecosystem & Tooling Services")}:`,
    `  • ${C.cyan("@sx4im/chronos-core")}:   PRNG, Virtual Clock, MinHeap Scheduler, Strict Guards`,
    `  • ${C.cyan("@sx4im/chronos-net")}:    Seeded Latency, Packet Drops, Duplicates, Chaos Engine`,
    `  • ${C.cyan("@sx4im/chronos-vitest")}: simTest, expectInvariant, replayTest, State Shrinker`,
    `  • ${C.cyan("@sx4im/chronos-cli")}:    Failure Replay, Trace Viewer, Seed Sweeper, AI Explanation`,
    `  • ${C.cyan("Time-Travel Inspector")}: Visual Sequence Diagrams, Trace Timelines & State Scrubbing`,
    "",
    `${C.bold("Flags")}:`,
    `  ${C.amber("--format")}, ${C.amber("-f")}   Export format for export command (markdown|csv)`,
    `  ${C.amber("--output")}, ${C.amber("-o")}   Custom output file path for export command`,
    `  ${C.amber("--version")}, ${C.amber("-v")} Show Chronos CLI version`,
    `  ${C.amber("--help")}, ${C.amber("-h")}    Show help documentation`,
    "",
    `${C.bold("AI Explanation Providers (chronos explain)")}:`,
    `  Set any key: ${C.purple("OPENROUTER_API_KEY")} | ${C.purple("GROQ_API_KEY")} | ${C.purple("OPENAI_API_KEY")} | ${C.purple("ANTHROPIC_API_KEY")}`,
    `            ${C.purple("GEMINI_API_KEY")} | ${C.purple("DEEPSEEK_API_KEY")} | ${C.purple("MISTRAL_API_KEY")} | ${C.purple("NVIDIA_API_KEY")}`,
    `  Or Custom:  ${C.purple("LLM_BASE_URL")} + ${C.purple("LLM_API_KEY")} | ${C.purple("OLLAMA_MODEL")} (Local)`,
    "",
    `${C.bold("Environment Variables")}:`,
    `  ${C.purple("CHRONOS_SEED")}       Force a single seed for simulation runs`,
    `  ${C.purple("CHRONOS_DIR")}        Override default output directory (default: .chronos)`,
  ];

  return header + drawBox(`${C.indigo("COMMAND REFERENCE")}`, helpLines) + "\n";
}

function fail(msg: string, code = 2): never {
  process.stderr.write(`\n${C.badgeRose(" ERROR ")} ${C.rose(msg)}\n\n` + buildHelpText());
  process.exit(code);
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    process.stdout.write(buildHelpText());
    return;
  }
  if (cmd === "-v" || cmd === "--version" || cmd === "version") {
    process.stdout.write(`\n  ${C.badgeIndigo(" CHRONOS ")} ${C.white(`v${VERSION}`)}\n\n`);
    return;
  }

  switch (cmd) {
    case "doctor": {
      const r = await doctorCommand();
      process.stdout.write(r.message + "\n");
      process.exitCode = r.exitCode;
      return;
    }
    case "replay": {
      const [capsule, scenario] = rest;
      if (!capsule) fail("replay requires a <capsule> path");
      const r = await replayCommand(capsule, scenario);
      process.stdout.write(r.message + "\n");
      process.exitCode = r.exitCode;
      return;
    }
    case "trace": {
      const [capsule] = rest;
      if (!capsule) fail("trace requires a <capsule> path");
      const r = await traceCommand(capsule);
      for (const line of r.lines) process.stdout.write(line + "\n");
      process.exitCode = r.exitCode;
      return;
    }
    case "sweep": {
      const [scenario, ...args] = rest;
      if (!scenario) fail("sweep requires a <scenario> module path");
      let seedsArg: string | undefined = args[0];
      for (const arg of args) {
        if (arg.startsWith("--seeds=")) seedsArg = arg.split("=")[1];
      }
      let seeds: number | undefined;
      if (seedsArg !== undefined && !seedsArg.startsWith("-")) {
        const n = Number(seedsArg);
        if (!Number.isInteger(n) || n <= 0) fail("sweep seeds must be a positive integer");
        seeds = n;
      }
      const r = await sweepCommand(scenario, seeds);
      process.stdout.write(r.message + "\n");
      for (const s of r.violating) process.stdout.write(`  violating seed: ${s}\n`);
      process.exitCode = r.exitCode;
      return;
    }
    case "shrink": {
      const [capsule, scenario] = rest;
      if (!capsule) fail("shrink requires a <capsule> path");
      const r = await shrinkCommand(capsule, scenario);
      process.stdout.write(r.message + "\n");
      process.exitCode = r.exitCode;
      return;
    }
    case "open": {
      const [capsule] = rest;
      if (!capsule) fail("open requires a <capsule> path");
      const r = await openCommand(capsule, { serve: true });
      process.stdout.write(r.message + "\n");
      process.exitCode = r.exitCode;
      // Keep the process alive while the inspector is served; stop cleanly on signal.
      if (r.server) {
        const stop = (): void => {
          r.server?.close();
          process.exit(0);
        };
        process.on("SIGINT", stop);
        process.on("SIGTERM", stop);
      }
      return;
    }
    case "explain": {
      const [capsule] = rest;
      if (!capsule) fail("explain requires a <capsule> path");
      const r = await explainCommand(capsule);
      process.stdout.write(r.message + "\n");
      process.exitCode = r.exitCode;
      return;
    }
    case "stats": {
      const [capsule] = rest;
      if (!capsule) fail("stats requires a <capsule> path");
      const r = await statsCommand(capsule);
      process.stdout.write(r.message + "\n");
      process.exitCode = r.exitCode;
      return;
    }
    case "check": {
      const r = await checkCommand(rest);
      process.stdout.write(r.message + "\n");
      process.exitCode = r.exitCode;
      return;
    }
    case "export": {
      const [capsule] = rest;
      if (!capsule) fail("export requires a <capsule> path");

      // Parse format and output flags if any
      let format: "csv" | "markdown" | "md" | undefined;
      let output: string | undefined;
      for (let i = 0; i < rest.length; i++) {
        const arg = rest[i]!;
        if (arg === "-f" || arg === "--format") {
          format = rest[i + 1] as "csv" | "markdown" | "md";
        } else if (arg.startsWith("--format=")) {
          format = arg.split("=")[1] as "csv" | "markdown" | "md";
        } else if (arg === "-o" || arg === "--output") {
          output = rest[i + 1];
        } else if (arg.startsWith("--output=")) {
          output = arg.split("=")[1];
        }
      }

      const r = await exportCommand(capsule, { format, output });
      process.stdout.write(r.message + "\n");
      process.exitCode = r.exitCode;
      return;
    }
    default:
      fail(`unknown command "${cmd}"`);
  }
}

import { realpathSync } from "node:fs";

function isEntrypoint(): boolean {
  const arg1 = process.argv[1];
  if (!arg1) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(arg1)).href;
  } catch {
    return import.meta.url === pathToFileURL(arg1).href;
  }
}

if (isEntrypoint()) {
  void main().catch((e) => {
    process.stderr.write(`chronos: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  });
}
