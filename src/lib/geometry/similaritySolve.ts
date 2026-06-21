/**
 * Least-squares scale recovery.
 *
 * Orientation comes from auto-fit/capture, so calibration only needs scale.
 * Each constraint is a segment of length `dᵢ` (in oriented/native units) the
 * user measured to be `Lᵢ` meters; the best uniform scale through the origin is
 *   s = Σ(dᵢ·Lᵢ) / Σ(dᵢ²).
 */

import { sub, len } from "./vec3";
import type { Vec3 } from "@/lib/storage/types";

export interface SpanConstraint {
  /** Segment endpoints (oriented/native space). */
  a: Vec3;
  b: Vec3;
  /** Real-world length of the segment, meters. */
  meters: number;
}

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
