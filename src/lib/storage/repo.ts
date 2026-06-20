/**
 * Repository facade over Dexie (metadata) + blobStore (binaries).
 *
 * The UI talks only to this module, never to Dexie directly. That keeps the
 * persistence backend swappable: a future cloud implementation can satisfy the
 * same function signatures (Postgres + object storage) without UI changes.
 */

import { db } from "./db";
import { putAsset, getAsset, getAssetUrl, deleteAsset } from "./blobStore";
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

// Re-export blob helpers so callers have a single import surface.
export { putAsset, getAsset, getAssetUrl, deleteAsset };

// --- Projects ---

export async function createProject(name: string): Promise<Project> {
  const p: Project = { id: newId(), name, createdAt: now(), updatedAt: now() };
  await db().projects.add(p);
  return p;
}

export async function listProjects(): Promise<Project[]> {
  return db().projects.orderBy("updatedAt").reverse().toArray();
}

export function getProject(id: Id): Promise<Project | undefined> {
  return db().projects.get(id);
}

export async function renameProject(id: Id, name: string): Promise<void> {
  await db().projects.update(id, { name, updatedAt: now() });
}

/** Delete a project and all rooms, furniture, placements, jobs, and assets under it. */
export async function deleteProject(id: Id): Promise<void> {
  const rooms = await listRooms(id);
  await Promise.all(rooms.map((r) => deleteRoom(r.id)));
  const furniture = await listFurniture(id);
  await Promise.all(furniture.map((f) => deleteFurniture(f.id)));
  await db().projects.delete(id);
}

// --- Rooms ---

export async function createRoom(projectId: Id, name: string): Promise<Room> {
  const r: Room = { id: newId(), projectId, name, createdAt: now(), updatedAt: now() };
  await db().rooms.add(r);
  return r;
}

export function listRooms(projectId: Id): Promise<Room[]> {
  return db().rooms.where("projectId").equals(projectId).toArray();
}

export function getRoom(id: Id): Promise<Room | undefined> {
  return db().rooms.get(id);
}

export async function updateRoom(id: Id, patch: Partial<Room>): Promise<void> {
  await db().rooms.update(id, { ...patch, updatedAt: now() });
}

export async function deleteRoom(id: Id): Promise<void> {
  const room = await getRoom(id);
  if (room?.videoAssetId) await deleteAsset(room.videoAssetId);
  if (room?.splatAssetId) await deleteAsset(room.splatAssetId);
  const measurements = await listMeasurements(id);
  await Promise.all(measurements.map((m) => deleteMeasurement(m.id)));
  await db().placed.where("roomId").equals(id).delete();
  await db().rooms.delete(id);
}

// --- Jobs ---

export async function createJob(kind: Job["kind"]): Promise<Job> {
  const j: Job = { id: newId(), kind, status: "queued", createdAt: now(), updatedAt: now() };
  await db().jobs.add(j);
  return j;
}

export function getJob(id: Id): Promise<Job | undefined> {
  return db().jobs.get(id);
}

export async function updateJob(id: Id, patch: Partial<Job>): Promise<void> {
  await db().jobs.update(id, { ...patch, updatedAt: now() });
}

// --- Measurements ---

export async function addMeasurement(
  m: Omit<Measurement, "id" | "createdAt" | "updatedAt">,
): Promise<Measurement> {
  const full: Measurement = { ...m, id: newId(), createdAt: now(), updatedAt: now() };
  await db().measurements.add(full);
  return full;
}

export function listMeasurements(roomId: Id): Promise<Measurement[]> {
  return db().measurements.where("roomId").equals(roomId).toArray();
}

export async function updateMeasurement(id: Id, patch: Partial<Measurement>): Promise<void> {
  await db().measurements.update(id, { ...patch, updatedAt: now() });
}

export async function deleteMeasurement(id: Id): Promise<void> {
  const m = await db().measurements.get(id);
  if (m?.screenshotAssetId) await deleteAsset(m.screenshotAssetId);
  await db().measurements.delete(id);
}

// --- Furniture assets ---

export async function createFurniture(
  f: Omit<FurnitureAsset, "id" | "createdAt" | "updatedAt">,
): Promise<FurnitureAsset> {
  const full: FurnitureAsset = { ...f, id: newId(), createdAt: now(), updatedAt: now() };
  await db().furniture.add(full);
  return full;
}

export function listFurniture(projectId: Id): Promise<FurnitureAsset[]> {
  return db().furniture.where("projectId").equals(projectId).toArray();
}

export function getFurniture(id: Id): Promise<FurnitureAsset | undefined> {
  return db().furniture.get(id);
}

export async function updateFurniture(id: Id, patch: Partial<FurnitureAsset>): Promise<void> {
  await db().furniture.update(id, { ...patch, updatedAt: now() });
}

export async function deleteFurniture(id: Id): Promise<void> {
  const f = await getFurniture(id);
  if (f?.sourceImageAssetId) await deleteAsset(f.sourceImageAssetId);
  if (f?.glbAssetId) await deleteAsset(f.glbAssetId);
  await db().placed.where("furnitureAssetId").equals(id).delete();
  await db().furniture.delete(id);
}

// --- Placed furniture (instances in a room) ---

export async function placeFurniture(
  roomId: Id,
  furnitureAssetId: Id,
  init?: Partial<Pick<PlacedFurniture, "position" | "rotation" | "scale">>,
): Promise<PlacedFurniture> {
  const p: PlacedFurniture = {
    id: newId(),
    roomId,
    furnitureAssetId,
    position: init?.position ?? [0, 0, 0],
    rotation: init?.rotation ?? [0, 0, 0],
    scale: init?.scale ?? 1,
    createdAt: now(),
    updatedAt: now(),
  };
  await db().placed.add(p);
  return p;
}

export function listPlaced(roomId: Id): Promise<PlacedFurniture[]> {
  return db().placed.where("roomId").equals(roomId).toArray();
}

export async function updatePlaced(id: Id, patch: Partial<PlacedFurniture>): Promise<void> {
  await db().placed.update(id, { ...patch, updatedAt: now() });
}

export async function removePlaced(id: Id): Promise<void> {
  await db().placed.delete(id);
}
