"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Html, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { useEditor } from "@/lib/scene/editorStore";
import { usePrefs } from "@/lib/scene/prefs";
import { formatLength } from "@/lib/geometry/units";
import type { Vec3 } from "@/lib/storage/types";

/** A small non-interactive length chip anchored at a 3D point. */
export function SceneLabel({ position, text }: { position: Vec3; text: string }) {
  return (
    <Html position={position} center distanceFactor={undefined} style={{ pointerEvents: "none" }} zIndexRange={[20, 0]}>
      <div
        style={{
          padding: "2px 7px",
          borderRadius: 6,
          background: "rgba(12,14,18,0.82)",
          border: "1px solid rgba(255,255,255,0.16)",
          color: "#e6ebf3",
          fontSize: 12,
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </div>
    </Html>
  );
}

export interface WorldBox {
  min: Vec3;
  max: Vec3;
}

interface FaceDef {
  key: string;
  axis: 0 | 1 | 2;
  sign: 1 | -1;
}
const FACES: FaceDef[] = [
  { key: "+x", axis: 0, sign: 1 },
  { key: "-x", axis: 0, sign: -1 },
  { key: "+y", axis: 1, sign: 1 },
  { key: "-y", axis: 1, sign: -1 },
  { key: "+z", axis: 2, sign: 1 },
  { key: "-z", axis: 2, sign: -1 },
];

const MIN_SIZE = 0.05;

/** Center of one face of the box (the moved axis sits at min/max, others centered). */
function faceCenter(box: WorldBox, f: FaceDef): Vec3 {
  const c: Vec3 = [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
  c[f.axis] = f.sign > 0 ? box.max[f.axis] : box.min[f.axis];
  return c;
}

interface Props {
  /** World-space box. */
  box: WorldBox;
  /** Drag-to-resize face handles when true. */
  editable?: boolean;
  /** Show 3D width/depth/height length labels (in the selected unit). */
  showLabels?: boolean;
  onChange?: (box: WorldBox) => void;
}

/**
 * A world-space axis-aligned box drawn as a wireframe, with six face handles
 * (drag a face along its axis to fit a wall/floor/ceiling). Resizes on release.
 */
export function BoundsBox({ box, editable, showLabels, onChange }: Props) {
  const unitSystem = usePrefs((s) => s.unitSystem);
  const center: Vec3 = [
    (box.min[0] + box.max[0]) / 2,
    (box.min[1] + box.max[1]) / 2,
    (box.min[2] + box.max[2]) / 2,
  ];
  const size: Vec3 = [
    box.max[0] - box.min[0],
    box.max[1] - box.min[1],
    box.max[2] - box.min[2],
  ];
  // World space is metric, so the box extents are already in meters.
  const labels: { position: Vec3; text: string }[] = showLabels
    ? [
        { position: [center[0], box.min[1], box.max[2]], text: formatLength(size[0], unitSystem) },
        { position: [box.max[0], box.min[1], center[2]], text: formatLength(size[2], unitSystem) },
        { position: [box.max[0], center[1], box.max[2]], text: formatLength(size[1], unitSystem) },
      ]
    : [];

  const [sel, setSel] = useState<string | null>(null);
  const objs = useRef(new Map<string, THREE.Object3D>());
  const [selObj, setSelObj] = useState<THREE.Object3D | null>(null);
  const setDragging = useEditor((s) => s.setDragging);

  useEffect(() => {
    setSelObj(sel ? objs.current.get(sel) ?? null : null);
  }, [sel, box]);

  const commit = useCallback(() => {
    const f = FACES.find((x) => x.key === sel);
    if (!f || !selObj || !onChange) return;
    const v = selObj.position.getComponent(f.axis);
    const min: Vec3 = [...box.min];
    const max: Vec3 = [...box.max];
    if (f.sign > 0) max[f.axis] = Math.max(v, min[f.axis] + MIN_SIZE);
    else min[f.axis] = Math.min(v, max[f.axis] - MIN_SIZE);
    onChange({ min, max });
  }, [sel, selObj, box, onChange]);

  return (
    <group>
      <mesh position={center}>
        <boxGeometry args={size} />
        <meshBasicMaterial color="#5b9dff" wireframe transparent opacity={0.9} />
      </mesh>

      {labels.map((l, i) => (
        <SceneLabel key={i} position={l.position} text={l.text} />
      ))}

      {editable &&
        FACES.map((f) => (
          <mesh
            key={f.key}
            position={faceCenter(box, f)}
            ref={(el) => {
              if (el) objs.current.set(f.key, el);
              else objs.current.delete(f.key);
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSel(f.key);
            }}
          >
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshStandardMaterial
              color={sel === f.key ? "#ffffff" : "#9ec2ff"}
              emissive="#5b9dff"
              emissiveIntensity={sel === f.key ? 1.0 : 0.6}
            />
          </mesh>
        ))}

      {editable && selObj && (
        <TransformControls
          object={selObj}
          mode="translate"
          showX={FACES.find((f) => f.key === sel)?.axis === 0}
          showY={FACES.find((f) => f.key === sel)?.axis === 1}
          showZ={FACES.find((f) => f.key === sel)?.axis === 2}
          onMouseDown={() => setDragging(true)}
          onMouseUp={() => {
            setDragging(false);
            commit();
          }}
        />
      )}
    </group>
  );
}
