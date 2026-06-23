"use server";

/**
 * Repository facade — Server Actions over Neon Postgres (Drizzle).
 *
 * The UI imports this module and calls it like async functions; each call runs
 * on the server, enforces access via the DAL (owner-only writes, owner-or-public
 * reads), and queries Drizzle. Signatures match the former local-first facade so
 * the client callers are unchanged. Asset blobs live in Vercel Blob and are
 * resolved via getAssetUrl (see also the `assets` table).
 */

import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  projects,
  rooms,
  jobs,
  measurements,
  furniture,
  placed,
  assets,
} from "@/lib/db/schema";
import {
  requireUser,
  requireWrite,
  canRead,
  currentUserId,
  projectIdOfRoom,
  projectIdOfFurniture,
  projectIdOfMeasurement,
  projectIdOfPlaced,
  projectIdOfJob,
} from "@/lib/auth/dal";
import { del as blobDel } from "@vercel/blob";
import { newId } from "./id";
import type {
  Project,
  Room,
  Job,
  Measurement,
  FurnitureAsset,
  PlacedFurniture,
  Id,
} from "./types";

const now = () => Date.now();

/** Convert SQL NULLs (and Drizzle's extra owner/visibility cols) to the app shape. */
function clean<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const k in row) out[k] = row[k] === null ? undefined : row[k];
  return out as T;
}

/**
 * Map an update patch's explicit `undefined` values to `null` so they CLEAR the
 * column. Drizzle's `.set()` skips `undefined` (treats it as "don't change"),
 * but callers that include a key with `undefined` (e.g. {splatAssetId: undefined})
 * mean to clear it; fields they want untouched are simply omitted from the patch.
 */
function nullify<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const k in obj) out[k] = obj[k] === undefined ? null : obj[k];
  return out as T;
}

/** Delete the Blob objects backing a set of assetIds (rows cascade separately). */
async function purgeAssets(assetIds: string[]) {
  const ids = assetIds.filter(Boolean);
  if (ids.length === 0) return;
  const rows = await getDb()
    .select({ blobUrl: assets.blobUrl })
    .from(assets)
    .where(inArray(assets.id, ids));
  const urls = rows.map((r) => r.blobUrl);
  if (urls.length) {
    try {
      await blobDel(urls);
    } catch {
      /* best-effort blob cleanup */
    }
  }
}

// --- Projects ---

export async function createProject(name: string): Promise<Project> {
  const userId = (await requireUser()).id;
  const p = { id: newId(), userId, name, visibility: "private" as const, createdAt: now(), updatedAt: now() };
  await getDb().insert(projects).values(p);
  return clean<Project>(p);
}

export async function listProjects(): Promise<Project[]> {
  const uid = await currentUserId();
  if (!uid) return [];
  const rows = await getDb()
    .select()
    .from(projects)
    .where(eq(projects.userId, uid))
    .orderBy(desc(projects.updatedAt));
  return rows.map((r) => clean<Project>(r));
}

export async function getProject(id: Id): Promise<Project | undefined> {
  if (!(await canRead(id))) return undefined;
  const rows = await getDb().select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0] ? clean<Project>(rows[0]) : undefined;
}

export async function renameProject(id: Id, name: string): Promise<void> {
  await requireWrite(id);
  await getDb().update(projects).set({ name, updatedAt: now() }).where(eq(projects.id, id));
}

/** Set a project's share visibility (owner only). */
export async function setProjectVisibility(
  id: Id,
  visibility: "private" | "public",
): Promise<void> {
  await requireWrite(id);
  await getDb().update(projects).set({ visibility, updatedAt: now() }).where(eq(projects.id, id));
}

/** Visibility + whether the current viewer may edit; undefined if no read access. */
export async function getProjectAccess(
  id: Id,
): Promise<{ visibility: "private" | "public"; canEdit: boolean } | undefined> {
  const uid = await currentUserId();
  const rows = await getDb()
    .select({ ownerId: projects.userId, visibility: projects.visibility })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  const p = rows[0];
  if (!p) return undefined;
  if (p.visibility !== "public" && p.ownerId !== uid) return undefined;
  return { visibility: p.visibility, canEdit: p.ownerId === uid };
}

/** Delete a project and (via DB cascade) everything under it; Blob objects too. */
export async function deleteProject(id: Id): Promise<void> {
  await requireWrite(id);
  const owned = await getDb().select({ id: assets.id }).from(assets).where(eq(assets.projectId, id));
  await purgeAssets(owned.map((a) => a.id));
  await getDb().delete(projects).where(eq(projects.id, id));
}

