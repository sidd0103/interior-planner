"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { Line, TransformControls, Grid } from "@react-three/drei";
import * as THREE from "three";
import { SplatRoom } from "@/components/scene/SplatRoom";
import { BACKGROUND_LAYER } from "@/components/scene/SplatStage";
import { useSplatRaycast } from "@/components/scene/useSplatRaycast";
import { useEditor } from "@/lib/scene/editorStore";
import { orientedToWorld } from "@/lib/geometry/calibrate";
import { BoundsBox, type WorldBox } from "./BoundsBox";
import type { Measurement, MetricTransform, RoomBounds, Vec3 } from "@/lib/storage/types";

interface Props {
  splatUrl: string;
  splatFormat?: "spz" | "ply" | "splat" | "ksplat";
  transform: MetricTransform;
  tool: "measure" | "bounds";
  measurements: Measurement[];
  /** In-progress first endpoint (oriented space), or null. */
  draft: Vec3 | null;
  /** Room bounds box (oriented space). */
  bounds: RoomBounds;
  /** Bridge: RoomCalibrator's onPointerMissed calls this with a screen pixel. */
  placeRef: MutableRefObject<((x: number, y: number) => void) | undefined>;
  onPlaceWorld: (world: Vec3) => void;
  onMoveEndpoint: (id: string, which: 0 | 1, world: Vec3) => void;
  onBoundsChange: (worldBox: WorldBox) => void;
}

/** 3D contents of the calibrator: splat + measure segments + the bounds box. */
export function CalibrateScene(props: Props) {
  const { transform: t, measurements } = props;
  const raycast = useSplatRaycast();
  const setDragging = useEditor((s) => s.setDragging);

  // Bridge for click-to-place (RoomCalibrator's onPointerMissed → raycast here).
  const placeRef = props.placeRef;
  const onPlace = props.onPlaceWorld;
  useEffect(() => {
    placeRef.current = (x, y) => {
      const p = raycast(x, y);
      if (p) onPlace([p.x, p.y, p.z]);
    };
    return () => {
      placeRef.current = undefined;
    };
  }, [raycast, onPlace, placeRef]);

  // Endpoint selection + drag-refine.
  const [sel, setSel] = useState<{ id: string; which: 0 | 1 } | null>(null);
  const selKey = sel ? `${sel.id}:${sel.which}` : null;
  const objs = useRef(new Map<string, THREE.Object3D>());
  const [selObj, setSelObj] = useState<THREE.Object3D | null>(null);
  useEffect(() => {
    setSelObj(selKey ? objs.current.get(selKey) ?? null : null);
  }, [selKey, measurements]);

  const commit = useCallback(() => {
    if (!sel || !selObj) return;
    const p = selObj.position;
    props.onMoveEndpoint(sel.id, sel.which, [p.x, p.y, p.z]);
  }, [sel, selObj, props]);

  const worldBox: WorldBox = {
    min: orientedToWorld(props.bounds.min, t),
    max: orientedToWorld(props.bounds.max, t),
  };

  return (
    <>
      <ambientLight intensity={0.75} />
      <hemisphereLight args={["#cfd8ff", "#202028", 0.5]} />
      <directionalLight position={[5, 9, 4]} intensity={0.7} />
      <Grid
        ref={(o) => o?.traverse((c) => c.layers.set(BACKGROUND_LAYER))}
        position={[0, 0.012, 0]}
        args={[40, 40]}
        cellColor="#2b3038"
        sectionColor="#3a414d"
        fadeDistance={35}
        infiniteGrid
      />

      <SplatRoom url={props.splatUrl} format={props.splatFormat} transform={t} />

      {/* Measure segments + draggable endpoints */}
      {measurements.map((m) => {
        const a = orientedToWorld(m.endpoints[0], t);
        const b = orientedToWorld(m.endpoints[1], t);
        return (
          <group key={m.id}>
            <Line points={[a, b]} color="#4ec98a" lineWidth={3} />
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

      {/* In-progress first point */}
      {props.draft && (
        <mesh position={orientedToWorld(props.draft, t)}>
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

      <BoundsBox box={worldBox} editable={props.tool === "bounds"} onChange={props.onBoundsChange} />
    </>
  );
}
