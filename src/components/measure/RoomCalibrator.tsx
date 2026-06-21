"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import useSWR from "swr";
import { FirstPersonControls } from "@/components/scene/FirstPersonControls";
import { SplatStage } from "@/components/scene/SplatStage";
import { CalibrateScene } from "./CalibrateScene";
import { type WorldBox } from "./BoundsBox";
import { useAssetUrl } from "@/lib/storage/useAssetUrl";
import * as repo from "@/lib/storage/repo";
import { recalibrate, orientedToWorld, worldToOriented } from "@/lib/geometry/calibrate";
import { len, sub, IDENTITY3 } from "@/lib/geometry/vec3";
import { toMeters } from "@/lib/geometry/units";
import type { MeasureUnit, MetricTransform, Room, RoomBounds, Vec3 } from "@/lib/storage/types";

const IDENTITY_T: MetricTransform = {
  scale: 1,
  rotation: IDENTITY3,
  translation: [0, 0, 0],
  rmsResidualMeters: 0,
  solvedAt: 0,
};

const UNITS: MeasureUnit[] = ["m", "cm", "mm", "ft", "in"];

interface Props {
  room: Room;
  onClose: () => void;
  onCalibrated: () => void;
}

/**
 * Draw-in-3D room calibration: a measure-tape tool (click two points on the
 * splat, enter the real length) calibrates scale, and a room-bounds box
 * extrapolates that scale to the whole room's metric dimensions.
 */
