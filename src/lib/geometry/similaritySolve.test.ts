import { describe, it, expect } from "vitest";
import { solveScale, recoverRotation, solveSimilarity, type SpanConstraint } from "./similaritySolve";
import { applyMat3, len, sub } from "./vec3";
import type { Vec3 } from "@/lib/storage/types";

describe("solveScale", () => {
  it("recovers a uniform scale exactly when measurements are consistent", () => {
    const constraints: SpanConstraint[] = [
      { a: [0, 0, 0], b: [2, 0, 0], meters: 5 }, // raw 2 → 5m  ⇒ s = 2.5
      { a: [0, 0, 0], b: [0, 0, 4], meters: 10 }, // raw 4 → 10m ⇒ s = 2.5
      { a: [1, 1, 1], b: [1, 3, 1], meters: 5 }, // raw 2 → 5m  ⇒ s = 2.5
    ];
    expect(solveScale(constraints)).toBeCloseTo(2.5, 6);
  });

  it("least-squares averages inconsistent measurements", () => {
    const constraints: SpanConstraint[] = [
      { a: [0, 0, 0], b: [1, 0, 0], meters: 2 }, // wants s=2
      { a: [0, 0, 0], b: [1, 0, 0], meters: 4 }, // wants s=4
    ];
    // Equal raw lengths ⇒ s = (2+4)/2 = 3.
    expect(solveScale(constraints)).toBeCloseTo(3, 6);
  });
});

describe("recoverRotation", () => {
  it("returns identity with fewer than two floor spans", () => {
    const r = recoverRotation([{ a: [0, 0, 0], b: [1, 0, 0], meters: 1, isFloor: true }]);
    expect(r).toEqual([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  });

  it("maps the floor normal to +Y", () => {
    // Floor spans in a plane whose normal is tilted; a vertical span disambiguates up.
    const constraints: SpanConstraint[] = [
      { a: [0, 0, 0], b: [1, 0, 0], meters: 1, isFloor: true },
      { a: [0, 0, 0], b: [0, 0, 1], meters: 1, isFloor: true },
      { a: [0, 0, 0], b: [0, 1, 0], meters: 1 }, // vertical (wall height)
    ];
    const R = recoverRotation(constraints);
    // The raw floor normal here is ±(0,1,0); after R it must be world up.
    const up = applyMat3(R, [0, 1, 0] as Vec3);
    expect(up[1]).toBeCloseTo(1, 6);
    expect(Math.hypot(up[0], up[2])).toBeLessThan(1e-6);
  });
});

describe("solveSimilarity", () => {
  it("produces near-zero residuals and a metric transform for consistent input", () => {
    const constraints: SpanConstraint[] = [
      { a: [0, 0, 0], b: [2, 0, 0], meters: 4, isFloor: true }, // s ≈ 2
      { a: [0, 0, 0], b: [0, 0, 1.5], meters: 3, isFloor: true },
      { a: [0, 0, 0], b: [0, 1.25, 0], meters: 2.5 }, // wall height
    ];
    const res = solveSimilarity(constraints, 1000);
    expect(res.transform.scale).toBeCloseTo(2, 6);
    for (const r of res.perConstraintResidualMeters) expect(r).toBeLessThan(1e-6);
    expect(res.transform.rmsResidualMeters).toBeLessThan(1e-6);
    expect(res.transform.solvedAt).toBe(1000);
    // Height should reflect the 2.5m wall span.
    expect(res.dimensions.height).toBeCloseTo(2.5, 5);
  });

  it("drops the lowest measured point to the floor (y=0)", () => {
    const constraints: SpanConstraint[] = [
      { a: [0, 1, 0], b: [1, 1, 0], meters: 1, isFloor: true },
      { a: [0, 1, 0], b: [0, 1, 1], meters: 1, isFloor: true },
    ];
    const res = solveSimilarity(constraints, 0);
    const t = res.transform;
    // Transform a measured point and confirm the minimum y lands at 0.
    const p: Vec3 = [0, 1, 0];
    const world = applyMat3(t.rotation, p).map((v, i) => v * t.scale + t.translation[i]) as Vec3;
    expect(world[1]).toBeCloseTo(0, 6);
  });

  it("sanity: identity-scale round trip preserves a known length", () => {
    const a: Vec3 = [1, 0, 2];
    const b: Vec3 = [4, 0, 6];
    const raw = len(sub(b, a)); // 5
    const res = solveSimilarity([{ a, b, meters: raw, isFloor: true }], 0);
    expect(res.transform.scale).toBeCloseTo(1, 6);
  });
});
