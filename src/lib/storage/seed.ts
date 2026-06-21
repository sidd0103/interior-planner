"use client";

/**
 * Seeds a one-time "Demo Apartment" project containing a real World Labs Marble
 * world (world 08432a72…, bundled at public/demo/living-room.spz) so the app
 * has something to explore on first run. The splat ships with the metric scale
 * + orientation World Labs returned, so the room is real-world sized, upright,
 * and you spawn inside it.
 *
 * Idempotent: runs at most once per version. If a prior version already created
 * the demo, its room transform is refreshed so fixes (e.g. orientation) land.
 */

import { db } from "./db";
import { putAsset } from "./blobStore";
import { ROT_X180 } from "@/lib/geometry/vec3";
import type { MetricTransform } from "./types";

const SEED_FLAG = "ip-demo-seeded-v2";
const DEMO_PROJECT_ID = "demo-apartment";
const DEMO_ROOM_ID = "demo-living-room";
const DEMO_SPLAT_URL = "/demo/living-room.spz";

// From the World Labs generation's semantics_metadata + the Marble → three.js
// axis fix (Y-down/Z-forward → Y-up): floor at y=0, capture point at eye height.
const DEMO_TRANSFORM: MetricTransform = {
  scale: 0.80008674,
  rotation: ROT_X180,
  translation: [0, 1.5593896, 0],
  rmsResidualMeters: 0,
  solvedAt: 0,
};

export async function ensureDemoProject(): Promise<void> {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(SEED_FLAG)) return;

  const database = db();
  const now = Date.now();

  // Already created by an earlier version: just refresh the room transform.
  if (await database.projects.get(DEMO_PROJECT_ID)) {
    await database.rooms.update(DEMO_ROOM_ID, {
      metricTransform: { ...DEMO_TRANSFORM, solvedAt: now },
      splatFormat: "spz",
      updatedAt: now,
    });
    localStorage.setItem(SEED_FLAG, "1");
    return;
  }

  // Fresh install: pull the bundled splat into the blob store and create both.
  const res = await fetch(DEMO_SPLAT_URL);
  if (!res.ok) return; // demo asset not present — skip silently
  const splatAssetId = await putAsset(await res.blob());

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
    metricTransform: { ...DEMO_TRANSFORM, solvedAt: now },
    createdAt: now,
    updatedAt: now,
  });

  localStorage.setItem(SEED_FLAG, "1");
}
