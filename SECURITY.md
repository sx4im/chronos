# Security Policy

## Reporting a vulnerability

Please report security issues privately via [GitHub Security Advisories](https://github.com/sx4im/chronos/security/advisories/new) rather than a public issue.

## The threat model

Chronos is a developer tool. It runs on developer laptops and CI runners, and it has no server component and no user accounts. That shapes what "a vulnerability" means here.

### A failure capsule is untrusted input

A capsule (`.chronos/failures/<seed>.json`) exists to be shared (attached to a GitHub issue, produced by someone else's CI, handed to a teammate) and then opened with `chronos trace`, `chronos stats`, `chronos export`, `chronos replay`, `chronos shrink`, or the Inspector.

Chronos treats every capsule as untrusted input:

- **Validated at the read boundary.** `readCapsule` caps file size before reading (128 MB default; `CHRONOS_MAX_CAPSULE_BYTES` raises it), rejects `__proto__`, `constructor`, and `prototype` keys during `JSON.parse`, and validates every field and trace event against the `TraceEvent` union before anything reaches `Simulator` or a renderer.
- **Content-free read errors.** Node's `JSON.parse` `SyntaxError` embeds offending file bytes, which on a misdirected `chronos replay /etc/passwd` would disclose that file. Capsule read errors never echo file contents or full paths.
- **Canonical path confinement.** Capsules, scenario modules, and `chronos export` outputs must resolve (including via `realpath` across symlinks) under the working directory, `CHRONOS_DIR`, or `CHRONOS_CAPSULE_DIR`. Set `CHRONOS_ALLOW_OUTSIDE_CAPSULES=1` to opt out.
- **Per-sink output escaping.** Terminal control sequences and bidirectional overrides are stripped before printing in `trace`, `stats`, `replay`, `shrink`, `export`, and `explain`. CSV cells are prefixed against spreadsheet formula injection, and Markdown cells are escaped against table breakout.
- **Bounded Inspector rendering.** The Inspector rejects prototype-pollution keys, drops malformed events or oversized partition groups, and caps event count (`50,000`), node count (`256`), and virtual-time SVG coordinates (`10,000,000` ms) while surfacing any truncation in the UI.

### `chronos open` serves only to localhost

The Inspector server binds `127.0.0.1`, requires a loopback `Host` header (blocking DNS rebinding), confines static file serving to the built `dist/`, and sends a restrictive CSP plus `X-Frame-Options: DENY`. The `?capsule=` parameter rejects backslashes, control characters, and cross-origin URLs via WHATWG URL resolution against a local origin.

### `chronos explain` is optional and isolated

`chronos explain` is off unless you configure a provider key, and is absent from `@sx4im/chronos-core`. API keys are sent in request headers only, with `redirect: "error"`, over `https` unless the endpoint is loopback. Capsule summaries redact full and truncated JWTs as well as JSON-quoted and unquoted `token`/`key`/`secret`/`password`/`auth` fields before leaving the machine, and the model's reply is sanitized before printing.

### Determinism is a security property

Chronos removes every source of entropy from a simulated run. `@sx4im/chronos-core` has **zero runtime dependencies**, which keeps the supply chain for the part that runs inside your test process as small as it can be.

Note the asymmetry between the two environments:

- **`SimEnv` (tests)** draws from the seeded xoshiro256\*\* PRNG. It is deterministic by design and therefore **completely predictable** — never use `env.random()` from a simulated run as a source of secrets.
- **`RealEnv` (production)** backs `env.random()` with a CSPRNG. The same application code may reasonably use `env.random()` for a request id or a nonce in production, so the production adapter must be safe for that; nothing in production is replayed, so this costs nothing.

### Out of scope

- A malicious *scenario module*. `chronos sweep`/`replay`/`shrink` import and run your scenario, which is your own code — the path confinement is a guard against a mistyped path, not a sandbox.
- The contents of your own source tree, which `chronos check` reads.
- Denial of service from a sweep you asked for. Seed counts are capped at 1,000,000 to keep a typo from exhausting memory, but a large sweep is meant to be expensive.
