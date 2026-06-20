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
