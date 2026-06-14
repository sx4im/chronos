import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set");
}

// Hosted Postgres (e.g. Supabase) requires TLS; local Postgres usually does not.
const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl);

export const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
