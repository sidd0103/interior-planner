"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { useEditor } from "@/lib/scene/editorStore";
import type { Vec3 } from "@/lib/storage/types";

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
  onChange?: (box: WorldBox) => void;
}

/**
 * A world-space axis-aligned box drawn as a wireframe, with six face handles
 * (drag a face along its axis to fit a wall/floor/ceiling). Resizes on release.
 */
export function BoundsBox({ box, editable, onChange }: Props) {
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
        <meshBasicMaterial color="#5b9dff" wireframe transparent opacity={0.55} />
      </mesh>

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
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial
              color={sel === f.key ? "#5b9dff" : "#cfd8ff"}
              emissive="#3a7bd5"
              emissiveIntensity={sel === f.key ? 0.7 : 0.25}
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
