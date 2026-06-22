/**
 * Drizzle schema — the cloud source of truth (Neon Postgres).
 *
 * Mirrors the app's data model in src/lib/storage/types.ts, plus ownership
 * (`projects.userId`), sharing (`projects.visibility`), the better-auth tables,
 * and an `assets` table backing the Vercel Blob layer.
 *
 * Conventions:
 *  - string PKs from the app's newId() (text columns)
 *  - epoch-millis timestamps as bigint({mode:'number'}) so the `: number` types
 *    in types.ts are unchanged (better-auth tables use its own `timestamp`)
 *  - structural fields (transforms, vectors, dims) as jsonb typed to the app types
 */

import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type {
  JobStatus,
  LayoutPose,
  MetricTransform,
  RoomBounds,
  RoomDimensions,
  Vec3,
} from "@/lib/storage/types";

// --- better-auth core tables (email + password) ---

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// --- domain tables ---

export const projectVisibility = pgEnum("project_visibility", ["private", "public"]);

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    visibility: projectVisibility("visibility").notNull().default("private"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("projects_user_updated_idx").on(t.userId, t.updatedAt)],
);

export const rooms = pgTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    videoAssetId: text("video_asset_id"),
    splatAssetId: text("splat_asset_id"),
    splatFormat: text("splat_format").$type<"spz" | "ply" | "splat" | "ksplat">(),
    splatUpFlip: boolean("splat_up_flip"),
    captureJobId: text("capture_job_id"),
    metricTransform: jsonb("metric_transform").$type<MetricTransform>(),
    bounds: jsonb("bounds").$type<RoomBounds>(),
    dimensions: jsonb("dimensions").$type<RoomDimensions>(),
    layoutPose: jsonb("layout_pose").$type<LayoutPose>(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("rooms_project_idx").on(t.projectId)],
);

export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"worldlabs" | "meshy">().notNull(),
    externalId: text("external_id"),
    status: text("status").$type<JobStatus>().notNull(),
    progress: real("progress"),
    resultAssetId: text("result_asset_id"),
    error: text("error"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("jobs_project_idx").on(t.projectId)],
);

export const measurements = pgTable(
  "measurements",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    endpoints: jsonb("endpoints").$type<[Vec3, Vec3]>().notNull(),
    targetMeters: real("target_meters"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("measurements_room_idx").on(t.roomId)],
);

export const furniture = pgTable(
  "furniture",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sourceImageAssetId: text("source_image_asset_id").notNull(),
    glbAssetId: text("glb_asset_id"),
    jobId: text("job_id"),
    realDims: jsonb("real_dims").$type<RoomDimensions>().notNull(),
    price: real("price"),
    webLink: text("web_link"),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [index("furniture_project_idx").on(t.projectId)],
);

export const placed = pgTable(
  "placed",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    furnitureAssetId: text("furniture_asset_id")
      .notNull()
      .references(() => furniture.id, { onDelete: "cascade" }),
    position: jsonb("position").$type<Vec3>().notNull(),
    rotation: jsonb("rotation").$type<Vec3>().notNull(),
    scale: real("scale").notNull(),
    createdAt: bigint("created_at", { mode: "number" }).notNull(),
    updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
  },
  (t) => [
    index("placed_room_idx").on(t.roomId),
    index("placed_furniture_idx").on(t.furnitureAssetId),
  ],
);

/** Backs the blob layer: maps an opaque assetId → a Vercel Blob public URL. */
export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  blobUrl: text("blob_url").notNull(),
  pathname: text("pathname").notNull(),
  contentType: text("content_type"),
  size: integer("size"),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});
