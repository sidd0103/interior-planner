import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema } from "@/lib/db/client";
import { requireEnv } from "@/lib/clients/env";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: { enabled: true },
    secret: requireEnv("BETTER_AUTH_SECRET"),
    baseURL: process.env.BETTER_AUTH_URL,
    plugins: [nextCookies()],
  });
}

let _auth: ReturnType<typeof createAuth> | null = null;

/**
 * better-auth instance (email + password), lazy so importing it doesn't require
 * env/DB until the first request. The Drizzle adapter auto-maps to the
 * user/session/account/verification tables in our schema. `nextCookies()` must
 * be the last plugin — it lets Server Actions set the session cookie.
 */
export function getAuth() {
  return (_auth ??= createAuth());
}
