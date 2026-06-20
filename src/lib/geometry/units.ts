import type { Measurement } from "@/lib/storage/types";

const TO_METERS: Record<Measurement["unit"], number> = {
  m: 1,
  cm: 0.01,
  mm: 0.001,
  ft: 0.3048,
  in: 0.0254,
};

/** Convert a measured value + unit to meters. */
export function toMeters(value: number, unit: Measurement["unit"]): number {
  return value * TO_METERS[unit];
}
