/**
 * Lightweight collision helpers for furniture placement. We use axis-aligned
 * bounding boxes derived from each item's real-world dimensions (yaw ignored —
 * a good-enough approximation for overlap *highlighting*, not physics). The
 * editor uses this to flag intersecting furniture so the user can fix it.
 */

import type { Vec3, RoomDimensions } from "@/lib/storage/types";

export interface BoxItem {
  id: string;
  /** Group position (furniture rests on the floor, so y is the base). */
  position: Vec3;
  realDims: RoomDimensions;
  scale: number;
}

/** A world-space axis-aligned box (the room bounds). */
export interface WorldAABB {
  min: Vec3;
  max: Vec3;
}

interface AABB {
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
}

function toAABB(item: BoxItem): AABB {
  const w = item.realDims.width * item.scale;
  const h = item.realDims.height * item.scale;
  const d = item.realDims.depth * item.scale;
  const [x, y, z] = item.position;
  return { cx: x, cy: y + h / 2, cz: z, hx: w / 2, hy: h / 2, hz: d / 2 };
}

/** True if two boxes overlap on all three axes (touching faces don't count). */
export function boxesOverlap(a: BoxItem, b: BoxItem): boolean {
  const A = toAABB(a);
  const B = toAABB(b);
  return (
    Math.abs(A.cx - B.cx) < A.hx + B.hx &&
    Math.abs(A.cy - B.cy) < A.hy + B.hy &&
    Math.abs(A.cz - B.cz) < A.hz + B.hz
  );
}

/** Ids of all items that intersect at least one other item. */
export function findOverlaps(items: BoxItem[]): Set<string> {
  const overlapping = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (boxesOverlap(items[i], items[j])) {
        overlapping.add(items[i].id);
        overlapping.add(items[j].id);
      }
    }
  }
  return overlapping;
}

/** True if the item's footprint stays within the room bounds (X/Z), with tolerance. */
export function withinBoundsXZ(item: BoxItem, box: WorldAABB, tol = 0.02): boolean {
  const hw = (item.realDims.width * item.scale) / 2;
  const hd = (item.realDims.depth * item.scale) / 2;
  const [x, , z] = item.position;
  return (
    x - hw >= box.min[0] - tol &&
    x + hw <= box.max[0] + tol &&
    z - hd >= box.min[2] - tol &&
    z + hd <= box.max[2] + tol
  );
}

/** Soft-snap an item's footprint to a nearby wall (within `threshold`). Returns the adjusted position. */
export function snapToWalls(item: BoxItem, box: WorldAABB, threshold = 0.12): Vec3 {
  let [x, , z] = item.position;
  const y = item.position[1];
  const hw = (item.realDims.width * item.scale) / 2;
  const hd = (item.realDims.depth * item.scale) / 2;
  if (Math.abs(x - hw - box.min[0]) < threshold) x = box.min[0] + hw;
  else if (Math.abs(x + hw - box.max[0]) < threshold) x = box.max[0] - hw;
  if (Math.abs(z - hd - box.min[2]) < threshold) z = box.min[2] + hd;
  else if (Math.abs(z + hd - box.max[2]) < threshold) z = box.max[2] - hd;
  return [x, y, z];
}
