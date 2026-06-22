"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import * as repo from "@/lib/storage/repo";
import {
  worldToOriented,
  scaleFromSpans,
  transformForScale,
  dimensionsForScale,
} from "@/lib/geometry/calibrate";
import { IDENTITY3 } from "@/lib/geometry/vec3";
import type { Mat3, Measurement, MetricTransform, Room, RoomBounds, Vec3 } from "@/lib/storage/types";

const IDENTITY_T: MetricTransform = {
  scale: 1,
  rotation: IDENTITY3,
  translation: [0, 0, 0],
  rmsResidualMeters: 0,
  solvedAt: 0,
};

export type CalibTool = "measure" | "bounds";

interface Base {
  rotation: Mat3;
  fallbackScale: number;
  t: MetricTransform;
}

const measuredSpans = (list: Measurement[]) =>
  list
    .filter((m) => m.targetMeters != null)
    .map((m) => ({ endpoints: m.endpoints, meters: m.targetMeters as number }));

/** Everything the calibration panel + 3D tools need; see useCalibration. */
export type Calibration = ReturnType<typeof useCalibration>;

/**
 * Draw-in-3D calibration shared between the editor canvas (tape/bounds tools)
 * and the side panel. Persistence is **event-driven** — each mutation computes
 * the resulting transform and writes it directly, with no effect watching
 * derived state (effect-driven persistence caused re-render cascades that
 * remounted the panel and reloaded the splat).
 */
export function useCalibration(room: Room | undefined, onPersist: () => void) {
  const roomId = room?.id;
  const { data: measurements, mutate } = useSWR(
    roomId ? ["measurements", roomId] : null,
    () => repo.listMeasurements(roomId as string),
  );
  const placed = useMemo(() => measurements ?? [], [measurements]);

  // Orientation + fallback scale (used until a tape is measured). Derived from
  // the room; existing tape/bounds coords are in scale-invariant oriented
  // space, so a live scale change never corrupts them.
  const base: Base = useMemo(
    () => ({
      rotation: room?.metricTransform?.rotation ?? IDENTITY3,
      fallbackScale: room?.metricTransform?.scale ?? 1,
      t: room?.metricTransform ?? IDENTITY_T,
    }),
    [room?.metricTransform],
  );

  const [tool, setTool] = useState<CalibTool>("measure");
  const [draft, setDraft] = useState<Vec3 | null>(null);
  // Local bounds edits; null falls back to the room's saved/default box.
  const [boundsEdit, setBoundsEdit] = useState<RoomBounds | null>(null);

  const bounds: RoomBounds = useMemo(
    () =>
      boundsEdit ??
      room?.bounds ?? {
        min: worldToOriented([-2.5, 0, -2.5], base.t),
        max: worldToOriented([2.5, 2.5, 2.5], base.t),
      },
    [boundsEdit, room?.bounds, base.t],
  );

  const scale = useMemo(
    () => scaleFromSpans(measuredSpans(placed), base.fallbackScale),
    [placed, base.fallbackScale],
  );
  const transform = useMemo(
    () => transformForScale(base.rotation, bounds, scale, 0),
    [base.rotation, bounds, scale],
  );
  const dimensions = useMemo(() => dimensionsForScale(bounds, scale), [bounds, scale]);

  // Persist the result of a change directly (no effect): compute scale from the
  // next measured set + bounds and write the transform/dimensions.
  async function persist(nextList: Measurement[], nextBounds: RoomBounds) {
    if (!roomId) return;
    const s = scaleFromSpans(measuredSpans(nextList), base.fallbackScale);
    await repo.updateRoom(roomId, {
      metricTransform: transformForScale(base.rotation, nextBounds, s, Date.now()),
      bounds: nextBounds,
      dimensions: dimensionsForScale(nextBounds, s),
    });
    onPersist();
  }

  async function onPlaceWorld(world: Vec3) {
    if (tool !== "measure" || !roomId) return;
    const o = worldToOriented(world, transform);
    if (!draft) {
      setDraft(o);
      return;
    }
    // A fresh tape has no measured length yet, so the scale is unchanged — just
    // record the segment (no room persist needed).
    await repo.addMeasurement({ roomId, endpoints: [draft, o] });
    setDraft(null);
    mutate();
  }

  async function onMoveEndpoint(id: string, which: 0 | 1, world: Vec3) {
    const m = placed.find((x) => x.id === id);
    if (!m) return;
    const o = worldToOriented(world, transform);
    const endpoints: [Vec3, Vec3] = which === 0 ? [o, m.endpoints[1]] : [m.endpoints[0], o];
    await repo.updateMeasurement(id, { endpoints });
    if (m.targetMeters != null) {
      // Moving a measured tape changes its native length → rescales the room.
      await persist(
        placed.map((x) => (x.id === id ? { ...x, endpoints } : x)),
        bounds,
      );
    }
    mutate();
  }

  function onBoundsChangeWorld(minW: Vec3, maxW: Vec3) {
    const nb: RoomBounds = {
      min: worldToOriented(minW, transform),
      max: worldToOriented(maxW, transform),
    };
    setBoundsEdit(nb);
    void persist(placed, nb);
  }

  async function setTarget(id: string, meters: number) {
    await repo.updateMeasurement(id, { targetMeters: meters });
    await persist(
      placed.map((x) => (x.id === id ? { ...x, targetMeters: meters } : x)),
      bounds,
    );
    mutate();
  }

  async function remove(id: string) {
    const m = placed.find((x) => x.id === id);
    await repo.deleteMeasurement(id);
    if (m?.targetMeters != null) {
      await persist(
        placed.filter((x) => x.id !== id),
        bounds,
      );
    }
    mutate();
  }

  /** Clear transient edit state (called when leaving calibration). */
  function reset() {
    setDraft(null);
    setBoundsEdit(null);
    setTool("measure");
  }

  return {
    measurements: placed,
    tool,
    setTool,
    draft,
    bounds,
    transform,
    scale,
    dimensions,
    onPlaceWorld,
    onMoveEndpoint,
    onBoundsChangeWorld,
    setTarget,
    remove,
    reset,
  };
}
