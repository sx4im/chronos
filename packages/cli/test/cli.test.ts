// Integration tests for the @sx4im/chronos-cli (Phase 3.4). The replay/trace/sweep/
// open/explain commands are pure functions returning { exitCode, message, ... };
// the bin (src/index.ts) is a thin argv dispatcher over them, so we test the
// command fns directly. Scenario fixtures live in ./fixtures.
//
// Capsule output goes to a shared temp dir (mkdtemp under os.tmpdir) — real fs
// out here, never inside a simulation, so the prime directive's in-sim entropy
// ban is untouched. `CHRONOS_DIR` points sweep's capsule writes at that same dir
// so tests don't pollute the repo's `.chronos/`.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { request as httpRequest, type IncomingHttpHeaders } from "node:http";
import { runSimTest, readCapsule } from "@sx4im/chronos-vitest/engine";
import { replayCommand, loadScenario } from "../src/replay.js";
import { sweepCommand, sweepSeeds } from "../src/sweep.js";
import { shrinkCommand } from "../src/shrink.js";
import { traceCommand } from "../src/trace.js";
import { openCommand } from "../src/open.js";
import { explainCommand } from "../src/explain.js";
import { statsCommand } from "../src/stats.js";
import { checkCommand } from "../src/check.js";
import { exportCommand } from "../src/export.js";
import { resolveCapsulePath, capsuleReadError, CapsulePathRefused, toFileUrl } from "../src/util.js";
import { replayCapsule } from "@sx4im/chronos-vitest/engine";
import { body, netFactory, nodes } from "./fixtures/counterScenario.js";

// Fire a raw HTTP/1.1 request with a chosen Host header. The server's
// DNS-rebinding defense (B6) checks `req.headers.host`, which undici's `fetch`
// forbids setting — so these tests use node:http directly to impersonate a
// non-loopback host.
function rawGet(
  port: number,
  urlPath: string,
  hostHeader: string,
): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { hostname: "127.0.0.1", port, path: urlPath, method: "GET", headers: { Host: hostHeader } },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => {
          body += c;
        });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtureFaulty = path.resolve(__dirname, "fixtures/counterScenario.ts");
const fixtureReliable = path.resolve(__dirname, "fixtures/reliableScenario.ts");
const fixtureNoBody = path.resolve(__dirname, "fixtures/noBodyScenario.ts");

let dir: string;
let capsulePath: string;
let prevChronosDir: string | undefined;
let prevNimKey: string | undefined;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "chronos-cli-"));
  prevChronosDir = process.env.CHRONOS_DIR;
  process.env.CHRONOS_DIR = dir;
  // Produce a known-failing capsule from the buggy counter via the engine.
  const out = await runSimTest({ seeds: 100, nodes, netFactory, chronosDir: dir }, body);
  expect(out.violated).toBe(true);
  capsulePath = out.capsulePath!;
});

afterAll(() => {
  if (prevChronosDir === undefined) delete process.env.CHRONOS_DIR;
  else process.env.CHRONOS_DIR = prevChronosDir;
  if (prevNimKey === undefined) delete process.env.NVIDIA_API_KEY;
  else process.env.NVIDIA_API_KEY = prevNimKey;
  rmSync(dir, { recursive: true, force: true });
});

describe("chronos replay", () => {
  it("without a scenario: reports the recorded result and how to reproduce", async () => {
    const r = await replayCommand(capsulePath);
    expect(r.exitCode).toBe(0);
    expect(r.reproduced).toBe(false);
    expect(r.message).toContain("violation");
    expect(r.message).toContain("all counts equal");
    expect(r.message).toContain(capsulePath);
  });

  it("with the faulty scenario: reproduces the violation (bit-identical trace)", async () => {
    const r = await replayCommand(capsulePath, fixtureFaulty);
    expect(r.exitCode).toBe(0);
    expect(r.reproduced).toBe(true);
    expect(r.message).toContain("reproduced");
  });

  it("with a mismatched (reliable) scenario: does NOT reproduce (exit 1)", async () => {
    const r = await replayCommand(capsulePath, fixtureReliable);
    expect(r.exitCode).toBe(1);
    expect(r.reproduced).toBe(false);
    expect(r.message).toContain("could NOT reproduce");
  });

  it("fails gracefully on a missing capsule (exit 2)", async () => {
    const r = await replayCommand(join(dir, "nope.json"));
    expect(r.exitCode).toBe(2);
    expect(r.message).toContain("could not read capsule");
  });

  it("fails gracefully on a scenario with no body (exit 2)", async () => {
    const r = await replayCommand(capsulePath, fixtureNoBody);
    expect(r.exitCode).toBe(2);
    expect(r.message).toContain("could not import scenario");
    expect(r.message).toContain("did not export a `body`");
  });
});

