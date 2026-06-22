import "server-only";

import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { requireEnv } from "@/lib/clients/env";
import * as schema from "./schema";

let _db: NeonHttpDatabase<typeof schema> | null = null;

/**
 * Neon-backed Drizzle client (lazy + memoized). Server-only. Lazy so importing
 * this module — and anything that builds on it (auth, repo) — doesn't require
 * DATABASE_URL until a query actually runs (keeps `next build` working offline).
 */
export function getDb(): NeonHttpDatabase<typeof schema> {
  if (!_db) _db = drizzle(neon(requireEnv("DATABASE_URL")), { schema });
  return _db;
}

export { schema };
