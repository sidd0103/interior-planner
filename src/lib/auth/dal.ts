import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { projects, rooms, furniture, measurements, placed, jobs, assets } from "@/lib/db/schema";
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

// --- Project access (the authorization single source of truth) ---

/** Owner + visibility of a project, or null if it doesn't exist. */
async function projectMeta(projectId: string) {
  const rows = await getDb()
    .select({ ownerId: projects.userId, visibility: projects.visibility })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  return rows[0] ?? null;
}

/** Can the current viewer READ this project? (owner OR public) */
export async function canRead(projectId: string | null | undefined): Promise<boolean> {
  if (!projectId) return false;
  const p = await projectMeta(projectId);
  if (!p) return false;
  if (p.visibility === "public") return true;
  return p.ownerId === (await currentUserId());
}

/** Require the current viewer to OWN this project (write access). Returns owner id. */
export async function requireWrite(projectId: string | null | undefined): Promise<string> {
  if (!projectId) throw new Error("Not found");
  const p = await projectMeta(projectId);
  if (!p) throw new Error("Not found");
  const uid = await currentUserId();
  if (!uid || p.ownerId !== uid) throw new Error("Forbidden");
  return uid;
}

// --- Resolve a sub-entity to its owning projectId (one JOIN up the FK chain) ---

export async function projectIdOfRoom(id: string): Promise<string | null> {
  const r = await getDb().select({ p: rooms.projectId }).from(rooms).where(eq(rooms.id, id)).limit(1);
  return r[0]?.p ?? null;
}
export async function projectIdOfFurniture(id: string): Promise<string | null> {
  const r = await getDb()
    .select({ p: furniture.projectId })
    .from(furniture)
    .where(eq(furniture.id, id))
    .limit(1);
  return r[0]?.p ?? null;
}
export async function projectIdOfMeasurement(id: string): Promise<string | null> {
  const r = await getDb()
    .select({ p: rooms.projectId })
    .from(measurements)
    .innerJoin(rooms, eq(measurements.roomId, rooms.id))
    .where(eq(measurements.id, id))
    .limit(1);
  return r[0]?.p ?? null;
}
export async function projectIdOfPlaced(id: string): Promise<string | null> {
  const r = await getDb()
    .select({ p: rooms.projectId })
    .from(placed)
    .innerJoin(rooms, eq(placed.roomId, rooms.id))
    .where(eq(placed.id, id))
    .limit(1);
  return r[0]?.p ?? null;
}
export async function projectIdOfJob(id: string): Promise<string | null> {
  const r = await getDb().select({ p: jobs.projectId }).from(jobs).where(eq(jobs.id, id)).limit(1);
  return r[0]?.p ?? null;
}
export async function projectIdOfAsset(id: string): Promise<string | null> {
  const r = await getDb().select({ p: assets.projectId }).from(assets).where(eq(assets.id, id)).limit(1);
  return r[0]?.p ?? null;
}