describe("chronos sweep", () => {
  it("sweepSeeds directly: finds violators and writes the first capsule", async () => {
    const r = await sweepSeeds({ body, nodes, seeds: 60, netFactory, chronosDir: dir });
    expect(r.exitCode).toBe(0);
    expect(r.runs).toBe(60);
    expect(r.violating.length).toBeGreaterThanOrEqual(1);
    expect(r.firstCapsulePath).toBeDefined();
    expect(existsSync(r.firstCapsulePath!)).toBe(true);
  });

  it("sweepCommand: loads the faulty scenario and finds violators", async () => {
    const r = await sweepCommand(fixtureFaulty, 60);
    expect(r.exitCode).toBe(0);
    expect(r.runs).toBe(60);
    expect(r.violating.length).toBeGreaterThanOrEqual(1);
    expect(r.firstCapsulePath).toBeDefined();
    expect(existsSync(r.firstCapsulePath!)).toBe(true);
  });

  it("a reliable scenario sweeps clean (no violators)", async () => {
    const r = await sweepCommand(fixtureReliable, 30);
    expect(r.exitCode).toBe(0);
    expect(r.runs).toBe(30);
    expect(r.violating).toEqual([]);
    expect(r.firstCapsulePath).toBeUndefined();
  });

  it("fails gracefully on a scenario with no body (exit 2, 0 runs)", async () => {
    const r = await sweepCommand(fixtureNoBody, 10);
    expect(r.exitCode).toBe(2);
    expect(r.runs).toBe(0);
    expect(r.message).toContain("could not import scenario");
  });
});

describe("chronos trace", () => {
  it("pretty-prints the capsule timeline", async () => {
    const r = await traceCommand(capsulePath);
    expect(r.exitCode).toBe(0);
    expect(r.lines.length).toBeGreaterThan(1);
    expect(r.lines[0]).toContain("seed");
  });

  it("fails gracefully on a missing capsule (exit 2)", async () => {
    const r = await traceCommand(join(dir, "nope.json"));
    expect(r.exitCode).toBe(2);
    expect(r.lines[0]).toContain("could not read capsule");
  });
});

describe("chronos open", () => {
  it("validates the capsule and points at the inspector (no serve)", async () => {
    const r = await openCommand(capsulePath);
    expect(r.exitCode).toBe(0);
    expect(r.message).toContain("inspector");
    expect(r.message).toContain(capsulePath);
  });

  it("fails gracefully on a missing capsule (exit 2)", async () => {
    const r = await openCommand(join(dir, "nope.json"));
    expect(r.exitCode).toBe(2);
    expect(r.message).toContain("could not read capsule");
  });

  it("serves the inspector and exposes the capsule at /capsule (serve: true)", async () => {
    // Point the inspector dist at a tmp dir with a stub index.html so the command
    // doesn't depend on a real build having run. We bind a live server, fetch both
    // routes, then close it in finally so no socket leaks across tests.
    const tmpDist = join(dir, "inspector-dist");
    mkdirSync(tmpDist, { recursive: true });
    writeFileSync(join(tmpDist, "index.html"), "<!doctype html><title>chronos</title>");
    const prev = process.env.CHRONOS_INSPECTOR_DIST;
    process.env.CHRONOS_INSPECTOR_DIST = tmpDist;
    let r: Awaited<ReturnType<typeof openCommand>>;
    try {
      r = await openCommand(capsulePath, { serve: true });
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_INSPECTOR_DIST;
      else process.env.CHRONOS_INSPECTOR_DIST = prev;
    }
    expect(r.exitCode).toBe(0);
    expect(r.url).toMatch(/^http:\/\/localhost:\d+\/\?capsule=%2Fcapsule$/);
    const port = r.url!.match(/localhost:(\d+)/)![1]!;
    try {
      // The inspector shell (SPA fallback not needed for `/`).
      const html = await (await fetch(`http://localhost:${port}/`)).text();
      expect(html).toContain("chronos");
      // The preload endpoint streams the capsule JSON verbatim.
      const cap = await readCapsule(capsulePath);
      const served = (await (await fetch(`http://localhost:${port}/capsule`)).json()) as {
        seed: string;
        trace: { seed: string };
      };
      expect(served.seed).toBe(cap.seed);
      expect(served.trace.seed).toBe(cap.trace.seed);
    } finally {
      r.server?.close();
    }
  });
});

