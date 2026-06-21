"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import useSWR from "swr";
import { MeasureScene, type ContextSpan } from "./MeasureScene";
import { SplatStage } from "@/components/scene/SplatStage";
import * as repo from "@/lib/storage/repo";
import { useAssetUrl } from "@/lib/storage/useAssetUrl";
import { fileToDataUri } from "@/lib/util/file";
import { toMeters } from "@/lib/geometry/units";
import { solveSimilarity, type SpanConstraint } from "@/lib/geometry/similaritySolve";
import type { Room, Measurement, Vec3 } from "@/lib/storage/types";

const DEFAULT_A: Vec3 = [0, 0, 0];
const DEFAULT_B: Vec3 = [1, 0, 0];

interface Props {
  room: Room;
  onClose: () => void;
  onSolved: () => void;
}

export function MeasureReconciler({ room, onClose, onSolved }: Props) {
  const splatUrl = useAssetUrl(room.splatAssetId);
  const { data: measurements, mutate } = useSWR(["measurements", room.id], () =>
    repo.listMeasurements(room.id),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [residuals, setResiduals] = useState<Record<string, number>>({});
  const [rms, setRms] = useState<number | null>(null);

  const active = measurements?.find((m) => m.id === activeId) ?? null;
  const markers = activeId
    ? active?.endpointsSplat
      ? { a: active.endpointsSplat[0], b: active.endpointsSplat[1] }
      : { a: DEFAULT_A, b: DEFAULT_B }
    : null;

  const contextSpans: ContextSpan[] = useMemo(
    () =>
      (measurements ?? [])
        .filter((m) => m.endpointsSplat && m.id !== activeId)
        .map((m) => ({ a: m.endpointsSplat![0], b: m.endpointsSplat![1], isFloor: m.isFloorSpan })),
    [measurements, activeId],
  );

  async function onMarkersChange(a: Vec3, b: Vec3) {
    if (!activeId) return;
    await repo.updateMeasurement(activeId, { endpointsSplat: [a, b] });
    mutate();
  }

  async function extractFromScreenshot(file: File) {
    setBusy(true);
    setErr(undefined);
    try {
      const screenshotAssetId = await repo.putAsset(file);
      const dataUri = await fileToDataUri(file);
      const mediaType = (file.type || "image/png") as
        | "image/png"
        | "image/jpeg"
        | "image/webp"
        | "image/gif";
      const res = await fetch("/api/vision/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: dataUri, mediaType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Vision request failed");

      const readings: { value: number; unit: Measurement["unit"]; label?: string; confidence?: number }[] =
        json.measurements ?? [];
      if (readings.length === 0) throw new Error("No measurements detected in the screenshot");

      for (const r of readings) {
        await repo.addMeasurement({
          roomId: room.id,
          screenshotAssetId,
          value: r.value,
          unit: r.unit,
          meters: toMeters(r.value, r.unit),
          label: r.label,
          confidence: r.confidence,
        });
      }
      mutate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addManual() {
    const m = await repo.addMeasurement({
      roomId: room.id,
      screenshotAssetId: "",
      value: 1,
      unit: "m",
      meters: 1,
      label: "Manual span",
    });
    mutate();
    setActiveId(m.id);
  }

  async function toggleFloor(m: Measurement) {
    await repo.updateMeasurement(m.id, { isFloorSpan: !m.isFloorSpan });
    mutate();
  }

  async function remove(id: string) {
    await repo.deleteMeasurement(id);
    if (activeId === id) setActiveId(null);
    mutate();
  }

  const placed = (measurements ?? []).filter((m) => m.endpointsSplat);

  async function solve() {
    const constraints: SpanConstraint[] = placed.map((m) => ({
      a: m.endpointsSplat![0],
      b: m.endpointsSplat![1],
      meters: m.meters,
      isFloor: m.isFloorSpan,
    }));
    if (constraints.length === 0) return;
    const result = solveSimilarity(constraints, Date.now());
    await repo.updateRoom(room.id, {
      metricTransform: result.transform,
      dimensions: result.dimensions,
    });
    const r: Record<string, number> = {};
    placed.forEach((m, i) => (r[m.id] = result.perConstraintResidualMeters[i]));
    setResiduals(r);
    setRms(result.transform.rmsResidualMeters);
    onSolved();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        background: "rgba(8,10,14,0.85)",
      }}
    >
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
          <h2 style={{ margin: 0, fontSize: 18 }}>Recover dimensions</h2>
          <button onClick={onClose}>Close</button>
        </div>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Upload Measure-app screenshots, then click a measurement&apos;s <b>Place</b> and drag its
          two markers onto the matching corners in the 3D view. Tag at least two floor spans so the
          room can be oriented, then Solve.
        </p>

        <label className="card" style={{ cursor: "pointer", textAlign: "center" }}>
          {busy ? "Reading…" : "+ Upload screenshot"}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) extractFromScreenshot(f);
              e.target.value = "";
            }}
          />
        </label>
        <button onClick={addManual}>+ Add manual measurement</button>

        {err && (
          <span className="badge err" style={{ alignSelf: "flex-start" }}>
            {err}
          </span>
        )}

        <div className="col" style={{ marginTop: 8 }}>
          {placed.length < 3 && (
            <p className="muted" style={{ fontSize: 12 }}>
              {placed.length}/3+ spans placed. More spans across different walls give a better fit.
            </p>
          )}
          {(measurements ?? []).map((m) => (
            <div
              key={m.id}
              className="card col"
              style={{ gap: 6, borderColor: m.id === activeId ? "var(--accent)" : "var(--border)" }}
            >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>
                  {m.value} {m.unit}
                </span>
                <span className="muted" style={{ fontSize: 11 }}>
                  {m.endpointsSplat ? "placed" : "not placed"}
                </span>
              </div>
              {m.label && (
                <span className="muted" style={{ fontSize: 11 }}>
                  {m.label}
                </span>
              )}
              {residuals[m.id] != null && (
                <span
                  className={`badge ${residuals[m.id] > 0.05 ? "err" : "ok"}`}
                  style={{ alignSelf: "flex-start" }}
                >
                  residual {(residuals[m.id] * 100).toFixed(1)} cm
                </span>
              )}
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                <button
                  className={m.id === activeId ? "primary" : ""}
                  onClick={() => setActiveId(m.id === activeId ? null : m.id)}
                  style={{ padding: "6px 10px" }}
                >
                  {m.id === activeId ? "Placing…" : "Place"}
                </button>
                <button
                  className={m.isFloorSpan ? "primary" : ""}
                  onClick={() => toggleFloor(m)}
                  style={{ padding: "6px 10px" }}
                  title="Mark this span as lying flat on the floor"
                >
                  Floor
                </button>
                <button className="danger" onClick={() => remove(m.id)} style={{ padding: "6px 10px" }}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="primary" onClick={solve} disabled={placed.length === 0}>
          Solve dimensions ({placed.length} span{placed.length === 1 ? "" : "s"})
        </button>
        {rms != null && (
          <div className="col" style={{ gap: 4 }}>
            <span className={`badge ${rms > 0.05 ? "err" : "ok"}`} style={{ alignSelf: "flex-start" }}>
              fit error {(rms * 100).toFixed(1)} cm RMS
            </span>
            {room.dimensions && (
              <span className="muted" style={{ fontSize: 12 }}>
                {room.dimensions.width.toFixed(2)} × {room.dimensions.depth.toFixed(2)} m ·{" "}
                {room.dimensions.height.toFixed(2)} m tall
              </span>
            )}
          </div>
        )}
      </aside>

      <div style={{ flex: 1, position: "relative" }}>
        <Canvas
          shadows
          camera={{ position: [3, 2, 4], fov: 50, near: 0.001, far: 1000 }}
          style={{ background: "#0b0d11" }}
        >
          <OrbitControls makeDefault enableDamping dampingFactor={0.1} />
          <SplatStage>
            {splatUrl && (
              <MeasureScene
                splatUrl={splatUrl}
                splatFormat={room.splatFormat}
                markers={markers}
                onMarkersChange={onMarkersChange}
                contextSpans={contextSpans}
              />
            )}
          </SplatStage>
        </Canvas>
        {!splatUrl && (
          <div
            className="muted"
            style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}
          >
            This room has no captured scene yet.
          </div>
        )}
      </div>
    </div>
  );
}
