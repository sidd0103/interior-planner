"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Grid, TransformControls, Line } from "@react-three/drei";
import * as THREE from "three";
import { SplatRoom } from "@/components/scene/SplatRoom";
import type { Vec3 } from "@/lib/storage/types";

export interface ContextSpan {
  a: Vec3;
  b: Vec3;
  isFloor?: boolean;
}

interface Props {
  splatUrl: string;
  /** Endpoints of the measurement currently being placed (raw splat space). */
  markers: { a: Vec3; b: Vec3 } | null;
  onMarkersChange: (a: Vec3, b: Vec3) => void;
  /** Already-placed spans, drawn for context. */
  contextSpans: ContextSpan[];
}

/** A draggable endpoint sphere; reports its position on drag-end. */
function Marker({
  position,
  color,
  selected,
  onSelect,
  registerRef,
}: {
  position: Vec3;
  color: string;
  selected: boolean;
  onSelect: () => void;
  registerRef: (obj: THREE.Object3D | null) => void;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useEffect(() => {
    registerRef(ref.current);
    return () => registerRef(null);
  }, [registerRef]);

  return (
    <mesh
      ref={ref}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <sphereGeometry args={[0.06, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={selected ? 0.8 : 0.3}
      />
    </mesh>
  );
}

/**
 * The raw (unscaled) splat with two draggable endpoint markers for the active
 * measurement, plus context lines for already-placed spans. Reconciliation runs
 * in raw splat space; the metric transform is applied elsewhere once solved.
 */
export function MeasureScene({ splatUrl, markers, onMarkersChange, contextSpans }: Props) {
  const [selected, setSelected] = useState<"a" | "b" | null>(null);
  const objs = useRef<{ a: THREE.Object3D | null; b: THREE.Object3D | null }>({ a: null, b: null });
  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    setSelectedObj(selected ? objs.current[selected] : null);
  }, [selected, markers]);

  const commit = useCallback(() => {
    if (!markers) return;
    const a = objs.current.a;
    const b = objs.current.b;
    if (!a || !b) return;
    onMarkersChange([a.position.x, a.position.y, a.position.z], [
      b.position.x,
      b.position.y,
      b.position.z,
    ]);
  }, [markers, onMarkersChange]);

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
      <Grid
        args={[40, 40]}
        cellColor="#2b3038"
        sectionColor="#3a414d"
        fadeDistance={40}
        infiniteGrid
      />

      <SplatRoom url={splatUrl} />

      {contextSpans.map((s, i) => (
        <Line
          key={i}
          points={[s.a, s.b]}
          color={s.isFloor ? "#4ec98a" : "#9aa1ac"}
          lineWidth={2}
        />
      ))}

      {markers && (
        <>
          <Line points={[markers.a, markers.b]} color="#5b9dff" lineWidth={3} />
          <Marker
            position={markers.a}
            color="#e2585b"
            selected={selected === "a"}
            onSelect={() => setSelected("a")}
            registerRef={(o) => (objs.current.a = o)}
          />
          <Marker
            position={markers.b}
            color="#5b9dff"
            selected={selected === "b"}
            onSelect={() => setSelected("b")}
            registerRef={(o) => (objs.current.b = o)}
          />
          {selectedObj && (
            <TransformControls object={selectedObj} mode="translate" onMouseUp={commit} />
          )}
        </>
      )}
    </>
  );
}
