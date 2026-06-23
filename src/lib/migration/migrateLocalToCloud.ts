"use client";

/**
 * One-time import of the user's existing local-first projects (Dexie metadata +
 * OPFS blobs) into their cloud account. Reads the LEGACY local store and writes
 * through the new cloud path (Server Actions + backend Blob upload). Idempotent
 * per local project via a localStorage marker, so re-running only imports new
 * ones.
 */

import { db as legacyDb } from "@/lib/storage/db";
import { getAsset } from "@/lib/storage/blobStore";
import * as repo from "@/lib/storage/repo";
import { uploadAsset } from "@/lib/storage/uploadAsset";

const MIGRATED_KEY = "ip-migrated-project-ids";

function migratedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MIGRATED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}
function markMigrated(set: Set<string>, id: string) {
  set.add(id);
  localStorage.setItem(MIGRATED_KEY, JSON.stringify([...set]));
}

/** Number of local projects not yet migrated. */
export async function pendingLocalProjects(): Promise<number> {
  try {
    const all = await legacyDb().projects.toArray();
    const done = migratedSet();
    return all.filter((p) => !done.has(p.id)).length;
  } catch {
    return 0;
  }
}

export interface MigrateResult {
  projects: number;
  skipped: number;
}

/** Migrate all not-yet-migrated local projects. Reports each project name as it starts. */
export async function migrateLocalToCloud(
  onProgress?: (name: string, i: number, total: number) => void,
): Promise<MigrateResult> {
  const db = legacyDb();
  const localProjects = await db.projects.toArray();
  const done = migratedSet();
  const todo = localProjects.filter((p) => !done.has(p.id));

  let i = 0;
  for (const lp of todo) {
    onProgress?.(lp.name, ++i, todo.length);
    const project = await repo.createProject(lp.name);

    // Furniture assets first (placements reference them).
    const furnMap = new Map<string, string>();
    const localFurniture = await db.furniture.where("projectId").equals(lp.id).toArray();
    for (const f of localFurniture) {
      const sourceImageAssetId = await migrateBlob(f.sourceImageAssetId, project.id, "furniture");
      const glbAssetId = await migrateBlob(f.glbAssetId, project.id, "furniture");
      const nf = await repo.createFurniture({
        projectId: project.id,
        name: f.name,
        sourceImageAssetId: sourceImageAssetId ?? "",
        glbAssetId,
        realDims: f.realDims,
        price: f.price,
        webLink: f.webLink,
      });
      furnMap.set(f.id, nf.id);
    }

    // Rooms, then their measurements + placements.
    const localRooms = await db.rooms.where("projectId").equals(lp.id).toArray();
    for (const r of localRooms) {
      const splatAssetId = await migrateBlob(r.splatAssetId, project.id, "rooms");
      const room = await repo.createRoom(project.id, r.name);
      await repo.updateRoom(room.id, {
        splatAssetId,
        splatFormat: r.splatFormat,
        splatUpFlip: r.splatUpFlip,
        metricTransform: r.metricTransform,
        bounds: r.bounds,
        dimensions: r.dimensions,
        layoutPose: r.layoutPose,
      });

      const measurements = await db.measurements.where("roomId").equals(r.id).toArray();
      for (const m of measurements) {
        await repo.addMeasurement({
          roomId: room.id,
          endpoints: m.endpoints,
          targetMeters: m.targetMeters,
        });
      }

      const placements = await db.placed.where("roomId").equals(r.id).toArray();
      for (const p of placements) {
        const newFurnId = furnMap.get(p.furnitureAssetId);
        if (!newFurnId) continue;
        await repo.placeFurniture(room.id, newFurnId, {
          position: p.position,
          rotation: p.rotation,
          scale: p.scale,
        });
      }
    }

    markMigrated(done, lp.id);
  }

  return { projects: todo.length, skipped: localProjects.length - todo.length };
}

/** Read an OPFS blob by its legacy assetId and re-upload it to the cloud. */
async function migrateBlob(
  assetId: string | undefined,
  projectId: string,
  prefix: string,
): Promise<string | undefined> {
  if (!assetId) return undefined;
  const blob = await getAsset(assetId);
  if (!blob) return undefined;
  return uploadAsset(blob, projectId, prefix);
}
