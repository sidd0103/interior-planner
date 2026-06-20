/**
 * Core data model for the interior planner.
 *
 * Metadata (everything in this file) lives in IndexedDB via Dexie (see db.ts).
 * Large binaries — room videos, splat files, GLB meshes, measurement
 * screenshots — live in the blob store (OPFS, see blobStore.ts) and are
 * referenced here only by `assetId`.
 */

export type Id = string;

/** A 3-tuple used for positions / rotations / scales in scene space (meters). */
export type Vec3 = [number, number, number];

/** Row-major 3x3 rotation matrix, flattened. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Status shared by all async generation jobs (World Labs, Meshy). */
export type JobStatus = "queued" | "processing" | "done" | "error";

/**
 * Similarity transform recovered by the measurement-reconciliation step.
 * Maps raw splat-space coordinates into metric world space:
 *
 *     world = scale * (R * splatPoint) + translation     (1 unit = 1 meter)
 */
export interface MetricTransform {
  scale: number;
  rotation: Mat3;
  translation: Vec3;
  /** RMS residual (meters) across the constraints used in the solve. */
  rmsResidualMeters: number;
  solvedAt: number;
}

/** Recovered axis-aligned room dimensions, in meters. */
export interface RoomDimensions {
  width: number;
  depth: number;
  height: number;
}

/** Pose of a room within the apartment-level assembly. */
export interface LayoutPose {
  position: Vec3;
  /** Rotation about the world up (Y) axis, radians. */
  yaw: number;
}

export interface Project {
  id: Id;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface Room {
  id: Id;
  projectId: Id;
  name: string;
  /** Blob key for the source capture video, if retained. */
  videoAssetId?: Id;
  /** Blob key for the generated splat (.ply / .ksplat / .spz). */
  splatAssetId?: Id;
  /** The in-flight or completed World Labs capture job. */
  captureJobId?: Id;
  /** Similarity transform that makes the splat metric (set after reconciliation). */
  metricTransform?: MetricTransform;
  /** Recovered W×D×H once the room is scaled. */
  dimensions?: RoomDimensions;
  /** Placement within the apartment assembly view. */
  layoutPose?: LayoutPose;
  createdAt: number;
  updatedAt: number;
}

/** A long-running generation job (World Labs splat or Meshy mesh). */
export interface Job {
  id: Id;
  kind: "worldlabs" | "meshy";
  /** Provider-side task/world id used for polling. */
  externalId?: string;
  status: JobStatus;
  /** 0..1 progress when the provider reports it. */
  progress?: number;
  /** Blob key for the downloaded result once `done`. */
  resultAssetId?: Id;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * One measurement extracted from an iPhone Measure screenshot, plus the
 * user's association of that measurement with a span in the 3D splat.
 */
export interface Measurement {
  id: Id;
  roomId: Id;
  /** Blob key for the source screenshot. */
  screenshotAssetId: Id;
  /** Numeric magnitude as read by the vision model, e.g. 2.4. */
  value: number;
  /** Unit as read, normalized. */
  unit: "m" | "cm" | "mm" | "ft" | "in";
  /** The value converted to meters (canonical form used by the solver). */
  meters: number;
  /** Free-text description of what the line measures, from the vision model. */
  label?: string;
  /** Vision model's confidence 0..1, if provided. */
  confidence?: number;
  /**
   * The two endpoints the user clicked in raw splat space that correspond to
   * this measured span. Required before the measurement contributes to the solve.
   */
  endpointsSplat?: [Vec3, Vec3];
  /** Marks a span the user tagged as lying on the floor (used to recover "up"). */
  isFloorSpan?: boolean;
  createdAt: number;
  updatedAt: number;
}

/** A generated 3D furniture asset (Meshy image-to-3D output). */
export interface FurnitureAsset {
  id: Id;
  projectId: Id;
  name: string;
  /** Blob key for the source product photo. */
  sourceImageAssetId: Id;
  /** Blob key for the generated GLB, once `done`. */
  glbAssetId?: Id;
  /** The Meshy job that produced (or is producing) the GLB. */
  jobId?: Id;
  /** Real-world bounding dimensions in meters, used to scale the raw mesh. */
  realDims: RoomDimensions;
  createdAt: number;
  updatedAt: number;
}

/** An instance of a furniture asset placed inside a room. */
export interface PlacedFurniture {
  id: Id;
  roomId: Id;
  furnitureAssetId: Id;
  position: Vec3;
  /** Euler XYZ rotation, radians. */
  rotation: Vec3;
  /** Uniform scale multiplier on top of the asset's real-world scaling. */
  scale: number;
  createdAt: number;
  updatedAt: number;
}
