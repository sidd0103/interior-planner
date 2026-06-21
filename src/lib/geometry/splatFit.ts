/**
 * Auto-fit a metric transform for an imported splat using only its geometry —
 * no World Labs API metadata required.
 *
 * Splats arrive in different vertical conventions depending on the source
 * (Marble API downloads are Y-down; Marble *website* exports are Y-up), and
 * which horizontal plane is the floor vs. ceiling is genuinely ambiguous from
 * geometry alone (rooms are roughly symmetric, and outpainted exteriors skew
 * any heuristic). So we don't try to auto-detect it: callers pass `flipUp`
 * (default off, correct for website exports), with a UI toggle to flip when
 * wrong.
 *
 * Given the flip choice we:
 *   - rotate to that frame (identity, or 180° about X),
 *   - read the floor as a low Y-percentile (robust to a few stray gaussians),
 *   - translate the floor to y=0,
 *   - keep scale = 1 (Marble exports are already metric; the Measure-screenshot
 *     reconciler refines exact scale when needed).
 */

import { applyMat3, ROT_X180, IDENTITY3 } from "./vec3";
import type { Vec3, MetricTransform } from "@/lib/storage/types";

export function fitTransformFromPoints(
  rawPoints: Vec3[],
  flipUp: boolean,
  now: number,
): MetricTransform {
  const rotation = flipUp ? ROT_X180 : IDENTITY3;

  const ys: number[] = [];
  for (const p of rawPoints) ys.push(applyMat3(rotation, p)[1]);
  ys.sort((a, b) => a - b);

  // Floor ≈ 2nd percentile (ignores a handful of below-floor floaters).
  const floorY = ys[Math.min(ys.length - 1, Math.floor(ys.length * 0.02))];

  return {
    scale: 1,
    rotation,
    translation: [0, -floorY, 0], // drop the floor to y=0
    rmsResidualMeters: 0,
    solvedAt: now,
  };
}
