// Shared path helpers for the @sx4im/chronos-cli commands.

import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { InvalidCapsule } from "@sx4im/chronos-vitest/engine";

/** Resolve a filesystem path (relative to cwd) to a `file://` URL for ESM
 *  dynamic import. Bare paths go through `pathToFileURL`. URL-looking inputs
 *  (any `scheme:` prefix, whether or not followed by `//`) are restricted to
 *  `file:` — any other scheme (`http:`, `https:`, `data:`, `javascript:`,
 *  `blob:`, `node:`, …) is rejected outright, since the only legitimate
 *  scenario modules are local files and Node's ESM loader will happily execute
 *  `data:` URLs as code (the path the user typed is the only authority on what
 *  to import). */
export function toFileUrl(p: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) {
    const colonIdx = p.indexOf(":");
    // If the colon is at index 1, it's a Windows drive letter (e.g. C:\path), not a scheme.
    if (colonIdx !== 1) {
      if (!/^file:/i.test(p)) {
        const scheme = p.slice(0, colonIdx);
        throw new Error(
          `scenario URL must be a local file path (scheme ${scheme}: is not allowed; pass an absolute or cwd-relative filesystem path)`,
        );
      }
      return p;
    }
  }
  const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
  return pathToFileURL(abs).href;
}

/** A capsule file is untrusted shared input, and a CLI capsule path is untrusted
 *  argv. Refuse to read capsules from outside an allow-list of roots so a
 *  misdirected `chronos replay /etc/passwd` (or `../../etc/passwd`) can't be
 *  opened by the capsule reader at all — closing the content-disclosure path
 *  before it starts. The allow-list is: cwd, `CHRONOS_DIR`, `CHRONOS_CAPSULE_DIR`
 *  (if set). `CHRONOS_ALLOW_OUTSIDE_CAPSULES=1` is an explicit power-user opt-out
 *  (a developer who really wants to read a capsule from an absolute path). */
export class CapsulePathRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapsulePathRefused";
  }
}

/** The resolved absolute capsule path if it is inside an allowed root; throws
 *  `CapsulePathRefused` (content-free message) otherwise. */
export function resolveCapsulePath(p: string): string {
  if (process.env.CHRONOS_ALLOW_OUTSIDE_CAPSULES === "1") {
    return isAbsolute(p) ? p : resolve(process.cwd(), p);
  }
  const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
  const roots: string[] = [process.cwd()];
  if (process.env.CHRONOS_DIR) roots.push(resolve(process.env.CHRONOS_DIR));
  if (process.env.CHRONOS_CAPSULE_DIR) roots.push(resolve(process.env.CHRONOS_CAPSULE_DIR));
  const allowed = roots.some((r) => {
    const rel = relative(r, abs);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
  if (!allowed) {
    throw new CapsulePathRefused(
      `capsule path is outside the allowed directories (cwd, CHRONOS_DIR, CHRONOS_CAPSULE_DIR). ` +
        `Set CHRONOS_ALLOW_OUTSIDE_CAPSULES=1 to allow it. Refused: ${safeBasename(abs)}`,
    );
  }
  return abs;
}

/** The resolved absolute scenario path if it is inside an allowed root; throws
 *  `CapsulePathRefused` (content-free message) otherwise. */
export function resolveScenarioPath(p: string): string {
  if (process.env.CHRONOS_ALLOW_OUTSIDE_CAPSULES === "1" || process.env.CHRONOS_ALLOW_OUTSIDE_SCENARIOS === "1") {
    return isAbsolute(p) ? p : resolve(process.cwd(), p);
  }
  const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
  const roots: string[] = [process.cwd()];
  if (process.env.CHRONOS_DIR) roots.push(resolve(process.env.CHRONOS_DIR));
  const allowed = roots.some((r) => {
    const rel = relative(r, abs);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
  if (!allowed) {
    throw new CapsulePathRefused(
      `scenario path is outside the allowed directories (cwd, CHRONOS_DIR). ` +
        `Set CHRONOS_ALLOW_OUTSIDE_CAPSULES=1 to allow it. Refused: ${safeBasename(abs)}`,
    );
  }
  return abs;
}

/** Render only the final path component of `p` — never the absolute path (which
 *  could leak a sensitive directory structure in an error message). */
export function safeBasename(p: string): string {
  const base = p.split(/[/\\]/).pop()?.trim();
  return base && base.length > 0 ? base : "<capsule>";
}

/** A content-free "could not read capsule" message for a failed capsule read.
 *  Never echoes the raw error text (which for a `JSON.parse` SyntaxError embeds
 *  the file's contents, and for an ENOENT embeds the absolute path).
 *
 *  - `CapsulePathRefused` → the confinement message (already content-free).
 *  - `InvalidCapsule`     → the validator's structured, content-free message.
 *  - ENOENT / other fs    → a generic "file not found / unreadable" line.
 *  The capsule is shown only as a safe basename. The phrase "could not read
 *  capsule" is preserved so test assertions and user muscle-memory still match. */
export function capsuleReadError(p: string, e: unknown): string {
  const base = safeBasename(p);
  if (e instanceof CapsulePathRefused) return `could not read capsule "${base}": ${e.message}`;
  if (e instanceof InvalidCapsule) return `could not read capsule "${base}": ${e.message}`;
  const code = (e as { code?: string } | null)?.code;
  if (code === "ENOENT") return `could not read capsule "${base}": file not found`;
  return `could not read capsule "${base}": unreadable or not accessible`;
}
