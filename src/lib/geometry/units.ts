/**
 * Unit system + length/area formatting.
 *
 * World space is metric (1 unit = 1 meter), so everything downstream works in
 * meters; these helpers only format for display and parse user input. The user
 * picks one system (imperial or metric) and all UI follows it:
 *   - imperial: lengths as feet + inches, areas as ft²
 *   - metric:   lengths as meters (2 decimals), areas as m²
 */

export type UnitSystem = "imperial" | "metric";

const IN_PER_M = 1 / 0.0254;
const FT_PER_M = 1 / 0.3048;

/** Format a length in meters for the given system, e.g. `8′ 4.0″` or `2.54 m`. */
export function formatLength(meters: number, sys: UnitSystem): string {
  if (sys === "metric") return `${meters.toFixed(2)} m`;
  const totalInches = meters * IN_PER_M;
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches - feet * 12;
  return feet > 0 ? `${feet}′ ${inches.toFixed(1)}″` : `${inches.toFixed(1)}″`;
}

/** Format a floor area in square meters, e.g. `134.6 ft²` or `12.5 m²`. */
export function formatArea(sqMeters: number, sys: UnitSystem): string {
  if (sys === "metric") return `${sqMeters.toFixed(1)} m²`;
  return `${(sqMeters * FT_PER_M * FT_PER_M).toFixed(1)} ft²`;
}

/** feet + inches → meters. */
export function feetInchesToMeters(feet: number, inches: number): number {
  return (feet * 12 + inches) * 0.0254;
}

/** meters → whole feet + remainder inches (for prefilling imperial inputs). */
export function metersToFeetInches(meters: number): { feet: number; inches: number } {
  const totalInches = meters * IN_PER_M;
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: totalInches - feet * 12 };
}