export function RoomCalibrator({ room, onClose, onCalibrated }: Props) {
  const splatUrl = useAssetUrl(room.splatAssetId);
  const { data: measurements, mutate } = useSWR(["measurements", room.id], () =>
    repo.listMeasurements(room.id),
  );
  const t = room.metricTransform ?? IDENTITY_T;

  const [tool, setTool] = useState<"measure" | "bounds">("measure");
  const [draft, setDraft] = useState<Vec3 | null>(null); // oriented
  const [bounds, setBounds] = useState<RoomBounds>(
    () =>
      room.bounds ?? {
        min: worldToOriented([-2.5, 0, -2.5], t),
        max: worldToOriented([2.5, 2.5, 2.5], t),
      },
  );
  const [residuals, setResiduals] = useState<Record<string, number>>({});
  const [rms, setRms] = useState<number | null>(null);
  const [err, setErr] = useState<string>();

  const placeRef = useRef<((x: number, y: number) => void) | undefined>(undefined);
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const initialView = useMemo(() => {
    const tr = t.translation;
    const eyeY = Math.max(tr[1], 1.4);
    return {
      position: [tr[0], eyeY, tr[2]] as Vec3,
      target: [tr[0], eyeY, tr[2] - 3] as Vec3,
    };
  }, [t]);

  async function onPlaceWorld(world: Vec3) {
    if (tool !== "measure") return;
    const o = worldToOriented(world, t);
    if (!draft) {
      setDraft(o);
      return;
    }
    const worldDist = len(sub(world, orientedToWorld(draft, t)));
    await repo.addMeasurement({
      roomId: room.id,
      endpoints: [draft, o],
      value: +worldDist.toFixed(2),
      unit: "m",
      meters: worldDist,
    });
    setDraft(null);
    mutate();
  }

  async function onMoveEndpoint(id: string, which: 0 | 1, world: Vec3) {
    const m = measurements?.find((x) => x.id === id);
    if (!m) return;
    const o = worldToOriented(world, t);
    const endpoints: [Vec3, Vec3] = which === 0 ? [o, m.endpoints[1]] : [m.endpoints[0], o];
    await repo.updateMeasurement(id, { endpoints });
    mutate();
  }

  async function setLength(id: string, value: number, unit: MeasureUnit) {
    await repo.updateMeasurement(id, { value, unit, meters: toMeters(value, unit) });
    mutate();
  }

  async function remove(id: string) {
    await repo.deleteMeasurement(id);
    mutate();
  }

  async function calibrate() {
    setErr(undefined);
    if (!measurements?.length) {
      setErr("Add at least one measurement first.");
      return;
    }
    const result = recalibrate(
      {
        rotation: t.rotation,
        bounds,
        measurements: measurements.map((m) => ({ endpoints: m.endpoints, meters: m.meters })),
      },
      Date.now(),
    );
    await repo.updateRoom(room.id, {
      metricTransform: result.transform,
      bounds,
      dimensions: result.dimensions,
    });
    const r: Record<string, number> = {};
    measurements.forEach((m, i) => (r[m.id] = result.perResidualMeters[i]));
    setResiduals(r);
    setRms(result.transform.rmsResidualMeters);
    onCalibrated();
  }

  const placed = measurements ?? [];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", background: "rgba(8,10,14,0.9)" }}>
      <aside
        style={{
          width: 360,
          height: "100%",
          background: "var(--panel)",
          borderRight: "1px solid var(--border)",
          padding: 16,
          overflowY: "auto",
        }}
        className="col"
      >
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>Calibrate room</h2>
          <button onClick={onClose}>Done</button>
        </div>

        <div className="row" style={{ gap: 6 }}>
          <button className={tool === "measure" ? "primary" : ""} onClick={() => setTool("measure")}>
            📏 Measure
          </button>
          <button className={tool === "bounds" ? "primary" : ""} onClick={() => setTool("bounds")}>
            ⬛ Room bounds
          </button>
        </div>

        {tool === "measure" ? (
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Click two points on the room to draw a tape line, then type its real length. Drag a green
            endpoint to fine-tune. {draft ? "Click the second point…" : "Click the first point…"}
          </p>
        ) : (
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Drag the blue box faces to wrap your room (floor, ceiling, and walls). One measurement +
            the box gives the full metric dimensions.
          </p>
        )}

        <div className="col" style={{ marginTop: 4 }}>
          {placed.length === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              No measurements yet.
            </p>
          )}
          {placed.map((m, i) => (
            <div key={m.id} className="card col" style={{ gap: 6 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>Tape #{i + 1}</span>
                {residuals[m.id] != null && (
                  <span className={`badge ${residuals[m.id] > 0.05 ? "err" : "ok"}`}>
                    ±{(residuals[m.id] * 100).toFixed(1)} cm
                  </span>
                )}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <input
                  style={{ width: 80 }}
                  inputMode="decimal"
                  value={m.value}
                  onChange={(e) => setLength(m.id, +e.target.value || 0, m.unit)}
                />
                <select value={m.unit} onChange={(e) => setLength(m.id, m.value, e.target.value as MeasureUnit)}>
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <button className="danger" onClick={() => remove(m.id)} style={{ padding: "6px 10px" }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {err && (
          <span className="badge err" style={{ alignSelf: "flex-start" }}>
            {err}
          </span>
        )}

        <button className="primary" onClick={calibrate} disabled={placed.length === 0}>
          Calibrate ({placed.length} measurement{placed.length === 1 ? "" : "s"})
        </button>

        {rms != null && (
          <div className="col" style={{ gap: 4 }}>
            <span className={`badge ${rms > 0.05 ? "err" : "ok"}`} style={{ alignSelf: "flex-start" }}>
              fit error {(rms * 100).toFixed(1)} cm RMS
            </span>
            {room.dimensions && (
              <span className="muted" style={{ fontSize: 12 }}>
                Room: {room.dimensions.width.toFixed(2)} × {room.dimensions.depth.toFixed(2)} m ·{" "}
                {room.dimensions.height.toFixed(2)} m tall
              </span>
            )}
          </div>
        )}
      </aside>

      <div style={{ flex: 1, position: "relative" }}>
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: false, alpha: false, premultipliedAlpha: false }}
          camera={{ position: [3, 2, 4], fov: 60, near: 0.01, far: 1000 }}
          onPointerDown={(e) => (downPos.current = { x: e.clientX, y: e.clientY })}
          onPointerMissed={(e) => {
            const d = downPos.current;
            // Ignore look-drags (only treat near-stationary clicks as placements).
            if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
            placeRef.current?.(e.clientX, e.clientY);
          }}
          style={{ background: "#0b0d11" }}
        >
          <FirstPersonControls initialView={initialView} />
          <SplatStage>
            {splatUrl && (
              <CalibrateScene
                splatUrl={splatUrl}
                splatFormat={room.splatFormat}
                transform={t}
                tool={tool}
                measurements={placed}
                draft={draft}
                bounds={bounds}
                placeRef={placeRef}
                onPlaceWorld={onPlaceWorld}
                onMoveEndpoint={onMoveEndpoint}
                onBoundsChange={(wb: WorldBox) =>
                  setBounds({
                    min: worldToOriented(wb.min, t),
                    max: worldToOriented(wb.max, t),
                  })
                }
              />
            )}
          </SplatStage>
        </Canvas>
        <div className="muted" style={{ position: "absolute", bottom: 12, left: 12, fontSize: 12 }}>
          WASD to walk · drag to look · {tool === "measure" ? "click to place tape points" : "drag box faces"}
        </div>
      </div>
    </div>
  );
}
