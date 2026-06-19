import type { Store, Options, IncrementResponse, ClientRateLimitInfo } from "express-rate-limit";
import { pool } from "../db";

// A Postgres-backed store for express-rate-limit. The default MemoryStore is
// per-process, so on serverless/multi-instance deploys (Vercel) each instance
// keeps its own counters and the effective limit is multiplied by the number
// of warm instances. Backing the counters with the shared database makes the
// limits global.
//
// The store is intentionally fail-open: if the database is unavailable we let
// the request through rather than 500-ing the whole API on a rate-limit lookup.

let tableReady: Promise<void> | null = null;

function ensureTable(): Promise<void> {
  if (!tableReady) {
    tableReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS rate_limit_hits (
           key text PRIMARY KEY,
           count integer NOT NULL,
           expires_at timestamptz NOT NULL
         )`,
      )
      .then(() => undefined)
      .catch((err) => {
        tableReady = null; // allow a later retry
        throw err;
      });
  }
  return tableReady;
}

export class PgRateLimitStore implements Store {
  windowMs = 60_000;
  readonly prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    void ensureTable().catch(() => {
      /* logged on first increment */
    });
  }

  private namespaced(key: string): string {
    return `${this.prefix}:${key}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const windowSec = this.windowMs / 1000;
    try {
      await ensureTable();
      const { rows } = await pool.query<{ count: number; expires_at: Date }>(
        `INSERT INTO rate_limit_hits (key, count, expires_at)
         VALUES ($1, 1, now() + make_interval(secs => $2))
         ON CONFLICT (key) DO UPDATE SET
           count = CASE WHEN rate_limit_hits.expires_at < now()
                        THEN 1 ELSE rate_limit_hits.count + 1 END,
           expires_at = CASE WHEN rate_limit_hits.expires_at < now()
                             THEN now() + make_interval(secs => $2)
                             ELSE rate_limit_hits.expires_at END
         RETURNING count, expires_at`,
        [this.namespaced(key), windowSec],
      );
      const row = rows[0];
      return { totalHits: Number(row.count), resetTime: new Date(row.expires_at) };
    } catch (err) {
      console.error("PgRateLimitStore.increment failed; allowing request", err);
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await ensureTable();
      await pool.query(
        `UPDATE rate_limit_hits SET count = GREATEST(count - 1, 0)
         WHERE key = $1 AND expires_at >= now()`,
        [this.namespaced(key)],
      );
    } catch (err) {
      console.error("PgRateLimitStore.decrement failed", err);
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await ensureTable();
      await pool.query(`DELETE FROM rate_limit_hits WHERE key = $1`, [this.namespaced(key)]);
    } catch (err) {
      console.error("PgRateLimitStore.resetKey failed", err);
    }
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    try {
      await ensureTable();
      const { rows } = await pool.query<{ count: number; expires_at: Date }>(
        `SELECT count, expires_at FROM rate_limit_hits WHERE key = $1 AND expires_at >= now()`,
        [this.namespaced(key)],
      );
      if (rows.length === 0) return undefined;
      return { totalHits: Number(rows[0].count), resetTime: new Date(rows[0].expires_at) };
    } catch (err) {
      console.error("PgRateLimitStore.get failed", err);
      return undefined;
    }
  }

  async resetAll(): Promise<void> {
    try {
      await ensureTable();
      await pool.query(`DELETE FROM rate_limit_hits WHERE key LIKE $1`, [`${this.prefix}:%`]);
    } catch (err) {
      console.error("PgRateLimitStore.resetAll failed", err);
    }
  }
}

export function createPgRateLimitStore(prefix: string): PgRateLimitStore {
  return new PgRateLimitStore(prefix);
}
