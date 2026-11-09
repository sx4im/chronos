# Chronos Remaining Tasks / Issues

This document tracks any outstanding bugs, tasks, or issues remaining in the **Chronos** deterministic simulation testing framework.

## Outstanding Issues

- **None.** No failing tests, compilation errors, lint findings, or outstanding `TODO`/`FIXME` comments.

## Code Quality Status

- **Unit and Simulation Tests**: 340/340 passing across 30 test files.
- **TypeScript Typecheck**: Clean (0 compilation errors).
- **ESLint**: Clean (0 warnings or errors).
- **Build**: All workspace packages compile (ESM + type declarations). CI gates on `pnpm build` across Node 20 + 22.
- **File Modularity**: Every source file across all packages is under the 300-line ceiling (`CLAUDE.md`).

## Security Posture

Two full security audits have been completed and all findings are fixed with regression tests. See [`SECURITY.md`](./SECURITY.md) for the threat model.

Closed across audit passes:

| Area | Issue |
| --- | --- |
| Core | Strict-mode `setTimeout` guard compiled string handlers via `new Function`; nested `installGuards` calls now maintain a snapshot stack |
| CLI | Untrusted capsule text reached the terminal unescaped in `trace`, `stats`, `replay`, and `shrink` (ANSI/OSC injection) |
| CLI | `chronos export` allowed spreadsheet formula injection, Markdown table breakout, or unconfined/symlinked `--output` writes |
| CLI | `chronos explain` sent Gemini API keys in URL query strings, echoed interactive key input, and missed JSON-quoted keys or 80-char truncated JWTs in `sanitizeSummary` |
| CLI | `chronos check` followed symlinks on directory walks; `resolveCapsulePath` and `resolveScenarioPath` now canonicalize paths via `realpathSync` to block symlink escapes |
| Capsules | Added 128 MB pre-read size cap, `__proto__`/`constructor`/`prototype` reviver rejection, exclusive `0600` temp-file writes, and `TraceEvent` union + `"timeout"` validation |
| Inspector | Hardened `isSameOriginCapsuleUrl` against WHATWG backslash/control-character cross-origin bypasses, bounded partition groups, and clamped virtual-time SVG coordinates to `MAX_RENDERED_SPAN` |
| Deployment | Added CSP/HSTS/XFO security headers on the hosted Inspector, removed published source maps and `src` directories, and restricted CI `GITHUB_TOKEN` to `contents: read` |

## Known Non-Goals

- `@sx4im/chronos-core` keeps **zero runtime dependencies**. Do not add any.
- The BigInt PRNG is the known hot path. It stays pure TypeScript until the
  planned Rust/WASM phase, which will keep pure TS as the default.