// --- Rooms ---

export async function createRoom(projectId: Id, name: string): Promise<Room> {
  await requireWrite(projectId);
  const r = { id: newId(), projectId, name, createdAt: now(), updatedAt: now() };
  await getDb().insert(rooms).values(r);
  return clean<Room>(r);
}

export async function listRooms(projectId: Id): Promise<Room[]> {
  if (!(await canRead(projectId))) return [];
  const rows = await getDb().select().from(rooms).where(eq(rooms.projectId, projectId));
  return rows.map((r) => clean<Room>(r));
}

export async function getRoom(id: Id): Promise<Room | undefined> {
  if (!(await canRead(await projectIdOfRoom(id)))) return undefined;
  const rows = await getDb().select().from(rooms).where(eq(rooms.id, id)).limit(1);
  return rows[0] ? clean<Room>(rows[0]) : undefined;
}

export async function updateRoom(id: Id, patch: Partial<Room>): Promise<void> {
  await requireWrite(await projectIdOfRoom(id));
  const { id: _omit, projectId: _omit2, createdAt: _omit3, ...rest } = patch;
  void _omit;
  void _omit2;
  void _omit3;
  await getDb().update(rooms).set({ ...nullify(rest), updatedAt: now() }).where(eq(rooms.id, id));
}

export async function deleteRoom(id: Id): Promise<void> {
  const pid = await projectIdOfRoom(id);
  await requireWrite(pid);
  const r = await getDb()
    .select({ video: rooms.videoAssetId, splat: rooms.splatAssetId })
    .from(rooms)
    .where(eq(rooms.id, id))
    .limit(1);
  await purgeAssets([r[0]?.video, r[0]?.splat].filter(Boolean) as string[]);
  await getDb().delete(rooms).where(eq(rooms.id, id));
}

// --- Jobs ---

export async function createJob(kind: Job["kind"], projectId: Id): Promise<Job> {
  await requireWrite(projectId);
  const j = { id: newId(), projectId, kind, status: "queued" as const, createdAt: now(), updatedAt: now() };
  await getDb().insert(jobs).values(j);
  return clean<Job>(j);
}

export async function getJob(id: Id): Promise<Job | undefined> {
  if (!(await canRead(await projectIdOfJob(id)))) return undefined;
  const rows = await getDb().select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0] ? clean<Job>(rows[0]) : undefined;
}

export async function updateJob(id: Id, patch: Partial<Job>): Promise<void> {
  await requireWrite(await projectIdOfJob(id));
  const { id: _o, createdAt: _o3, ...rest } = patch;
  void _o;
  void _o3;
  await getDb().update(jobs).set({ ...nullify(rest), updatedAt: now() }).where(eq(jobs.id, id));
}

// --- Measurements ---

export async function addMeasurement(
  m: Omit<Measurement, "id" | "createdAt" | "updatedAt">,
): Promise<Measurement> {
  await requireWrite(await projectIdOfRoom(m.roomId));
  const full = { ...m, id: newId(), createdAt: now(), updatedAt: now() };
  await getDb().insert(measurements).values(full);
  return clean<Measurement>(full);
}

export async function listMeasurements(roomId: Id): Promise<Measurement[]> {
  if (!(await canRead(await projectIdOfRoom(roomId)))) return [];
  const rows = await getDb().select().from(measurements).where(eq(measurements.roomId, roomId));
  return rows.map((r) => clean<Measurement>(r));
}

export async function updateMeasurement(id: Id, patch: Partial<Measurement>): Promise<void> {
  await requireWrite(await projectIdOfMeasurement(id));
  const { id: _o, roomId: _o2, createdAt: _o3, ...rest } = patch;
  void _o;
  void _o2;
  void _o3;
  await getDb().update(measurements).set({ ...nullify(rest), updatedAt: now() }).where(eq(measurements.id, id));
}

export async function deleteMeasurement(id: Id): Promise<void> {
  await requireWrite(await projectIdOfMeasurement(id));
  await getDb().delete(measurements).where(eq(measurements.id, id));
}

// --- Furniture assets ---

