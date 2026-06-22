import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { getAuth } from "./auth";

/** The current session (or null), memoized per render/request. */
export const getSession = cache(async () => {
  return getAuth().api.getSession({ headers: await headers() });
});

/** The signed-in user, or throw. Use in Server Actions that require auth. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

/** The current user id, or undefined (for owner-or-public read checks). */
export async function currentUserId(): Promise<string | undefined> {
  return (await getSession())?.user.id;
}