describe("chronos explain", () => {
  const clearKeys = () => {
    delete process.env.NVIDIA_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.XAI_API_KEY;
    delete process.env.MISTRAL_API_KEY;
    delete process.env.TOGETHER_API_KEY;
    delete process.env.FIREWORKS_API_KEY;
    delete process.env.CEREBRAS_API_KEY;
    delete process.env.PERPLEXITY_API_KEY;
    delete process.env.DASHSCOPE_API_KEY;
    delete process.env.QWEN_API_KEY;
    delete process.env.NOVITA_API_KEY;
    delete process.env.HYPERBOLIC_API_KEY;
    delete process.env.OLLAMA_BASE_URL;
    delete process.env.OLLAMA_MODEL;
    delete process.env.LMSTUDIO_BASE_URL;
    delete process.env.LM_STUDIO_BASE_URL;
    delete process.env.LLM_BASE_URL;
    delete process.env.CHRONOS_EXPLAIN_BASE_URL;
  };

  it("is a friendly no-op when no AI provider key is set", async () => {
    clearKeys();
    const r = await explainCommand(capsulePath);
    expect(r.exitCode).toBe(0);
    expect(r.message.toLowerCase()).toContain("openrouter");
  });

  it("fails gracefully on a missing capsule (exit 2) even with a key set", async () => {
    process.env.NVIDIA_API_KEY = "test-key";
    const r = await explainCommand(join(dir, "nope.json"));
    expect(r.exitCode).toBe(2);
    expect(r.message).toContain("could not read capsule");
  });

  it("sanitizes sensitive tokens in message payload summaries prior to sending to NIM", async () => {
    process.env.NVIDIA_API_KEY = "test-key";

    // Build a synthetic capsule containing a sensitive token in a send trace event summary
    const fakeCapsulePath = join(dir, "sensitive.json");
    const fakeCapsule = {
      chronosVersion: "0.1.0",
      seed: "123",
      nodes: ["node-0", "node-1"],
      config: {
        network: { minLatency: 1, maxLatency: 5, dropProb: 0, dupProb: 0 },
        chaos: { partitionProb: 0, crashProb: 0, restartProb: 0, maxPartitionMs: 100, maxCrashFraction: 0.5 },
      },
      maxSteps: 100,
      invariant: { name: "test-inv", detail: "failed" },
      trace: {
        seed: "123",
        config: {},
        nodes: ["node-0", "node-1"],
        result: "violation" as const,
        events: [
          {
            kind: "send" as const,
            from: "node-0",
            to: "node-1",
            summary: "token=secret123 bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature",
            t: 0,
            seq: 0,
          },
          {
            kind: "invariant-violation" as const,
            name: "test-inv",
            detail: "failed",
            t: 1,
            seq: 1,
          },
        ],
      },
    };
    writeFileSync(fakeCapsulePath, JSON.stringify(fakeCapsule), "utf8");

    // Intercept fetch call to verify prompt sanitization
    const origFetch = globalThis.fetch;
    let sentPrompt = "";
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      if (typeof init?.body === "string") {
        const bodyObj = JSON.parse(init.body) as { messages?: { content?: string }[] };
        sentPrompt = bodyObj.messages?.[0]?.content ?? "";
      }
      return new Response(JSON.stringify({ choices: [{ message: { content: "Root cause analysis" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof globalThis.fetch;

    try {
      const r = await explainCommand(fakeCapsulePath);
      expect(r.exitCode).toBe(0);
      expect(r.message).toContain("Root cause analysis");
      expect(sentPrompt).toContain("[REDACTED]");
      expect(sentPrompt).toContain("[REDACTED_JWT]");
      expect(sentPrompt).not.toContain("secret123");
    } finally {
      globalThis.fetch = origFetch;
    }
  });
});

describe("loadScenario", () => {
  it("loads a scenario module exporting { body, netFactory }", async () => {
    const s = await loadScenario(fixtureFaulty);
    expect(typeof s.body).toBe("function");
    expect(s.netFactory).toBeDefined();
  });

  it("throws on a module with no body", async () => {
    await expect(loadScenario(fixtureNoBody)).rejects.toThrow("body");
  });
});

// toFileUrl rejects non-file: URL schemes so a hypothetical attacker argv
// can never make `import()` execute remote / in-memory code (`data:` URLs in
// particular are executed by Node's ESM loader). Legit scenarios are paths.
describe("toFileUrl — non-file: schemes rejected (B7)", () => {
  it("resolves a bare relative path to a file:// URL", () => {
    const u = toFileUrl("relative-under-cwd.ts");
    expect(u.startsWith("file://")).toBe(true);
  });

  it("passes through a file:// URL verbatim", () => {
    const u = toFileUrl("file:///tmp/something.ts");
    expect(u).toBe("file:///tmp/something.ts");
  });

  it("rejects https:// (remote module would not load anyway, but reject up front)", () => {
    expect(() => toFileUrl("https://evil.example.com/scenario.js")).toThrow(/not allowed/);
  });

  it("rejects data:text/javascript (the dangerous one — ESM executes it)", () => {
    expect(() => toFileUrl("data:text/javascript,export%20default%201")).toThrow(/not allowed/);
  });

  it("rejects node: built-ins (scenario modules are local user code, not built-ins)", () => {
    expect(() => toFileUrl("node:fs")).toThrow(); // ":" triggers scheme path
  });
});

// Capsule path confinement (security audit B4): a capsule file is untrusted
// shared input and a CLI capsule-path argv is untrusted input. resolveCapsulePath
// refuses to resolve a path outside an allow-list of roots (cwd, CHRONOS_DIR,
// CHRONOS_CAPSULE_DIR) so a misdirected `chronos replay /etc/passwd` (or a
// `../../etc/passwd` relative escape) is closed before the capsule reader opens
// it — and the resulting error never echoes the full absolute path.
describe("capsule path confinement + safe errors (B4)", () => {
  it("refuses an absolute path outside every allowed root", () => {
    expect(() => resolveCapsulePath("/etc/passwd")).toThrow(CapsulePathRefused);
    // The message is confined to a safe basename — never the full /etc/passwd.
    try {
      resolveCapsulePath("/etc/passwd");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      expect(msg).toContain("passwd"); // basename only
      expect(msg).not.toContain("/etc/passwd"); // full path must not leak
    }
  });

  it("refuses a relative path that escapes the allowed roots", () => {
    // `..` chains resolving above cwd → rejected by the relative() check.
    expect(() => resolveCapsulePath("../../../etc/passwd")).toThrow(CapsulePathRefused);
    expect(() => resolveCapsulePath("../../../../etc/passwd")).toThrow(CapsulePathRefused);
  });

  it("allows a capsule under CHRONOS_DIR (used by the suite itself)", () => {
    const underDir = join(dir, "sub", "deep", "5.json");
    expect(resolveCapsulePath(underDir)).toBe(underDir);
  });

  it("allows a relative path under cwd", () => {
    // Resolve does not require the file to exist; it only confines the path.
    const resolved = resolveCapsulePath("relative-under-cwd.json");
    expect(path.isAbsolute(resolved)).toBe(true);
  });

  it("CHRONOS_ALLOW_OUTSIDE_CAPSULES=1 opts out of confinement (power-user)", () => {
    const prev = process.env.CHRONOS_ALLOW_OUTSIDE_CAPSULES;
    try {
      process.env.CHRONOS_ALLOW_OUTSIDE_CAPSULES = "1";
      expect(resolveCapsulePath("/etc/passwd")).toBe("/etc/passwd");
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_ALLOW_OUTSIDE_CAPSULES;
      else process.env.CHRONOS_ALLOW_OUTSIDE_CAPSULES = prev;
    }
  });

  it("capsuleReadError maps ENOENT to 'file not found' (no absolute path)", () => {
    const msg = capsuleReadError("/some/secret/path/cap.json", { code: "ENOENT" });
    expect(msg).toContain("could not read capsule");
    expect(msg).toContain("file not found");
    expect(msg).toContain("cap.json"); // basename only
    expect(msg).not.toContain("/some/secret/path/cap.json"); // no full path
  });

  it("capsuleReadError never echoes a generic error's message", () => {
    const msg = capsuleReadError("cap.json", new Error("sensitive stack /tmp/secret"));
    expect(msg).toContain("unreadable or not accessible");
    expect(msg).not.toContain("sensitive");
    expect(msg).not.toContain("/tmp/secret");
  });

  it("replayCommand refuses /etc/passwd with a content-free 'could not read capsule' (exit 2)", async () => {
    const r = await replayCommand("/etc/passwd");
    expect(r.exitCode).toBe(2);
    expect(r.message).toContain("could not read capsule");
    expect(r.message).not.toContain("/etc/passwd"); // full path must not leak
  });
});

// Inspector server hardening (security audit B6): the `chronos open` HTTP
// server is bound to 127.0.0.1, but a DNS-rebinding page can still make a
// victim's browser reach it cross-origin with the attacker's domain in Host.
// The loopback-Host check rejects that before any file read. Every response
// carries `x-content-type-options: nosniff` and a `connect-src 'self'` CSP, and
// any internal error returns a content-free "internal error" body.
describe("chronos open — server hardening (B6)", () => {
  it("rejects a non-loopback Host, and emits nosniff + CSP on /capsule", async () => {
    const tmpDist = join(dir, "inspector-dist-hardened");
    mkdirSync(tmpDist, { recursive: true });
    writeFileSync(join(tmpDist, "index.html"), "<!doctype html><title>chronos</title>");
    const prev = process.env.CHRONOS_INSPECTOR_DIST;
    process.env.CHRONOS_INSPECTOR_DIST = tmpDist;
    let r: Awaited<ReturnType<typeof openCommand>>;
    try {
      r = await openCommand(capsulePath, { serve: true });
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_INSPECTOR_DIST;
      else process.env.CHRONOS_INSPECTOR_DIST = prev;
    }
    const port = Number(r.url!.match(/localhost:(\d+)/)![1]!);
    try {
      // Non-loopback Host → rejected before any handler logic runs.
      const attacker = await rawGet(port, "/", "attacker.com");
      expect(attacker.status).toBe(403);
      expect(attacker.body).toBe("forbidden host");

      // Loopback hosts still serve the bundle.
      const local = await rawGet(port, "/", "localhost");
      expect(local.status).toBe(200);
      const ip = await rawGet(port, "/", "127.0.0.1");
      expect(ip.status).toBe(200);

      // The preload endpoint carries the security headers.
      const capRes = await fetch(`http://localhost:${port}/capsule`);
      expect(capRes.headers.get("content-type")).toContain("application/json");
      expect(capRes.headers.get("x-content-type-options")).toBe("nosniff");
      expect(capRes.headers.get("referrer-policy")).toBe("no-referrer");
      const csp = capRes.headers.get("content-security-policy") ?? "";
      expect(csp).toContain("connect-src 'self'");
      // script-src must be 'self'-only — NO 'unsafe-inline' (the XSS-relevant
      // directive; inline script is blocked in production per the audit).
      const scriptSrc = csp.match(/script-src\s+([^;]+)/i)?.[1] ?? "";
      expect(scriptSrc).toContain("'self'");
      expect(scriptSrc).not.toContain("unsafe-inline");
      // style-src LEGITIMATELY keeps 'unsafe-inline' — React applies timeline /
      // diagram swatch colors via inline `style` attributes. This is by design.
      const styleSrc = csp.match(/style-src\s+([^;]+)/i)?.[1] ?? "";
      expect(styleSrc).toContain("'self'");
      expect(styleSrc).toContain("unsafe-inline");
    } finally {
      r.server?.close();
    }
  });

  it("responds to an internal error with a content-free 500 (text/plain, nosniff)", async () => {
    const tmpDist = join(dir, "inspector-dist-500");
    mkdirSync(tmpDist, { recursive: true });
    // Deliberately NO index.html: a request to a missing path falls through to
    // the SPA fallback, whose readFile(index.html) throws → catch → 500.
    const prev = process.env.CHRONOS_INSPECTOR_DIST;
    process.env.CHRONOS_INSPECTOR_DIST = tmpDist;
    let r: Awaited<ReturnType<typeof openCommand>>;
    try {
      r = await openCommand(capsulePath, { serve: true });
    } finally {
      if (prev === undefined) delete process.env.CHRONOS_INSPECTOR_DIST;
      else process.env.CHRONOS_INSPECTOR_DIST = prev;
    }
    const port = Number(r.url!.match(/localhost:(\d+)/)![1]!);
    try {
      const got = await fetch(`http://localhost:${port}/a-missing-deep-link`);
      expect(got.status).toBe(500);
      const text = await got.text();
      expect(text).toBe("internal error"); // content-free — no path, no stack, no bytes
      expect(got.headers.get("content-type")).toContain("text/plain");
      expect(got.headers.get("x-content-type-options")).toBe("nosniff");
    } finally {
      r.server?.close();
    }
  });
});

// chronos shrink (Phase 5.2, §3.9 — advanced / experimental): reduce a failing
// capsule's fault config to the smallest value that still reproduces the SAME
// invariant violation, writing a `<seed>.shrunk.json` sibling. The counter
// capsule here was produced with no chaos + the default 100_000-step cap, so the
// only reducible knob is `maxSteps` (the capsule's chaos is already 0). The
// shrinker binary-searches the smallest cap at which the queue still drains and
// the counts still diverge — a smaller, more actionable capsule. The shrunk
// capsule must itself reproduce (the replay proof) with the SAME netFactory.
describe("chronos shrink", () => {
  it("reduces maxSteps on the real counter capsule and writes a reproducing shrunk sibling", async () => {
    const r = await shrinkCommand(capsulePath, fixtureFaulty);
    expect(r.exitCode).toBe(0);
    expect(r.shrunkPath).toBeDefined();
    expect(existsSync(r.shrunkPath!)).toBe(true);
    expect(r.shrunkPath).toMatch(/\.shrunk\.json$/);
    // The original capsule is untouched (the shrunk file is a sibling, not an overwrite).
    expect(existsSync(capsulePath)).toBe(true);
    // maxSteps is the only reducible knob here (chaos was 0 in the capsule) — it
    // must have decreased from the default 100_000 to the drain step of the run.
    // The shrunk capsule re-plays bit-identically with the SAME netFactory — the
    // determinism proof holds at the reduced cap, not just the original.
    const rep = await replayCapsule(r.shrunkPath!, body, netFactory);
    expect(rep.reproduced).toBe(true);
  });

  it("without a scenario: prints the shrink help (needs the scenario to re-run, exit 0)", async () => {
    const r = await shrinkCommand(capsulePath);
    expect(r.exitCode).toBe(0);
    expect(r.message.toLowerCase()).toContain("shrink");
    expect(r.message).toContain("scenario");
    expect(r.shrunkPath).toBeUndefined();
  });

  it("with a mismatched (reliable) scenario: does NOT reproduce (exit 1, no shrunk file)", async () => {
    const r = await shrinkCommand(capsulePath, fixtureReliable);
    expect(r.exitCode).toBe(1);
    expect(r.shrunkPath).toBeUndefined();
    expect(r.message).toContain("could NOT reproduce");
  });

  it("refuses /etc/passwd with a content-free 'could not read capsule' (B4, exit 2)", async () => {
    const r = await shrinkCommand("/etc/passwd", fixtureFaulty);
    expect(r.exitCode).toBe(2);
    expect(r.message).toContain("could not read capsule");
    expect(r.message).not.toContain("/etc/passwd"); // full path must not leak
  });
});

describe("chronos stats", () => {
  it("prints stats of the capsule", async () => {
    const r = await statsCommand(capsulePath);
    expect(r.exitCode).toBe(0);
    expect(r.message).toContain("CHRONOS TRACE STATS");
    expect(r.message).toContain("Seed");
    expect(r.message).toContain("Network Sends");
  });

  it("fails on missing capsule", async () => {
    const r = await statsCommand(join(dir, "nope.json"));
    expect(r.exitCode).toBe(2);
    expect(r.message).toContain("could not read capsule");
  });
});

describe("chronos check", () => {
  it("scans files and detects no issues in a clean directory", async () => {
    const r = await checkCommand([join(__dirname, "../src")]);
    expect(r.exitCode).toBe(0);
    expect(r.message).toContain("No non-deterministic globals detected");
  });

  it("detects non-deterministic usage in a custom test string", async () => {
    const tempFile = join(dir, "violation-file.ts");
    writeFileSync(tempFile, "const x = Math.random();\nconst y = Date.now();", "utf8");
    const r = await checkCommand([tempFile]);
    expect(r.exitCode).toBe(1);
    expect(r.message).toContain("potential DST compliance issues");
    expect(r.message).toContain("Math.random()");
    expect(r.message).toContain("Date.now()");
  });
});

describe("chronos export", () => {
  it("exports trace to markdown format", async () => {
    const mdFile = join(dir, "export.md");
    const r = await exportCommand(capsulePath, { format: "markdown", output: mdFile });
    expect(r.exitCode).toBe(0);
    expect(existsSync(mdFile)).toBe(true);
  });

  it("exports trace to csv format", async () => {
    const csvFile = join(dir, "export.csv");
    const r = await exportCommand(capsulePath, { format: "csv", output: csvFile });
    expect(r.exitCode).toBe(0);
    expect(existsSync(csvFile)).toBe(true);
  });
});