export async function createFurniture(
  f: Omit<FurnitureAsset, "id" | "createdAt" | "updatedAt">,
): Promise<FurnitureAsset> {
  await requireWrite(f.projectId);
  const full = { ...f, id: newId(), createdAt: now(), updatedAt: now() };
  await getDb().insert(furniture).values(full);
  return clean<FurnitureAsset>(full);
}

export async function listFurniture(projectId: Id): Promise<FurnitureAsset[]> {
  if (!(await canRead(projectId))) return [];
  const rows = await getDb().select().from(furniture).where(eq(furniture.projectId, projectId));
  return rows.map((r) => clean<FurnitureAsset>(r));
}

export async function getFurniture(id: Id): Promise<FurnitureAsset | undefined> {
  if (!(await canRead(await projectIdOfFurniture(id)))) return undefined;
  const rows = await getDb().select().from(furniture).where(eq(furniture.id, id)).limit(1);
  return rows[0] ? clean<FurnitureAsset>(rows[0]) : undefined;
}

export async function updateFurniture(id: Id, patch: Partial<FurnitureAsset>): Promise<void> {
  await requireWrite(await projectIdOfFurniture(id));
  const { id: _o, projectId: _o2, createdAt: _o3, ...rest } = patch;
  void _o;
  void _o2;
  void _o3;
  await getDb().update(furniture).set({ ...nullify(rest), updatedAt: now() }).where(eq(furniture.id, id));
}

export async function deleteFurniture(id: Id): Promise<void> {
  await requireWrite(await projectIdOfFurniture(id));
  const f = await getDb()
    .select({ img: furniture.sourceImageAssetId, glb: furniture.glbAssetId })
    .from(furniture)
    .where(eq(furniture.id, id))
    .limit(1);
  await purgeAssets([f[0]?.img, f[0]?.glb].filter(Boolean) as string[]);
  await getDb().delete(furniture).where(eq(furniture.id, id));
}

// --- Placed furniture (instances in a room) ---

export async function placeFurniture(
  roomId: Id,
  furnitureAssetId: Id,
  init?: Partial<Pick<PlacedFurniture, "position" | "rotation" | "scale">>,
): Promise<PlacedFurniture> {
  await requireWrite(await projectIdOfRoom(roomId));
  const p = {
    id: newId(),
    roomId,
    furnitureAssetId,
    position: init?.position ?? ([0, 0, 0] as [number, number, number]),
    rotation: init?.rotation ?? ([0, 0, 0] as [number, number, number]),
    scale: init?.scale ?? 1,
    createdAt: now(),
    updatedAt: now(),
  };
  await getDb().insert(placed).values(p);
  return clean<PlacedFurniture>(p);
}

export async function listPlaced(roomId: Id): Promise<PlacedFurniture[]> {
  if (!(await canRead(await projectIdOfRoom(roomId)))) return [];
  const rows = await getDb().select().from(placed).where(eq(placed.roomId, roomId));
  return rows.map((r) => clean<PlacedFurniture>(r));
}

export async function updatePlaced(id: Id, patch: Partial<PlacedFurniture>): Promise<void> {
  await requireWrite(await projectIdOfPlaced(id));
  const { id: _o, roomId: _o2, furnitureAssetId: _o3, createdAt: _o4, ...rest } = patch;
  void _o;
  void _o2;
  void _o3;
  void _o4;
  await getDb().update(placed).set({ ...nullify(rest), updatedAt: now() }).where(eq(placed.id, id));
}

export async function removePlaced(id: Id): Promise<void> {
  await requireWrite(await projectIdOfPlaced(id));
  await getDb().delete(placed).where(eq(placed.id, id));
}

// --- Assets (private Blob; reads go through the /api/asset/<id> proxy) ---

/** The authenticated read URL for an assetId (the proxy enforces access). */
export async function getAssetUrl(assetId: Id): Promise<string | undefined> {
  return assetId ? `/api/asset/${assetId}` : undefined;
}

/** Insert an `assets` row for an already-uploaded Blob; returns the assetId. */
export async function registerAsset(input: {
  blobUrl: string;
  pathname: string;
  projectId: Id;
  contentType?: string;
  size?: number;
}): Promise<Id> {
  await requireWrite(input.projectId);
  const id = newId();
  await getDb().insert(assets).values({
    id,
    blobUrl: input.blobUrl,
    pathname: input.pathname,
    projectId: input.projectId,
    contentType: input.contentType ?? null,
    size: input.size ?? null,
    createdAt: now(),
  });
  return id;
}
