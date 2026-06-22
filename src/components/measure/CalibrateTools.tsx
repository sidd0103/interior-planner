"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Line, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { useSplatRaycast } from "@/components/scene/useSplatRaycast";
import { useEditor } from "@/lib/scene/editorStore";
import { usePrefs } from "@/lib/scene/prefs";
import { orientedToWorld } from "@/lib/geometry/calibrate";
import { formatLength } from "@/lib/geometry/units";
import { BoundsBox, SceneLabel, type WorldBox } from "./BoundsBox";
import type { Calibration } from "./useCalibration";
import type { Vec3 } from "@/lib/storage/types";

interface Props {
  calib: Calibration;
  /** Bridge: the editor's onPointerMissed calls this with a screen pixel. */
  placeRef: MutableRefObject<((x: number, y: number) => void) | undefined>;
}

/**
 * The draw-in-3D calibration tools (measure tapes + length labels + the room
 * bounds box), rendered inside the editor's existing canvas — over the same
 * splat the user is standing in. No second canvas, no modal.
 */
export function CalibrateTools({ calib, placeRef }: Props) {
  const t = calib.transform;
  const raycast = useSplatRaycast();
  const setDragging = useEditor((s) => s.setDragging);
  const unitSystem = usePrefs((s) => s.unitSystem);

  // Imperative bridge: expose the in-canvas raycast to the editor's
  // onPointerMissed (which lives outside the canvas and can't raycast itself).
  const place = calib.onPlaceWorld;
  useEffect(() => {
    placeRef.current = (x, y) => {
      const p = raycast(x, y);
      if (p) place([p.x, p.y, p.z]);
    };
    return () => {
      placeRef.current = undefined;
    };
  }, [raycast, place, placeRef]);

  // Endpoint selection + drag-refine. Resolve the selected THREE object from the
  // ref-map after refs attach (imperative; can't be read during render).
  const [sel, setSel] = useState<{ id: string; which: 0 | 1 } | null>(null);
  const selKey = sel ? `${sel.id}:${sel.which}` : null;
  const objs = useRef(new Map<string, THREE.Object3D>());
  const [selObj, setSelObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    setSelObj(selKey ? objs.current.get(selKey) ?? null : null);
  }, [selKey, calib.measurements]);

  const commit = () => {
    if (!sel || !selObj) return;
    const p = selObj.position;
    calib.onMoveEndpoint(sel.id, sel.which, [p.x, p.y, p.z]);
  };

  const worldBox: WorldBox = {
    min: orientedToWorld(calib.bounds.min, t),
    max: orientedToWorld(calib.bounds.max, t),
  };

  return (
    <>
      {calib.measurements.map((m) => {
        const a = orientedToWorld(m.endpoints[0], t);
        const b = orientedToWorld(m.endpoints[1], t);
        const meters = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.06, (a[2] + b[2]) / 2];
        return (
          <group key={m.id}>
            <Line points={[a, b]} color="#4ec98a" lineWidth={3} />
            <SceneLabel position={mid} text={formatLength(meters, unitSystem)} />
            {([0, 1] as const).map((w) => {
              const key = `${m.id}:${w}`;
              return (
                <mesh
                  key={key}
                  position={w === 0 ? a : b}
                  ref={(el) => {
                    if (el) objs.current.set(key, el);
                    else objs.current.delete(key);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSel({ id: m.id, which: w });
                  }}
                >
                  <sphereGeometry args={[0.06, 16, 16]} />
                  <meshStandardMaterial
                    color={selKey === key ? "#5b9dff" : "#4ec98a"}
                    emissive="#2a7d52"
                    emissiveIntensity={selKey === key ? 0.7 : 0.25}
                  />
                </mesh>
              );
            })}
          </group>
        );
      })}

      {calib.draft && (
        <mesh position={orientedToWorld(calib.draft, t)}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color="#5b9dff" emissive="#3a7bd5" emissiveIntensity={0.8} />
        </mesh>
      )}

      {selObj && (
        <TransformControls
          object={selObj}
          mode="translate"
          onMouseDown={() => setDragging(true)}
          onMouseUp={() => {
            setDragging(false);
            commit();
          }}
        />
      )}

      <BoundsBox
        box={worldBox}
        editable={calib.tool === "bounds"}
        showLabels
        onChange={(wb) => calib.onBoundsChangeWorld(wb.min, wb.max)}
      />
    </>
  );
}
