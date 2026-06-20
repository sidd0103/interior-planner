import type { Vec3, RoomDimensions } from "@/lib/storage/types";

/**
 * View-model for one furniture instance in the 3D scene. Decouples the scene
 * components from the storage layer: pages map PlacedFurniture + FurnitureAsset
 * into these and pass them in.
 */
export interface SceneItem {
  /** PlacedFurniture id. */
  id: string;
  label: string;
  /** Resolved object URL of the GLB, if generated; otherwise a placeholder box is shown. */
  glbUrl?: string;
  /** Real-world bounding dims (meters) the raw mesh is normalized to. */
  realDims: RoomDimensions;
  position: Vec3;
  /** Euler XYZ radians. */
  rotation: Vec3;
  scale: number;
}

/** Transform patch emitted when the user moves/rotates/scales an item. */
export interface TransformPatch {
  position: Vec3;
  rotation: Vec3;
  scale: number;
}
