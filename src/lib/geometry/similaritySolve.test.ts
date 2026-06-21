import { describe, it, expect } from "vitest";
import { solveScale, type SpanConstraint } from "./similaritySolve";

describe("solveScale", () => {
  it("recovers a uniform scale exactly when measurements are consistent", () => {
    const constraints: SpanConstraint[] = [
      { a: [0, 0, 0], b: [2, 0, 0], meters: 5 }, // 2 → 5m  ⇒ s = 2.5
      { a: [0, 0, 0], b: [0, 0, 4], meters: 10 }, // 4 → 10m ⇒ s = 2.5
      { a: [1, 1, 1], b: [1, 3, 1], meters: 5 }, // 2 → 5m  ⇒ s = 2.5
    ];
    expect(solveScale(constraints)).toBeCloseTo(2.5, 6);
  });

  it("least-squares averages inconsistent measurements", () => {
    const constraints: SpanConstraint[] = [
      { a: [0, 0, 0], b: [1, 0, 0], meters: 2 }, // wants s=2
      { a: [0, 0, 0], b: [1, 0, 0], meters: 4 }, // wants s=4
    ];
    expect(solveScale(constraints)).toBeCloseTo(3, 6); // equal lengths ⇒ mean
  });

  it("returns 1 with no usable constraints", () => {
    expect(solveScale([{ a: [0, 0, 0], b: [0, 0, 0], meters: 2 }])).toBe(1);
  });
});
