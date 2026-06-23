/**
 * Server-side demo seed (run: `npm run db:seed`). Idempotent.
 *
 * Clones a curated source project's rooms, furniture, placements, measurements
 * and blobs into a single PUBLIC "Demo Apartment" owned by a system user, so
 * anyone — including logged-out visitors — can explore a rich, real apartment at
 * /project/demo-apartment. Re-running refreshes the demo from the source.
 *
 * Self-contained (relative imports, inline client) so tsx can run it directly.
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { copy, del } from "@vercel/blob";
import { user, projects, rooms, furniture, placed, measurements, assets } from "./schema";

const SYSTEM_USER_ID = "system-demo";
const DEMO_PROJECT_ID = "demo-apartment";
const SOURCE_PROJECT_ID = "b2adb5f3-afec-4573-a4aa-c319333462fe"; // "Lundys Apartment"

const newId = () => crypto.randomUUID();

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN required");

  const db = drizzle(neon(process.env.DATABASE_URL), {
    schema: { user, projects, rooms, furniture, placed, measurements, assets },
  });
  const now = Date.now();

  // Source must exist + have content; otherwise leave the current demo untouched.
  const srcRooms = await db.select().from(rooms).where(eq(rooms.projectId, SOURCE_PROJECT_ID));
  if (srcRooms.length === 0) {
    throw new Error(`Source project ${SOURCE_PROJECT_ID} has no rooms — nothing to clone.`);
  }
  const srcFurniture = await db
    .select()
    .from(furniture)
    .where(eq(furniture.projectId, SOURCE_PROJECT_ID));

  // --- System user + public demo project ---
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
    .onConflictDoUpdate({ target: projects.id, set: { visibility: "public", name: "Demo Apartment" } });

  // --- Clear any previous demo content (so re-seeding is a clean refresh) ---
  const oldDemoAssets = await db
    .select({ url: assets.blobUrl })
    .from(assets)
    .where(eq(assets.projectId, DEMO_PROJECT_ID));
  if (oldDemoAssets.length) {
    try {
      await del(oldDemoAssets.map((a) => a.url));
    } catch {
      /* best-effort blob cleanup */
    }
  }
  await db.delete(assets).where(eq(assets.projectId, DEMO_PROJECT_ID));
  await db.delete(rooms).where(eq(rooms.projectId, DEMO_PROJECT_ID)); // cascade placed + measurements
  await db.delete(furniture).where(eq(furniture.projectId, DEMO_PROJECT_ID));

  // --- Copy a source asset's blob into the demo + register a demo-owned row ---
  const assetMap = new Map<string, string>();
  async function copyAsset(oldId: string | null): Promise<string | null> {
    if (!oldId) return null;
    const cached = assetMap.get(oldId);
    if (cached) return cached;
    const rows = await db.select().from(assets).where(eq(assets.id, oldId)).limit(1);
    const a = rows[0];
    if (!a) return null;
    const base = a.pathname.split("/").pop() || "asset";
    const id = newId();
    const copied = await copy(a.blobUrl, `demo/${id}-${base}`, {
      access: "private",
      contentType: a.contentType ?? undefined,
    });
    await db.insert(assets).values({
      id,
      blobUrl: copied.url,
      pathname: copied.pathname,
      projectId: DEMO_PROJECT_ID,
      contentType: a.contentType,
      size: a.size,
      createdAt: now,
    });
    assetMap.set(oldId, id);
    return id;
  }

  // --- Furniture (placements reference these) ---
  const furnMap = new Map<string, string>();
  for (const f of srcFurniture) {
    const id = newId();
    await db.insert(furniture).values({
      id,
      projectId: DEMO_PROJECT_ID,
      name: f.name,
      sourceImageAssetId: (await copyAsset(f.sourceImageAssetId)) ?? "",
      glbAssetId: await copyAsset(f.glbAssetId),
      jobId: null,
      realDims: f.realDims,
      price: f.price,
      webLink: f.webLink,
      createdAt: now,
      updatedAt: now,
    });
    furnMap.set(f.id, id);
  }

  // --- Rooms + their measurements + placements ---
  for (const r of srcRooms) {
    const roomId = newId();
    await db.insert(rooms).values({
      id: roomId,
      projectId: DEMO_PROJECT_ID,
      name: r.name,
      videoAssetId: await copyAsset(r.videoAssetId),
      splatAssetId: await copyAsset(r.splatAssetId),
      splatFormat: r.splatFormat,
      splatUpFlip: r.splatUpFlip,
      captureJobId: null,
      metricTransform: r.metricTransform,
      bounds: r.bounds,
      dimensions: r.dimensions,
      layoutPose: r.layoutPose,
      createdAt: now,
      updatedAt: now,
    });

    const ms = await db.select().from(measurements).where(eq(measurements.roomId, r.id));
    for (const m of ms) {
      await db.insert(measurements).values({
        id: newId(),
        roomId,
        endpoints: m.endpoints,
        targetMeters: m.targetMeters,
        createdAt: now,
        updatedAt: now,
      });
    }

    const ps = await db.select().from(placed).where(eq(placed.roomId, r.id));
    for (const p of ps) {
      const nf = furnMap.get(p.furnitureAssetId);
      if (!nf) continue;
      await db.insert(placed).values({
        id: newId(),
        roomId,
        furnitureAssetId: nf,
        position: p.position,
        rotation: p.rotation,
        scale: p.scale,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  console.log(
    `Demo seeded → /project/${DEMO_PROJECT_ID}: ${srcRooms.length} rooms, ${srcFurniture.length} furniture, ${assetMap.size} assets copied.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
