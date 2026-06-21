"use client";

/**
 * Seeds a one-time "Demo Apartment" project containing a real World Labs Marble
 * world (world 08432a72…, bundled at public/demo/living-room.spz) so the app
 * has something to explore on first run. The splat ships with the metric scale
 * World Labs returned, so the room is already real-world sized.
 *
 * Idempotent: runs at most once (guarded by a localStorage flag), and never
 * re-creates the demo if the user has deleted it.
 */

import { db } from "./db";
import { putAsset } from "./blobStore";
import { IDENTITY3 } from "@/lib/geometry/vec3";

const SEED_FLAG = "ip-demo-seeded-v1";
const DEMO_PROJECT_ID = "demo-apartment";
const DEMO_ROOM_ID = "demo-living-room";
const DEMO_SPLAT_URL = "/demo/living-room.spz";

// From the World Labs generation's semantics_metadata.
const METRIC_SCALE_FACTOR = 0.80008674;
const GROUND_PLANE_OFFSET = 1.5593896;

export async function ensureDemoProject(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_FLAG)) return;

  const database = db();
  if (await database.projects.get(DEMO_PROJECT_ID)) {
    localStorage.setItem(SEED_FLAG, "1");
    return;
  }

  // Pull the bundled splat into the blob store.
  const res = await fetch(DEMO_SPLAT_URL);
  if (!res.ok) return; // demo asset not present — skip silently
  const splatAssetId = await putAsset(await res.blob());

  const now = Date.now();
  await database.projects.add({
    id: DEMO_PROJECT_ID,
    name: "Demo Apartment",
    createdAt: now,
    updatedAt: now,
  });
  await database.rooms.add({
    id: DEMO_ROOM_ID,
    projectId: DEMO_PROJECT_ID,
    name: "Living Room",
    splatAssetId,
    splatFormat: "spz",
    metricTransform: {
      scale: METRIC_SCALE_FACTOR,
      rotation: IDENTITY3,
      translation: [0, GROUND_PLANE_OFFSET, 0],
      rmsResidualMeters: 0,
      solvedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  });

  localStorage.setItem(SEED_FLAG, "1");
}
