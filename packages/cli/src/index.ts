#!/usr/bin/env node
// chronos — the @sx4im/chronos-cli bin (§3.4, §4.5, §5.1). A thin argv dispatcher over
// the pure command functions (replay/trace/sweep/open/explain/doctor).
//
// The dispatch itself (`runCommand`) is a PURE async function from argv to a
// result object — no process.exit, no stdout writes — so the CLI surface is
// unit-testable. `main()` is the only impure shell: it writes streams, sets
// process.exitCode, and keeps the process alive while the inspector serves.

import { pathToFileURL } from "node:url";
import type { Server } from "node:http";
import { CHRONOS_VERSION } from "@sx4im/chronos-core";
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
import { C, drawBox } from "./ui.js";
import { ASCII_BANNER } from "./assets/logo.js";

const VERSION = CHRONOS_VERSION;

/** Upper bound on `chronos sweep <scenario> <seeds>`. A million seeds is already
 *  far past any interactive use; beyond that the seed array alone exhausts
 *  memory before a single simulation runs. */
const MAX_SWEEP_SEEDS = 1_000_000;

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
    `  ${C.cyan("explain")} ${C.purple("<capsule>")}              Summarize failure via AI (OpenAI, Anthropic, Gemini, custom)`,
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
    `  Set any key: ${C.purple("OPENAI_API_KEY")} | ${C.purple("ANTHROPIC_API_KEY")} | ${C.purple("GEMINI_API_KEY")}`,
    `  Or Custom:   ${C.purple("LLM_BASE_URL")} + ${C.purple("LLM_API_KEY")} — any OpenAI-compatible endpoint`,
    `               (Ollama, LM Studio, vLLM, OpenRouter, Groq, …). https required off-loopback.`,
    "",
    `${C.bold("Environment Variables")}:`,
    `  ${C.purple("CHRONOS_SEED")}       Force a single seed for simulation runs`,
    `  ${C.purple("CHRONOS_MAX_SEEDS")}  Cap count-form seed sweeps (CI speed; explicit arrays exempt)`,
    `  ${C.purple("CHRONOS_DIR")}        Override default output directory (default: .chronos)`,
    `  ${C.purple("CHRONOS_STRICT")}     Entropy guard level: route (default) | throw | off`,
    `  ${C.purple("CHRONOS_MAX_CAPSULE_BYTES")}  Raise the 128 MB capsule read limit`,
  ];

  return header + drawBox(`${C.indigo("COMMAND REFERENCE")}`, helpLines) + "\n";
}

/** What one invocation produces. `main()` turns this into stream writes and an
 *  exit code; tests assert on it directly. */
export interface RunResult {
  /** Exit code for process.exitCode (undefined → leave unset, i.e. 0). */
  code?: number;
  /** Text destined for stdout. */
  out?: string;
  /** Text destined for stderr (argument errors carry the help text). */
  err?: string;
  /** `chronos open` only: the caller must keep the process alive while this
   *  server runs (and stop it on SIGINT/SIGTERM). */
  server?: Server;
}

/** Pure-ish dispatcher: argv tail → outcome. Never exits the process. */
export async function runCommand(
  cmd: string | undefined,
  rest: string[],
): Promise<RunResult> {
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") {
    return { out: buildHelpText() };
  }
  if (cmd === "-v" || cmd === "--version" || cmd === "version") {
    return { out: `\n  ${C.badgeIndigo(" CHRONOS ")} ${C.white(`v${VERSION}`)}\n\n` };
  }

  switch (cmd) {
    case "doctor": {
      const r = await doctorCommand(rest);
      return { out: r.message + "\n", code: r.exitCode };
    }
    case "replay": {
      const [capsule, scenario] = rest;
      if (!capsule) return usageError("replay requires a <capsule> path");
      const r = await replayCommand(capsule, scenario);
      return { out: r.message + "\n", code: r.exitCode };
    }
    case "trace": {
      const [capsule] = rest;
      if (!capsule) return usageError("trace requires a <capsule> path");
      const r = await traceCommand(capsule);
      return { out: r.lines.map((l) => l + "\n").join(""), code: r.exitCode };
    }
    case "sweep": {
      const [scenario, ...args] = rest;
      if (!scenario) return usageError("sweep requires a <scenario> module path");
      let seedsArg: string | undefined = args[0];
      for (const arg of args) {
        if (arg.startsWith("--seeds=")) seedsArg = arg.split("=")[1];
      }
      let seeds: number | undefined;
      if (seedsArg !== undefined) {
        const n = Number(seedsArg);
        if (!Number.isInteger(n) || n <= 0) {
          return usageError("sweep seeds must be a positive integer");
        }
        // `resolveSeeds` materializes the seed list before the first run, so an
        // unbounded count is an out-of-memory abort rather than a long sweep.
        if (n > MAX_SWEEP_SEEDS) {
          return usageError(`sweep seeds must be <= ${MAX_SWEEP_SEEDS} (got ${n})`);
        }
        seeds = n;
      }
      const r = await sweepCommand(scenario, seeds);
      const violating = r.violating.map((s) => `  violating seed: ${s}\n`).join("");
      return { out: r.message + "\n" + violating, code: r.exitCode };
    }
    case "shrink": {
      const [capsule, scenario] = rest;
      if (!capsule) return usageError("shrink requires a <capsule> path");
      const r = await shrinkCommand(capsule, scenario);
      return { out: r.message + "\n", code: r.exitCode };
    }
    case "open": {
      const [capsule] = rest;
      if (!capsule) return usageError("open requires a <capsule> path");
      const r = await openCommand(capsule, { serve: true });
      return {
        out: r.message + "\n",
        code: r.exitCode,
        ...(r.server !== undefined ? { server: r.server } : {}),
      };
    }
    case "explain": {
      const [capsule] = rest;
      if (!capsule) return usageError("explain requires a <capsule> path");
      const r = await explainCommand(capsule);
      return { out: r.message + "\n", code: r.exitCode };
    }
    case "stats": {
      const [capsule] = rest;
      if (!capsule) return usageError("stats requires a <capsule> path");
      const r = await statsCommand(capsule);
      return { out: r.message + "\n", code: r.exitCode };
    }
    case "check": {
      const r = await checkCommand(rest);
      return { out: r.message + "\n", code: r.exitCode };
    }
    case "export": {
      const [capsule] = rest;
      if (!capsule) return usageError("export requires a <capsule> path");

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
      return { out: r.message + "\n", code: r.exitCode };
    }
    default:
      return usageError(`unknown command "${cmd}"`);
  }
}

/** An argument error: message on stderr followed by the command reference. */
function usageError(msg: string): RunResult {
  return { err: `\n${C.badgeRose(" ERROR ")} ${C.rose(msg)}\n\n` + buildHelpText(), code: 2 };
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  const r = await runCommand(cmd, rest);
  if (r.out !== undefined) process.stdout.write(r.out);
  if (r.err !== undefined) process.stderr.write(r.err);
  if (r.code !== undefined) process.exitCode = r.code;
  // Keep the process alive while the inspector is served; stop cleanly on signal.
  if (r.server) {
    const stop = (): void => {
      r.server?.close();
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
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
