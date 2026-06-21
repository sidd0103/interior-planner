import { describe, it, expect } from "vitest";
import { recalibrate } from "./calibrate";
import { IDENTITY3 } from "./vec3";
import type { Vec3 } from "@/lib/storage/types";

describe("recalibrate", () => {
  it("recovers scale and extrapolates the bounds to metric dimensions", () => {
    // Oriented-space room: a 4×3×2.5 (native) box; one measure segment of
    // native length 4 measured as 8 m ⇒ scale 2 ⇒ room 8×5×6.25 m.
    const res = recalibrate(
      {
        rotation: IDENTITY3,
        bounds: { min: [0, 0, 0] as Vec3, max: [4, 2.5, 3] as Vec3 },
        measurements: [{ endpoints: [[0, 0, 0], [4, 0, 0]], meters: 8 }],
      },
      1000,
    );

    expect(res.transform.scale).toBeCloseTo(2, 6);
    expect(res.transform.solvedAt).toBe(1000);
    expect(res.dimensions.width).toBeCloseTo(8, 6);
    expect(res.dimensions.height).toBeCloseTo(5, 6);
    expect(res.dimensions.depth).toBeCloseTo(6, 6);
    expect(res.perResidualMeters[0]).toBeLessThan(1e-9);
  });

  it("drops the bounds floor to world y=0", () => {
    const res = recalibrate(
      {
        rotation: IDENTITY3,
        bounds: { min: [0, 1.2, 0] as Vec3, max: [2, 3.2, 2] as Vec3 }, // floor at oriented y=1.2
        measurements: [{ endpoints: [[0, 0, 0], [1, 0, 0]], meters: 3 }], // scale 3
      },
      0,
    );
    // translation.y = -scale * min.y = -3 * 1.2; floor world y = scale*1.2 + t.y = 0.
    expect(res.transform.translation[1]).toBeCloseTo(-3.6, 6);
    expect(res.transform.scale * 1.2 + res.transform.translation[1]).toBeCloseTo(0, 6);
  });
});
