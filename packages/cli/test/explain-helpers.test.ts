// Tests for explain.ts's security-critical pure helpers: credential redaction
// (sanitizeSummary), endpoint scheme validation, and the loopback plaintext
// exception. These run before any network I/O — they are the guardrails that
// keep a hostile capsule from turning `chronos explain` into an exfiltration.

import { describe, it, expect } from "vitest";
import { sanitizeSummary, isLoopback } from "../src/explain.js";

describe("sanitizeSummary — credential redaction", () => {
  it("redacts JWTs by shape", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(sanitizeSummary(`token ${jwt}`)).toBe("token [REDACTED_JWT]");
  });

  it("redacts bearer/token/key/secret/password assignments", () => {
    expect(sanitizeSummary("bearer abc123")).toBe("bearer [REDACTED]");
    expect(sanitizeSummary("token=xyz")).toContain("[REDACTED]");
    expect(sanitizeSummary("api_key: hunter2")).toContain("[REDACTED]");
    expect(sanitizeSummary('password="p@ss"')).toContain("[REDACTED]");
  });

  it("does not double-redact already-redacted text", () => {
    const once = sanitizeSummary("bearer abc123");
    expect(sanitizeSummary(once)).toBe(once);
  });

  it("leaves ordinary prose alone", () => {
    expect(sanitizeSummary("node-0 sent increment to node-1")).toBe(
      "node-0 sent increment to node-1",
    );
  });

  it("strips ANSI/control sequences before redaction runs", () => {
    const spliced = "to\x1b[31mken=abc";
    const out = sanitizeSummary(spliced);
    expect(out).not.toContain("\x1b[");
    expect(out).toContain("[REDACTED]");
  });

  it("redacts JSON-serialized credentials and 80-char truncated JWTs from TraceLogger.summarize", () => {
    const jsonSummary = '{"token":"sk-live-secret","password":"pw123","apiKey":"k-999","secret":"s-1"}';
    const out = sanitizeSummary(jsonSummary);
    expect(out).not.toContain("sk-live-secret");
    expect(out).not.toContain("pw123");
    expect(out).not.toContain("k-999");
    expect(out).not.toContain("s-1");
    expect(out).toContain("[REDACTED]");

    const truncatedJwt = '{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZ…';
    const jwtOut = sanitizeSummary(truncatedJwt);
    expect(jwtOut).toContain("[REDACTED_JWT]");
    expect(jwtOut).not.toContain("eyJzdWIi");
  });
});

describe("isLoopback — the legitimate plaintext case", () => {
  it("accepts localhost forms", () => {
    for (const h of [
      "http://localhost:8080/v1",
      "http://127.0.0.1:11434/v1",
      "http://[::1]:8080/v1",
      "http://LOCALHOST:3000/v1",
    ]) {
      expect(isLoopback(new URL(h))).toBe(true);
    }
  });

  it("rejects non-loopback hosts", () => {
    for (const h of [
      "http://api.example.com/v1",
      "http://0.0.0.0:8080/v1",
      "https://internal.corp/v1",
    ]) {
      expect(isLoopback(new URL(h))).toBe(false);
    }
  });
});
