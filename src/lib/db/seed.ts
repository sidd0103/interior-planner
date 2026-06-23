/**
 * Server-side demo seed (run: `npm run db:seed`). Idempotent.
 *
 * Creates a system user that owns a single PUBLIC "Demo Apartment" project, with
 * the bundled living-room splat uploaded once to (private) Blob. Because the
 * project is public, anyone — including logged-out visitors — can view it at
 * /project/demo-apartment (it never appears in users' own dashboards).
 *
 * Self-contained (relative imports, inline client) so tsx can run it directly.
 */

import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { put } from "@vercel/blob";
import { user, projects, rooms, assets } from "./schema";

const SYSTEM_USER_ID = "system-demo";
const DEMO_PROJECT_ID = "demo-apartment";
const DEMO_ROOM_ID = "demo-living-room";
const DEMO_SPLAT_ASSET_ID = "demo-splat";

// World Labs metadata + Marble→three.js axis fix (Y-down→Y-up): floor at y=0.
const DEMO_TRANSFORM = {
  scale: 0.80008674,
  rotation: [1, 0, 0, 0, -1, 0, 0, 0, -1] as [
    number, number, number, number, number, number, number, number, number,
  ],
  translation: [0, 1.5593896, 0] as [number, number, number],
  rmsResidualMeters: 0,
  solvedAt: 0,
};

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN required");

  const db = drizzle(neon(process.env.DATABASE_URL), { schema: { user, projects, rooms, assets } });
  const now = Date.now();

  await db
    .insert(user)
    .values({
      id: SYSTEM_USER_ID,
      name: "Interior Planner",
      email: "demo@interior-planner.local",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing();

  await db
    .insert(projects)
    .values({
      id: DEMO_PROJECT_ID,
      userId: SYSTEM_USER_ID,
      name: "Demo Apartment",
      visibility: "public",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: projects.id,
      set: { visibility: "public", name: "Demo Apartment" },
    });

  const existing = await db
    .select({ id: assets.id })
    .from(assets)
    .where(eq(assets.id, DEMO_SPLAT_ASSET_ID))
    .limit(1);
  if (!existing[0]) {
    const buf = await readFile("public/demo/living-room.spz");
    const blob = await put("demo/living-room.spz", buf, {
      access: "private",
      addRandomSuffix: true,
      contentType: "application/octet-stream",
    });
    await db.insert(assets).values({
      id: DEMO_SPLAT_ASSET_ID,
      blobUrl: blob.url,
      pathname: blob.pathname,
      projectId: DEMO_PROJECT_ID,
      contentType: "application/octet-stream",
      size: buf.length,
      createdAt: now,
    });
    console.log("Uploaded demo splat to Blob.");
  }

  const transform = { ...DEMO_TRANSFORM, solvedAt: now };
  await db
    .insert(rooms)
    .values({
      id: DEMO_ROOM_ID,
      projectId: DEMO_PROJECT_ID,
      name: "Living Room",
      splatAssetId: DEMO_SPLAT_ASSET_ID,
      splatFormat: "spz",
      metricTransform: transform,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: rooms.id,
      set: { metricTransform: transform, splatAssetId: DEMO_SPLAT_ASSET_ID, splatFormat: "spz" },
    });

  console.log(`Demo seeded → /project/${DEMO_PROJECT_ID}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
