// Security regression tests for @sx4im/chronos-cli.
//
// The premise for all of these: a failure capsule is UNTRUSTED input. It is
// designed to be shared — attached to an issue, produced by CI, handed to a
// teammate — and then rendered by `chronos trace`, `chronos stats`, and
// `chronos export`. Every string in it (`summary`, `detail`, node ids) is
// attacker-chosen, and each renderer feeds a different sink with its own
// injection grammar: ANSI for the terminal, formulas for a spreadsheet, pipes
// and backticks for Markdown. `validateCapsule` bounds these fields' LENGTH,
// which does nothing to stop any of that — escaping has to happen per sink.
//
// Real fs/argv here is the harness, not simulated code: the prime directive's
// in-simulation entropy ban is untouched.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { traceCommand } from "../src/trace.js";
import { statsCommand } from "../src/stats.js";
import { exportCommand } from "../src/export.js";
import { replayCommand } from "../src/replay.js";
import { shrinkCommand } from "../src/shrink.js";
import { checkCommand } from "../src/check.js";
import { sweepCommand } from "../src/sweep.js";
import { resolveCapsulePath, resolveScenarioPath, CapsulePathRefused } from "../src/util.js";
import { sanitizeText, safeText, escapeCsvCell, escapeMarkdownCell } from "../src/sanitize.js";

const ESC = "\x1b";

let dir: string;
let prevChronosDir: string | undefined;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "chronos-cli-sec-"));
  prevChronosDir = process.env.CHRONOS_DIR;
  process.env.CHRONOS_DIR = dir;
});

afterAll(() => {
  if (prevChronosDir === undefined) delete process.env.CHRONOS_DIR;
  else process.env.CHRONOS_DIR = prevChronosDir;
  rmSync(dir, { recursive: true, force: true });
});

/** Write a capsule whose event strings are whatever the caller wants to smuggle
 *  through. Everything else is a minimal well-formed capsule. */
function hostileCapsule(name: string, payload: string): string {
  const capsule = {
    chronosVersion: "0.1.5",
    seed: "1",
    nodes: ["a", "b"],
    config: {
      network: { minLatency: 0, maxLatency: 10, dropProb: 0, dupProb: 0 },
      chaos: {
        partitionProb: 0,
        crashProb: 0,
        restartProb: 0,
        maxPartitionMs: 200,
        maxCrashFraction: 0.5,
      },
    },
    maxSteps: 100,
    invariant: { name: "inv", detail: payload },
    trace: {
      seed: "1",
      config: {},
      nodes: ["a", "b"],
      result: "violation",
      events: [
        { t: 0, seq: 0, kind: "send", from: "a", to: "b", summary: payload },
        { t: 1, seq: 1, kind: "deliver", from: "a", to: "b", summary: payload },
        { t: 2, seq: 2, kind: "invariant-violation", name: "inv", detail: payload },
      ],
    },
  };
  const p = join(dir, name);
  writeFileSync(p, JSON.stringify(capsule), "utf8");
  return p;
}

