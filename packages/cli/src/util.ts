// Shared path helpers for the @sx4im/chronos-cli commands.

import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { InvalidCapsule } from "@sx4im/chronos-vitest/engine";

/** Resolve a filesystem path to a `file://` URL for dynamic import; reject non-file schemes. */
export function toFileUrl(p: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(p)) {
    const colonIdx = p.indexOf(":");
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

export class CapsulePathRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapsulePathRefused";
  }
}

/** Resolve symlinks on existing paths or on the nearest existing ancestor directory. */
function canonicalPath(p: string, depth = 0): string {
  if (depth > 16) return p;
  try {
    return realpathSync(p);
  } catch {
    try {
      if (lstatSync(p).isSymbolicLink()) {
        const target = resolve(dirname(p), readlinkSync(p));
        return canonicalPath(target, depth + 1);
      }
    } catch {
      /* path does not exist yet */
    }
    const parent = dirname(p);
    if (parent === p) return p;
    return join(canonicalPath(parent, depth + 1), basename(p));
  }
}

function isWithinRoots(abs: string, roots: string[]): boolean {
  const realTarget = canonicalPath(abs);
  return roots.some((r) => {
    const lexRel = relative(r, abs);
    const lexOk = lexRel === "" || (!lexRel.startsWith("..") && !isAbsolute(lexRel));
    const realRoot = canonicalPath(r);
    const realRel = relative(realRoot, realTarget);
    const realOk = realRel === "" || (!realRel.startsWith("..") && !isAbsolute(realRel));
    return lexOk && realOk;
  });
}

export function resolveCapsulePath(p: string): string {
  const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
  if (process.env.CHRONOS_ALLOW_OUTSIDE_CAPSULES === "1") return abs;
  const roots: string[] = [process.cwd()];
  if (process.env.CHRONOS_DIR) roots.push(resolve(process.env.CHRONOS_DIR));
  if (process.env.CHRONOS_CAPSULE_DIR) roots.push(resolve(process.env.CHRONOS_CAPSULE_DIR));
  if (!isWithinRoots(abs, roots)) {
    throw new CapsulePathRefused(
      `capsule path is outside the allowed directories (cwd, CHRONOS_DIR, CHRONOS_CAPSULE_DIR). ` +
        `Set CHRONOS_ALLOW_OUTSIDE_CAPSULES=1 to allow it. Refused: ${safeBasename(abs)}`,
    );
  }
  return abs;
}

export function resolveScenarioPath(p: string): string {
  const abs = isAbsolute(p) ? p : resolve(process.cwd(), p);
  if (
    process.env.CHRONOS_ALLOW_OUTSIDE_CAPSULES === "1" ||
    process.env.CHRONOS_ALLOW_OUTSIDE_SCENARIOS === "1"
  ) {
    return abs;
  }
  const roots: string[] = [process.cwd()];
  if (process.env.CHRONOS_DIR) roots.push(resolve(process.env.CHRONOS_DIR));
  if (!isWithinRoots(abs, roots)) {
    throw new CapsulePathRefused(
      `scenario path is outside the allowed directories (cwd, CHRONOS_DIR). ` +
        `Set CHRONOS_ALLOW_OUTSIDE_CAPSULES=1 to allow it. Refused: ${safeBasename(abs)}`,
    );
  }
  return abs;
}

export function safeBasename(p: string): string {
  const base = p.split(/[/\\]/).pop()?.trim();
  return base && base.length > 0 ? base : "<capsule>";
}

export function capsuleReadError(p: string, e: unknown): string {
  const base = safeBasename(p);
  if (e instanceof CapsulePathRefused) return `could not read capsule "${base}": ${e.message}`;
  if (e instanceof InvalidCapsule) return `could not read capsule "${base}": ${e.message}`;
  const code = (e as { code?: string } | null)?.code;
  if (code === "ENOENT") return `could not read capsule "${base}": file not found`;
  return `could not read capsule "${base}": unreadable or not accessible`;
}
