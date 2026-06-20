import { describe, it, expect } from "vitest";
import { boxesOverlap, findOverlaps, type BoxItem } from "./collision";

const box = (id: string, x: number, z: number, size = 1): BoxItem => ({
  id,
  position: [x, 0, z],
  realDims: { width: size, height: size, depth: size },
  scale: 1,
});

describe("boxesOverlap", () => {
  it("detects overlapping boxes", () => {
    expect(boxesOverlap(box("a", 0, 0), box("b", 0.5, 0))).toBe(true);
  });

  it("treats separated boxes as non-overlapping", () => {
    expect(boxesOverlap(box("a", 0, 0), box("b", 2, 0))).toBe(false);
  });

  it("touching faces do not count as overlap", () => {
    // Two unit boxes centered at x=0 and x=1 touch exactly at x=0.5.
    expect(boxesOverlap(box("a", 0, 0), box("b", 1, 0))).toBe(false);
  });

  it("accounts for scale", () => {
    const big: BoxItem = { id: "big", position: [0, 0, 0], realDims: { width: 1, height: 1, depth: 1 }, scale: 4 };
    expect(boxesOverlap(big, box("b", 1.5, 0))).toBe(true);
  });
});

describe("findOverlaps", () => {
  it("returns every id involved in an overlap", () => {
    const items = [box("a", 0, 0), box("b", 0.3, 0), box("c", 5, 5)];
    const result = findOverlaps(items);
    expect(result.has("a")).toBe(true);
    expect(result.has("b")).toBe(true);
    expect(result.has("c")).toBe(false);
  });

  it("returns empty when nothing overlaps", () => {
    expect(findOverlaps([box("a", 0, 0), box("b", 3, 0)]).size).toBe(0);
  });
});