describe("sanitizeText — terminal control-sequence stripping", () => {
  it("removes SGR colors, cursor movement, and screen erasure", () => {
    expect(sanitizeText(`${ESC}[31mred${ESC}[0m`)).toBe("red");
    expect(sanitizeText(`before${ESC}[2J${ESC}[Hafter`)).toBe("beforeafter");
    expect(sanitizeText(`up${ESC}[10Aover`)).toBe("upover");
  });

  it("removes OSC sequences that retitle the terminal", () => {
    expect(sanitizeText(`${ESC}]0;pwned\x07ok`)).toBe("ok");
    expect(sanitizeText(`${ESC}]0;pwned${ESC}\\ok`)).toBe("ok");
  });

  it("removes carriage returns and newlines, which forge additional lines", () => {
    // \r rewinds to column 0 so the next characters overwrite what was printed.
    expect(sanitizeText("real\rfake")).toBe("realfake");
    expect(sanitizeText("line1\nline2")).toBe("line1line2");
  });

  it("removes a bare ESC and other C0/C1 controls but keeps tab", () => {
    expect(sanitizeText(`x${ESC}`)).toBe("x");
    expect(sanitizeText("a\x00\x07\x7f\x9bb")).toBe("ab");
    expect(sanitizeText("a\tb")).toBe("a\tb");
  });

  it("removes the single-byte C1 CSI (0x9b), not just the ESC[ form", () => {
    expect(sanitizeText("a\u009b31mb")).toBe("a31mb");
  });

  it("removes CSI sequences using the full ECMA-48 byte ranges", () => {
    // Parameter bytes are 0x30-0x3F (not just digits) and intermediates
    // 0x20-0x2F, so a private-use sequence like ESC[?25l must go too.
    expect(sanitizeText(`${ESC}[?25lhidden`)).toBe("hidden");
    expect(sanitizeText(`${ESC}[38;2;255;0;0mx`)).toBe("x");
    expect(sanitizeText(`${ESC}(Bplain`)).toBe("plain");
  });

  it("removes string-terminated sequences with their payload (OSC/DCS/APC)", () => {
    // The payload of a DCS/APC sequence is arbitrary text; dropping only the
    // introducer would leave it on screen looking like part of the trace.
    expect(sanitizeText(`${ESC}Pq#0;2;0;0;0${ESC}\\ok`)).toBe("ok");
    expect(sanitizeText(`${ESC}_payload${ESC}\\ok`)).toBe("ok");
    expect(sanitizeText(`${ESC}^msg${ESC}\\ok`)).toBe("ok");
  });

  it("removes bidi overrides (Trojan Source) and zero-width padding", () => {
    // U+202E makes `node-1 → node-2` render reversed — the same display
    // deception as an ANSI repaint, in a tool whose job is reporting facts.
    expect(sanitizeText("node-1 \u202e> 2-edon")).toBe("node-1 > 2-edon");
    expect(sanitizeText("a\u200b\u200c\u2060\ufeffb")).toBe("ab");
  });

  it("leaves ordinary text, unicode, and emoji untouched", () => {
    expect(sanitizeText("Append{term:2} → node-1 ✓ 日本語")).toBe("Append{term:2} → node-1 ✓ 日本語");
  });

  it("stays linear on adversarial input (no catastrophic backtracking)", () => {
    // Every quantified class in sanitizeText is disjoint from its neighbours,
    // so no input can be split between two of them. Pin that: a pathological
    // string built from the ambiguous-looking bytes must finish immediately.
    const evil = `${ESC}[` + ";".repeat(50_000) + "!".repeat(50_000);
    const started = Date.now();
    sanitizeText(evil);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("caps length so a renderer never depends on a bound enforced elsewhere", () => {
    expect(safeText("x".repeat(10_000), 100)).toHaveLength(101); // 100 + ellipsis
  });
});

describe("escapeCsvCell — spreadsheet formula injection", () => {
  // A capsule's summary lands in a CSV that is meant to be SHARED, and Excel /
  // LibreOffice / Sheets execute a cell whose first character is one of these.
  it.each(["=cmd|'/c calc'!A1", "+1+1", "-2+3", "@SUM(A1)", "\tlead"])(
    "neutralizes the formula lead in %j",
    (payload) => {
      const cell = escapeCsvCell(payload);
      const inner = cell.startsWith('"') ? cell.slice(1, -1) : cell;
      expect(inner.startsWith("'")).toBe(true);
    },
  );

  it("drops a carriage-return lead outright rather than prefixing it", () => {
    // A leading \r is both a formula trigger and a terminal control character;
    // sanitizeText removes it first, which leaves nothing to neutralize.
    expect(escapeCsvCell("\rlead")).toBe("lead");
  });

  // An anchored test against the very first character alone is sidestepped by
  // anything a spreadsheet skips over on its way to the `=`.
  it.each([
    [" =cmd|'/c calc'!A1", "leading whitespace, which spreadsheets skip"],
    ["\u200b=cmd|'/c calc'!A1", "a zero-width space"],
    ["\ufeff=cmd|'/c calc'!A1", "a byte-order mark"],
    ["  \t =cmd|'/c calc'!A1", "mixed invisible padding"],
  ])("neutralizes a formula hidden behind %j (%s)", (payload) => {
    const cell = escapeCsvCell(payload);
    const inner = cell.startsWith('"') ? cell.slice(1, -1) : cell;
    expect(inner.startsWith("'")).toBe(true);
  });

  it("still quotes and doubles per RFC 4180", () => {
    expect(escapeCsvCell('has,comma')).toBe('"has,comma"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("leaves an ordinary cell unquoted and unprefixed", () => {
    expect(escapeCsvCell("Append term=2")).toBe("Append term=2");
  });
});

describe("escapeMarkdownCell — table and code-span breakout", () => {
  it("escapes pipes, backticks, and other structural characters", () => {
    expect(escapeMarkdownCell("a|b")).toBe("a\\|b");
    expect(escapeMarkdownCell("`code`")).toBe("\\`code\\`");
    expect(escapeMarkdownCell("<img src=x>")).toBe("\\<img src=x\\>");
  });
});

describe("chronos trace — untrusted capsule text reaches the terminal", () => {
  it("emits no escape sequences for a capsule full of them", async () => {
    // Repaint earlier output and claim the run was clean. Unescaped, this is a
    // trace viewer that can be made to lie about what it found.
    const p = hostileCapsule("ansi.json", `${ESC}[2J${ESC}[H0 violations found${ESC}[0m`);
    const r = await traceCommand(p);
    expect(r.exitCode).toBe(0);
    const out = r.lines.join("\n");
    expect(out).not.toContain(ESC);
    expect(out).not.toContain("\r");
    expect(out).toContain("0 violations found"); // text survives, control does not
  });

  it("keeps one line per event when a summary contains newlines", async () => {
    const p = hostileCapsule("nl.json", "real\nt=999 seq=999 forged");
    const r = await traceCommand(p);
    // Header + 3 events, and not one more.
    expect(r.lines).toHaveLength(4);
  });

  it("refuses a capsule whose trace envelope is incomplete instead of crashing", async () => {
    // Before the trace envelope was validated, `trace.nodes` being absent threw
    // a raw TypeError out of formatTraceLines.
    const p = join(dir, "no-nodes.json");
    const c = JSON.parse(readFileSync(hostileCapsule("src.json", "x"), "utf8")) as {
      trace: Record<string, unknown>;
    };
    delete c.trace.nodes;
    writeFileSync(p, JSON.stringify(c), "utf8");
    const r = await traceCommand(p);
    expect(r.exitCode).toBe(2);
    expect(r.lines.join("\n")).toMatch(/could not read capsule/);
  });

  it("refuses a capsule with an unknown event kind", async () => {
    const p = join(dir, "bad-kind.json");
    const c = JSON.parse(readFileSync(hostileCapsule("src2.json", "x"), "utf8")) as {
      trace: { events: unknown[] };
    };
    c.trace.events = [{ t: 0, seq: 0, kind: "not-a-kind" }];
    writeFileSync(p, JSON.stringify(c), "utf8");
    const r = await traceCommand(p);
    expect(r.exitCode).toBe(2);
  });
});

describe("chronos stats / export — the other untrusted sinks", () => {
  it("stats emits no escape sequences from capsule text", async () => {
    const p = hostileCapsule("ansi-stats.json", `${ESC}[31mred${ESC}[2J`);
    const r = await statsCommand(p);
    expect(r.exitCode).toBe(0);
    // The CLI's own coloring is disabled off-TTY, so any ESC left is injected.
    expect(r.message).not.toContain(`${ESC}[2J`);
  });

  it("export --csv neutralizes a formula smuggled in a summary", async () => {
    const p = hostileCapsule("csv.json", "=cmd|'/c calc'!A1");
    const out = join(dir, "out.csv");
    const r = await exportCommand(p, { format: "csv", output: out });
    expect(r.exitCode).toBe(0);
    const csv = readFileSync(out, "utf8");
    expect(csv).toContain("'=cmd");
    expect(csv).not.toMatch(/(^|,)=cmd/m);
  });

  it("export --markdown keeps a hostile summary inside its own cell", async () => {
    const p = hostileCapsule("md.json", "x | forged | row");
    const out = join(dir, "out.md");
    const r = await exportCommand(p, { format: "markdown", output: out });
    expect(r.exitCode).toBe(0);
    const md = readFileSync(out, "utf8");
    expect(md).toContain("x \\| forged \\| row");
    for (const line of md.split("\n")) {
      if (!line.startsWith("| ") || line.startsWith("|---")) continue;
      // Escaped pipes render as literal text, so drop them before counting the
      // structural ones: the table declares 5 columns and must never grow.
      const columns = line.replace(/\\\|/g, "").split("|").filter((s) => s !== "");
      expect(columns).toHaveLength(5);
    }
  });
});

describe("chronos check — directory walk", () => {
  it("terminates on a symlink cycle instead of recursing forever", async () => {
    // `stat()` follows links, so `ln -s .. loop` inside a scanned tree used to
    // make the walk recurse until the stack blew — taking `chronos doctor`,
    // which calls check, down with it.
    const root = mkdtempSync(join(tmpdir(), "chronos-symlink-"));
    try {
      const sub = join(root, "src");
      mkdirSync(sub);
      writeFileSync(join(sub, "ok.ts"), "export const a = 1;\n", "utf8");
      symlinkSync(root, join(sub, "loop"), "dir");
      const r = await checkCommand([root]);
      expect(r.exitCode).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 10_000);
});

describe("chronos sweep — scenario path confinement", () => {
  it("refuses to import a scenario from outside the allowed roots", async () => {
    // Importing a module executes it. `replay` and `shrink` already confined
    // scenario paths; sweep was the one command that did not.
    const outside = mkdtempSync(join(tmpdir(), "chronos-outside-"));
    try {
      const scenario = join(outside, "evil.mjs");
      writeFileSync(scenario, "export const nodes = 1; export const body = () => {};\n", "utf8");
      const r = await sweepCommand(scenario, 1);
      expect(r.exitCode).toBe(2);
      expect(r.message).toMatch(/outside the allowed directories/);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("refuses symlinked capsules and scenarios that escape the allowed roots", () => {
    const outside = mkdtempSync(join(tmpdir(), "chronos-outside-sym-"));
    try {
      const extCap = join(outside, "secret.json");
      writeFileSync(extCap, "{}", "utf8");
      const linkCap = join(dir, "link-cap.json");
      symlinkSync(extCap, linkCap);
      expect(() => resolveCapsulePath(linkCap)).toThrow(CapsulePathRefused);

      const extScen = join(outside, "scen.mjs");
      writeFileSync(extScen, "export const body = () => {};\n", "utf8");
      const linkScen = join(dir, "link-scen.mjs");
      symlinkSync(extScen, linkScen);
      expect(() => resolveScenarioPath(linkScen)).toThrow(CapsulePathRefused);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it("refuses export --output outside allowed roots or through a symlink", async () => {
    const p = hostileCapsule("exp-confine.json", "ok");
    const outside = mkdtempSync(join(tmpdir(), "chronos-outside-exp-"));
    try {
      const outsideTarget = join(outside, "pwned.md");
      const r1 = await exportCommand(p, { format: "markdown", output: outsideTarget });
      expect(r1.exitCode).toBe(2);

      const symOut = join(dir, "sym-out.md");
      writeFileSync(outsideTarget, "original", "utf8");
      symlinkSync(outsideTarget, symOut);
      const r2 = await exportCommand(p, { format: "markdown", output: symOut });
      expect(r2.exitCode).toBe(2);
      expect(readFileSync(outsideTarget, "utf8")).toBe("original");
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("chronos replay / shrink — terminal escape stripping", () => {
  it("strips ANSI/OSC/CR sequences from invariant name, detail, and nodes in replay and shrink", async () => {
    const p = hostileCapsule("ansi-replay.json", `${ESC}[2J${ESC}[H0 violations\rforged`);
    const c = JSON.parse(readFileSync(p, "utf8")) as {
      invariant: { name: string; detail: string };
      nodes: string[];
    };
    c.invariant.name = `inv${ESC}]0;PWNED\x07`;
    c.nodes = [`a\rFORGED`, "b"];
    writeFileSync(p, JSON.stringify(c), "utf8");

    const rep = await replayCommand(p);
    expect(rep.exitCode).toBe(0);
    expect(rep.message).not.toContain(ESC);
    expect(rep.message).not.toContain("\r");

    const scen = join(dir, "noop-scen.mjs");
    writeFileSync(scen, "export const body = () => {};\n", "utf8");
    const shr = await shrinkCommand(p, scen);
    expect(shr.exitCode).toBe(1);
    expect(shr.message).not.toContain(ESC);
  });

  it("counts partition-dropped deliveries as dropped rather than delivered/duplicated in stats", async () => {
    const p = hostileCapsule("part-drop.json", "ping");
    const c = JSON.parse(readFileSync(p, "utf8")) as {
      trace: { events: unknown[] };
    };
    c.trace.events = [
      { t: 0, seq: 0, kind: "send", from: "a", to: "b", summary: "ping" },
      { t: 5, seq: 1, kind: "deliver", from: "a", to: "b", summary: "dropped by partition ping" },
    ];
    writeFileSync(p, JSON.stringify(c), "utf8");
    const st = await statsCommand(p);
    expect(st.exitCode).toBe(0);
    expect(st.message).toContain("(0 delivered)");
    expect(st.message).toContain("(1 dropped)");
    expect(st.message).toContain("(0 duplicated)");
  });
});
