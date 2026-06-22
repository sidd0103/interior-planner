/**
 * Room calibration from user-drawn measure segments + a bounds box.
 *
 * Orientation already comes from auto-fit/capture (`metricTransform.rotation`),
 * so the only unknown is scale. Each measurement gives an oriented-space segment
 * length `d` and the real length `L` the user entered; least-squares over them
 * (`solveScale`) yields the raw→meters scale. The bounds box then extrapolates
 * that scale to the whole room:
 *
 *   dimensions = (bounds.max − bounds.min) · scale
 *   translation drops the box floor (bounds.min.y) to world y=0.
 */

import { solveScale } from "./similaritySolve";
import { sub, len } from "./vec3";
import type { Mat3, MetricTransform, RoomBounds, RoomDimensions, Vec3 } from "@/lib/storage/types";

/** Scale+translate part of the metric transform (rotation lives inside oriented space). */
type ScaleTranslate = Pick<MetricTransform, "scale" | "translation">;

/** oriented → world: world = scale·oriented + translation. */
export function orientedToWorld(o: Vec3, t: ScaleTranslate): Vec3 {
  return [
    o[0] * t.scale + t.translation[0],
    o[1] * t.scale + t.translation[1],
    o[2] * t.scale + t.translation[2],
  ];
}

/** world → oriented: oriented = (world − translation) / scale. */
export function worldToOriented(w: Vec3, t: ScaleTranslate): Vec3 {
  const s = t.scale || 1;
  return [
    (w[0] - t.translation[0]) / s,
    (w[1] - t.translation[1]) / s,
    (w[2] - t.translation[2]) / s,
  ];
}

/** Oriented-space measure segment whose real length is known (drives scale). */
export interface MeasuredSpan {
  endpoints: [Vec3, Vec3];
  meters: number;
}

/**
 * Live scale from the user's measured tapes, or `fallback` when none are set.
 * (Used by the calibrator so editing any tape rescales the whole room.)
 */
export function scaleFromSpans(spans: MeasuredSpan[], fallback: number): number {
  if (spans.length === 0) return fallback;
  return solveScale(spans.map((s) => ({ a: s.endpoints[0], b: s.endpoints[1], meters: s.meters })));
}

/** Metric transform for a given scale: keep rotation, drop the box floor to y=0. */
export function transformForScale(
  rotation: Mat3,
  bounds: RoomBounds,
  scale: number,
  now: number,
): MetricTransform {
  return {
    scale,
    rotation,
    translation: [0, -scale * bounds.min[1], 0],
    rmsResidualMeters: 0,
    solvedAt: now,
  };
}

/** Room W×D×H (meters) = oriented bounds extent · scale. */
export function dimensionsForScale(bounds: RoomBounds, scale: number): RoomDimensions {
  return {
    width: (bounds.max[0] - bounds.min[0]) * scale,
    depth: (bounds.max[2] - bounds.min[2]) * scale,
    height: (bounds.max[1] - bounds.min[1]) * scale,
  };
}

export interface CalibrationInput {
  /** Existing orientation (kept as-is). */
  rotation: Mat3;
  /** Room bounds box in oriented space. */
  bounds: RoomBounds;
  /** Measure segments: oriented endpoints + real length in meters. */
  measurements: { endpoints: [Vec3, Vec3]; meters: number }[];
}

export interface CalibrationResult {
  transform: MetricTransform;
  dimensions: RoomDimensions;
  /** |s·dᵢ − Lᵢ| per measurement, meters — surfaces a bad measurement. */
  perResidualMeters: number[];
}

export function recalibrate(input: CalibrationInput, now: number): CalibrationResult {
  const constraints = input.measurements.map((m) => ({
    a: m.endpoints[0],
    b: m.endpoints[1],
    meters: m.meters,
  }));

  const scale = solveScale(constraints);

  const perResidualMeters = constraints.map((c) => Math.abs(scale * len(sub(c.b, c.a)) - c.meters));
  const rms = Math.sqrt(
    perResidualMeters.reduce((s, r) => s + r * r, 0) / Math.max(1, perResidualMeters.length),
  );

  const { min, max } = input.bounds;
  const transform: MetricTransform = {
    scale,
    rotation: input.rotation,
    translation: [0, -scale * min[1], 0], // box floor → y=0
    rmsResidualMeters: rms,
    solvedAt: now,
  };
  const dimensions: RoomDimensions = {
    width: (max[0] - min[0]) * scale,
    depth: (max[2] - min[2]) * scale,
    height: (max[1] - min[1]) * scale,
  };

  return { transform, dimensions, perResidualMeters };
}
