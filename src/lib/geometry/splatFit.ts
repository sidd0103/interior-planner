/**
 * Auto-fit a metric transform for an imported splat using only its geometry —
 * no World Labs API metadata required.
 *
 * Marble splats share a fixed convention: Y-down / Z-forward, with the
 * coordinate origin at the capture point (where the phone was). So:
 *   - rotation = ROT_X180 puts it Y-up (floor below the origin).
 *   - the floor level is the low percentile of Y across the points (robust to a
 *     few stray gaussians beneath the floor).
 *   - the capture point sits a typical eye height (~1.5 m) above the floor, so
 *     scale ≈ 1.5 / (origin-to-floor distance) — which lands near 1 for splats
 *     already exported in metric units, and normalizes native-unit splats.
 *   - translation drops the floor to y=0 (origin → eye height, inside the room).
 *
 * The result is a good default; the Measure-screenshot reconciler still refines
 * it to exact metric scale when needed.
 */

import { applyMat3, ROT_X180 } from "./vec3";
import type { Vec3, MetricTransform } from "@/lib/storage/types";

const ASSUMED_EYE_HEIGHT_M = 1.5;

export function fitTransformFromPoints(rawPoints: Vec3[], now: number): MetricTransform {
  // Rotate into a Y-up frame, then read off the floor height.
  const ys: number[] = [];
  for (const p of rawPoints) ys.push(applyMat3(ROT_X180, p)[1]);
  ys.sort((a, b) => a - b);

  // Floor ≈ 2nd percentile (ignores a handful of below-floor floaters).
  const floorY = ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.02))];

  // origin (raw 0,0,0) maps to y=0 after rotation; floor is below it.
  const originToFloor = Math.max(0.3, -floorY);
  const scale = ASSUMED_EYE_HEIGHT_M / originToFloor;

  return {
    scale,
    rotation: ROT_X180,
    // After scaling, the floor sits at scale·floorY; lift it to y=0.
    translation: [0, -scale * floorY, 0],
    rmsResidualMeters: 0,
    solvedAt: now,
  };
}
