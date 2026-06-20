/**
 * IndexedDB metadata layer (Dexie). Holds the JSON records defined in types.ts.
 * Large binaries live in blobStore.ts; here we only persist their ids.
 */

import Dexie, { type EntityTable } from "dexie";
import type {
  Project,
  Room,
  Job,
  Measurement,
  FurnitureAsset,
  PlacedFurniture,
} from "./types";

export class PlannerDB extends Dexie {
  projects!: EntityTable<Project, "id">;
  rooms!: EntityTable<Room, "id">;
  jobs!: EntityTable<Job, "id">;
  measurements!: EntityTable<Measurement, "id">;
  furniture!: EntityTable<FurnitureAsset, "id">;
  placed!: EntityTable<PlacedFurniture, "id">;

  constructor() {
    super("interior-planner");
    this.version(1).stores({
      // Only index fields we query by; Dexie stores the whole object regardless.
      projects: "id, updatedAt",
      rooms: "id, projectId, updatedAt",
      jobs: "id, kind, status, updatedAt",
      measurements: "id, roomId",
      furniture: "id, projectId, jobId",
      placed: "id, roomId, furnitureAssetId",
    });
  }
}

/**
 * Singleton DB instance. Dexie is browser-only; guard so importing this module
 * from a server context (route handlers) doesn't throw.
 */
let _db: PlannerDB | null = null;

export function db(): PlannerDB {
  if (typeof indexedDB === "undefined") {
    throw new Error("PlannerDB is only available in the browser");
  }
  if (!_db) _db = new PlannerDB();
  return _db;
}
