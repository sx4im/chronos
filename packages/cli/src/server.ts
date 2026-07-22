import { createServer, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

// Security headers applied to EVERY response from the inspector server.
const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
    "connect-src 'self'; img-src 'self' data:; font-src 'self' data:; " +
    "base-uri 'self'; form-action 'none'",
} as const;

// Require the Host header to be a loopback host
const LOOPBACK_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i;

function forbiddenHost(res: ServerResponse): void {
  res.writeHead(403, { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
  res.end("forbidden host");
}

/** Serve `distDir` statically, plus a `/capsule` route that streams the capsule
 * JSON the inspector preloads. Resolves once listening; the caller owns the
 * server's lifetime (the bin keeps it alive, closed on SIGINT). */
export async function serveInspector(
  distDir: string,
  capsuleAbs: string,
): Promise<{ server: Server; port: number }> {
  const server = createServer(async (req, res) => {
    // Host check first — before any file read, before any error path leaks.
    if (!LOOPBACK_HOST.test((req.headers.host ?? "").trim())) {
      forbiddenHost(res);
      return;
    }
    try {
      const raw = (req.url ?? "/").split("?")[0] ?? "/";
      const url = decodeURIComponent(raw);

      // The preload endpoint: stream the capsule JSON verbatim. `nosniff`
      // (from SECURITY_HEADERS) makes the browser never treat this as HTML.
      if (url === "/capsule") {
        const data = await readFile(capsuleAbs);
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          ...SECURITY_HEADERS,
        });
        res.end(data);
        return;
      }

      // Map any other path to a file under distDir, with `/` → index.html.
      const rel = normalize(url === "/" ? "/index.html" : url);
      const file = join(distDir, rel);
      // Path-traversal guard: the resolved file must stay inside distDir.
      const rel2 = relative(distDir, file);
      if (rel2.startsWith("..") || rel2 === "") {
        res.writeHead(403, { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
        res.end("forbidden");
        return;
      }
      const data = await readFile(file).catch(() => null);
      if (data === null) {
        // SPA fallback so a deep link doesn't 404 on the inspector route.
        const fallback = await readFile(join(distDir, "index.html"));
        res.writeHead(200, {
          "content-type": MIME[".html"] ?? "text/html; charset=utf-8",
          ...SECURITY_HEADERS,
        });
        res.end(fallback);
        return;
      }
      res.writeHead(200, {
        "content-type": MIME[extname(file)] ?? "application/octet-stream",
        ...SECURITY_HEADERS,
      });
      res.end(data);
    } catch {
      // Generic, content-free 500
      res.writeHead(500, { "content-type": "text/plain; charset=utf-8", ...SECURITY_HEADERS });
      res.end("internal error");
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}
