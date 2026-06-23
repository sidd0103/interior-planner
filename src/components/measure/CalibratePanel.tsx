"use client";

import { useState } from "react";
import { usePrefs } from "@/lib/scene/prefs";
import { len, sub } from "@/lib/geometry/vec3";
import {
  formatArea,
  formatLength,
  feetInchesToMeters,
  metersToFeetInches,
  type UnitSystem,
} from "@/lib/geometry/units";
import type { Calibration } from "./useCalibration";

interface Props {
  calib: Calibration;
  onDone: () => void;
}

/**
 * Left panel for in-editor calibration: pick a unit system, draw tapes + the
 * room box in the scene, and type each tape's real length. Editing any tape
 * live-rescales the whole room.
 */
export function CalibratePanel({ calib, onDone }: Props) {
  const unitSystem = usePrefs((s) => s.unitSystem);
  const setUnitSystem = usePrefs((s) => s.setUnitSystem);
  const { measurements, tool, setTool, draft, scale, dimensions } = calib;
  const floorArea = dimensions.width * dimensions.depth;
  const allEstimates = measurements.every((m) => m.targetMeters == null);

  return (
    <aside
      className="sidebar col"
      style={{ width: 304, padding: 16, gap: 12, overflowY: "auto" }}
    >
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Calibrate room</h2>
        <button className="primary btn-sm" onClick={onDone}>
          Done
        </button>
      </div>

      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <span className="muted" style={{ fontSize: 12 }}>
          Units
        </span>
        {(["imperial", "metric"] as UnitSystem[]).map((u) => (
          <button
            key={u}
            className={unitSystem === u ? "primary" : ""}
            onClick={() => setUnitSystem(u)}
            style={{ padding: "6px 10px" }}
          >
            {u === "imperial" ? "ft / in" : "meters"}
          </button>
        ))}
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
          Click two points in the room to draw a tape, then type its real length below. Editing any
          tape rescales the whole room. {draft ? "Click the second point…" : "Click the first point…"}
        </p>
      ) : (
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
          Drag the blue box faces to wrap your room (floor, ceiling, walls). One measured tape + the
          box gives the full metric dimensions.
        </p>
      )}

      <div className="col" style={{ marginTop: 4 }}>
        {measurements.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>
            No tapes yet — click two points in the room.
          </p>
        )}
        {measurements.map((m, i) => {
          const computedMeters = len(sub(m.endpoints[1], m.endpoints[0])) * scale;
          return (
            <TapeRow
              key={m.id}
              index={i}
              computedMeters={computedMeters}
              target={m.targetMeters}
              unitSystem={unitSystem}
              onCommit={(meters) => calib.setTarget(m.id, meters)}
              onRemove={() => calib.remove(m.id)}
            />
          );
        })}
      </div>

      <div className="card col" style={{ gap: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Room dimensions</span>
        <span className="muted" style={{ fontSize: 13 }}>
          {formatLength(dimensions.width, unitSystem)} × {formatLength(dimensions.depth, unitSystem)}
          {" · "}
          {formatLength(dimensions.height, unitSystem)} tall
        </span>
        <span className="muted" style={{ fontSize: 13 }}>
          Floor area: {formatArea(floorArea, unitSystem)}
        </span>
        {allEstimates && (
          <span className="badge" style={{ alignSelf: "flex-start" }}>
            estimate — set a tape length to calibrate
          </span>
        )}
      </div>
    </aside>
  );
}

interface TapeRowProps {
  index: number;
  computedMeters: number;
  target?: number;
  unitSystem: UnitSystem;
  onCommit: (meters: number) => void;
  onRemove: () => void;
}

/**
 * One tape row: shows the tape's current length (computed live from the scale,
 * or the user's measured value) and lets them type a real length and **apply**
 * it with ✓ — the room only rescales on apply, never mid-keystroke. While a
 * field is untouched (draft === null) it derives the live length during render,
 * so other tapes update as the scale changes; no effects.
 */
function TapeRow({ index, computedMeters, target, unitSystem, onCommit, onRemove }: TapeRowProps) {
  const meters = target ?? computedMeters;
  const { feet, inches } = metersToFeetInches(meters);

  // null draft = follow the live value; a string = the user's unapplied edit.
  const [draftM, setDraftM] = useState<string | null>(null);
  const [draftFt, setDraftFt] = useState<string | null>(null);
  const [draftIn, setDraftIn] = useState<string | null>(null);
  const dirty = draftM !== null || draftFt !== null || draftIn !== null;

  const apply = () => {
    if (unitSystem === "imperial") {
      const f = parseFloat(draftFt ?? String(feet)) || 0;
      const i = parseFloat(draftIn ?? inches.toFixed(1)) || 0;
      onCommit(feetInchesToMeters(f, i));
    } else {
      const v = parseFloat(draftM ?? meters.toFixed(2));
      if (!Number.isNaN(v)) onCommit(v);
    }
    setDraftM(null);
    setDraftFt(null);
    setDraftIn(null);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") apply();
  };

  const isSet = target != null;

  return (
    <div className="card col" style={{ gap: 6 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Tape #{index + 1}</span>
        <span className={`badge ${isSet ? "ok" : ""}`}>{isSet ? "measured" : "estimate"}</span>
      </div>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        {unitSystem === "imperial" ? (
          <>
            <input
              style={{ width: 52 }}
              inputMode="numeric"
              value={draftFt ?? String(feet)}
              onChange={(e) => setDraftFt(e.target.value)}
              onKeyDown={onKey}
            />
            <span className="muted">ft</span>
            <input
              style={{ width: 56 }}
              inputMode="decimal"
              value={draftIn ?? inches.toFixed(1)}
              onChange={(e) => setDraftIn(e.target.value)}
              onKeyDown={onKey}
            />
            <span className="muted">in</span>
          </>
        ) : (
          <>
            <input
              style={{ width: 84 }}
              inputMode="decimal"
              value={draftM ?? meters.toFixed(2)}
              onChange={(e) => setDraftM(e.target.value)}
              onKeyDown={onKey}
            />
            <span className="muted">m</span>
          </>
        )}
        <button
          className={dirty ? "primary" : ""}
          onClick={apply}
          disabled={!dirty}
          title="Apply this length"
          style={{ padding: "6px 10px", marginLeft: "auto" }}
        >
          ✓
        </button>
        <button className="danger" onClick={onRemove} style={{ padding: "6px 10px" }}>
          ✕
        </button>
      </div>
    </div>
  );
}
