// chronos open (§4.2) — launch the time-travel inspector preloaded with a capsule.
//
// The inspector is a Vite + React app built in @sx4im/chronos-inspector (Phase 4) to a
// static `dist/`. This command:
//   1. validates the capsule loads (same `readCapsule` the replay path uses),
//   2. locates the built inspector `dist/` (next to this package in the monorepo),
//   3. with `serve: true`, serves it over a tiny zero-dependency HTTP server
//      (node:http + node:fs) on a free port, exposing the capsule at `/capsule`
//      so the app's `?capsule=/capsule` bootstrap fetches it. The bin keeps the
//      process alive (the listening server pins the event loop) until Ctrl-C.
//
// No backend, no runtime deps beyond core+vitest — the HTTP server is Node
// built-ins only. And nothing here runs inside a simulation, so real sockets/fs
// are fine (the prime directive only bans them in simulated paths).

import type { Server } from "node:http";
import { stat } from "node:fs/promises";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { readCapsule } from "@sx4im/chronos-vitest/engine";
import { resolveCapsulePath, capsuleReadError } from "./util.js";
import { serveInspector } from "./server.js";

export interface OpenResult {
  exitCode: number;
  message: string;
  /** Only present when a server was started (`serve: true`). */
  url?: string;
  /** Only present when a server was started — the bin keeps it alive. */
  server?: Server;
}

export interface OpenOptions {
  /** Actually serve the inspector over HTTP (the bin sets this; the pure
   * `openCommand(path)` unit-tests with it false so no port is bound). */
  serve?: boolean;
}

/** Resolve the inspector's built `dist/` directory. Looks next to this package
 * in the monorepo (`../inspector/dist`) and honors `CHRONOS_INSPECTOR_DIST`. */
function resolveInspectorDist(): string | null {
  const override = process.env.CHRONOS_INSPECTOR_DIST;
  if (override) return override;
  const here = dirname(fileURLToPath(import.meta.url));
  // `here` is packages/cli/src (src) or packages/cli/dist (bundled bin). The
  // inspector dist is a sibling: <repo>/packages/inspector/dist from either.
  const candidate = resolvePath(here, "..", "..", "inspector", "dist");
  return candidate;
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

export async function openCommand(
  capsulePath: string,
  opts: OpenOptions = {},
): Promise<OpenResult> {
  // Confine the capsule path before reading: a misdirected `chronos open
  // /etc/passwd` is refused here (CapsulePathRefused) rather than opened. The
  // confined absolute path is what the server later streams at `/capsule`.
  let capsuleAbs: string;
  let seed: string;
  try {
    capsuleAbs = resolveCapsulePath(capsulePath);
    const capsule = await readCapsule(capsuleAbs);
    seed = capsule.trace.seed;
  } catch (e) {
    return {
      exitCode: 2,
      message: capsuleReadError(capsulePath, e),
    };
  }

  const distDir = resolveInspectorDist();
  if (!distDir || !(await dirExists(distDir))) {
    return {
      exitCode: 0,
      message:
        `chronos open: the @sx4im/chronos-inspector UI is not built at "${distDir ?? '(unresolved'}".\n` +
        `  Build it with \`pnpm --filter @sx4im/chronos-inspector build\`, then \`chronos open ${capsulePath}\`.\n` +
        `  capsule ready (seed ${seed}): ${capsulePath}`,
    };
  }

  if (!opts.serve) {
    return {
      exitCode: 0,
      message:
        `chronos open: capsule ready (seed ${seed}) → ${capsulePath}\n` +
        `  inspector found at ${distDir}. Run \`chronos open ${capsulePath}\` from the bin to serve it.`,
    };
  }

  const { server, port } = await serveInspector(distDir, capsuleAbs);
  const url = `http://localhost:${port}/?capsule=%2Fcapsule`;
  return {
    exitCode: 0,
    url,
    server,
    message:
      `Chronos inspector → ${url}\n` +
      `  serving capsule ${capsulePath} (seed ${seed}). Ctrl-C to stop.`,
  };
}
