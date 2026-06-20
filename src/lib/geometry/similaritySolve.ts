/**
 * Metric-scale reconciliation.
 *
 * A World Labs splat comes out in an arbitrary similarity frame: unknown scale,
 * orientation, and origin. The user supplies a handful of measured spans — for
 * each, the two endpoints in raw splat space (placed in the 3D view) and the
 * real length in meters (read from an iPhone Measure screenshot). From these we
 * solve a similarity transform  world = scale · (R · p) + t  that makes the
 * splat metric and gravity-aligned.
 *
 *   scale  — least-squares fit over all spans (over-constrained):
 *              s = Σ(dᵢ·Lᵢ) / Σ(dᵢ²),  dᵢ = raw span length, Lᵢ = metric length.
 *   R      — recovered from ≥2 non-parallel spans the user tagged as lying on
 *            the floor: their cross product is the floor normal → mapped to +Y;
 *            the longest floor span → +X. Falls back to identity (assume the
 *            splat is already up-aligned) when <2 floor spans are given.
 *   t      — drops the lowest measured point to y=0 and centers the footprint.
 */

import type { Vec3, Mat3, MetricTransform, RoomDimensions } from "@/lib/storage/types";
import { sub, dot, cross, len, normalize, applyMat3, scale as vscale, IDENTITY3 } from "./vec3";

export interface SpanConstraint {
  /** Endpoints in raw splat space. */
  a: Vec3;
  b: Vec3;
  /** Real-world length of the span, meters. */
  meters: number;
  /** True if the span lies on the floor (contributes to orientation recovery). */
  isFloor?: boolean;
}

export interface SolveResult {
  transform: MetricTransform;
  dimensions: RoomDimensions;
  /** |s·dᵢ − Lᵢ| per input constraint, meters — surfaces a bad measurement. */
  perConstraintResidualMeters: number[];
}

/** Least-squares uniform scale through the origin. */
export function solveScale(constraints: SpanConstraint[]): number {
  let num = 0;
  let den = 0;
  for (const c of constraints) {
    const d = len(sub(c.b, c.a));
    num += d * c.meters;
    den += d * d;
  }
  return den > 1e-12 ? num / den : 1;
}

/**
 * Recover the rotation that maps splat space to a gravity-aligned world frame.
 * Returns identity if fewer than two non-parallel floor spans are available.
 */
export function recoverRotation(constraints: SpanConstraint[]): Mat3 {
  const floor = constraints.filter((c) => c.isFloor);
  if (floor.length < 2) return IDENTITY3;

  // Floor-plane directions.
  const dirs = floor.map((c) => normalize(sub(c.b, c.a)));

  // Pick the two most non-parallel directions for a stable normal.
  let best: { n: Vec3; cosAbs: number } | null = null;
  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const cosAbs = Math.abs(dot(dirs[i], dirs[j]));
      const n = normalize(cross(dirs[i], dirs[j]));
      if (len(n) < 1e-6) continue;
      if (!best || cosAbs < best.cosAbs) best = { n, cosAbs };
    }
  }
  if (!best) return IDENTITY3;
  let n = best.n;

  // Orient the normal "up": a non-floor span (e.g. wall height) should point
  // mostly +Y. If we have one and it points the other way, flip the normal.
  const vertical = constraints.find((c) => !c.isFloor);
  if (vertical) {
    const vdir = normalize(sub(vertical.b, vertical.a));
    if (dot(vdir, n) < 0) n = vscale(n, -1);
  }

  // In-plane reference axis: longest floor span, projected onto the floor plane.
  const longest = floor
    .map((c) => sub(c.b, c.a))
    .sort((p, q) => len(q) - len(p))[0];
  let ex = sub(longest, vscale(n, dot(longest, n)));
  ex = normalize(ex);
  if (len(ex) < 1e-6) return IDENTITY3;
  const ey = n;
  const ez = normalize(cross(ex, ey));

  // Rows are the splat-space world axes → row-major Mat3 maps splat → world.
  return [ex[0], ex[1], ex[2], ey[0], ey[1], ey[2], ez[0], ez[1], ez[2]];
}

/** Full similarity solve. `now` is injected so the function stays deterministic/testable. */
export function solveSimilarity(constraints: SpanConstraint[], now: number): SolveResult {
  const scale = solveScale(constraints);
  const rotation = recoverRotation(constraints);

  // Transform all endpoints by scale·R (translation resolved next).
  const pts: Vec3[] = [];
  for (const c of constraints) {
    pts.push(vscale(applyMat3(rotation, c.a), scale));
    pts.push(vscale(applyMat3(rotation, c.b), scale));
  }

  // Bounds for translation + (approximate) dimensions.
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }

  // Drop lowest point to y=0; center footprint over origin.
  const translation: Vec3 = [
    -(min[0] + max[0]) / 2,
    -min[1],
    -(min[2] + max[2]) / 2,
  ];

  // Residuals.
  const perConstraintResidualMeters = constraints.map((c) =>
    Math.abs(scale * len(sub(c.b, c.a)) - c.meters),
  );
  const rms = Math.sqrt(
    perConstraintResidualMeters.reduce((s, r) => s + r * r, 0) /
      Math.max(1, perConstraintResidualMeters.length),
  );

  const dimensions: RoomDimensions = {
    width: max[0] - min[0],
    depth: max[2] - min[2],
    height: max[1] - min[1],
  };

  return {
    transform: { scale, rotation, translation, rmsResidualMeters: rms, solvedAt: now },
    dimensions,
    perConstraintResidualMeters,
  };
}
