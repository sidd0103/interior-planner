"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Grid, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { FurnitureItem } from "./FurnitureItem";
import { useEditor } from "@/lib/scene/editorStore";
import { findOverlaps } from "@/lib/geometry/collision";
import type { SceneItem, TransformPatch } from "@/lib/scene/types";

interface Props {
  items: SceneItem[];
  onTransform: (id: string, patch: TransformPatch) => void;
  /** Optional splat/background content (rooms) rendered behind furniture. */
  children?: React.ReactNode;
  /** Show the helper grid (room editor); hide it in apartment view. */
  showGrid?: boolean;
}

/**
 * The interactive contents of a 3D scene: ground, lighting, furniture, and a
 * single transform gizmo bound to the current selection. Lives inside a
 * <Canvas> (see SceneCanvas).
 */
export function RoomScene({ items, onTransform, children, showGrid = true }: Props) {
  const { selectedId, mode, select, setDragging } = useEditor();

  // Registry of each item's Object3D so we can attach the gizmo to the selection.
  const objects = useRef(new Map<string, THREE.Object3D>());
  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null);

  const registerObject = useCallback((id: string, obj: THREE.Object3D | null) => {
    if (obj) objects.current.set(id, obj);
    else objects.current.delete(id);
  }, []);

  // Re-resolve the selected object whenever the selection or item set changes.
  useEffect(() => {
    setSelectedObj(selectedId ? objects.current.get(selectedId) ?? null : null);
  }, [selectedId, items]);

  const overlaps = useMemo(() => findOverlaps(items), [items]);

  const commit = useCallback(() => {
    if (!selectedId || !selectedObj) return;
    // Snap furniture to the floor: translation is locked to the X/Z plane.
    selectedObj.position.y = 0;
    const p = selectedObj.position;
    const r = selectedObj.rotation;
    // We persist a single uniform scale; read it from x.
    const s = selectedObj.scale.x;
    onTransform(selectedId, {
      position: [p.x, 0, p.z],
      rotation: [r.x, r.y, r.z],
      scale: s,
    });
  }, [selectedId, selectedObj, onTransform]);

  return (
    <>
      <ambientLight intensity={0.6} />
      <hemisphereLight args={["#cfd8ff", "#202028", 0.5]} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      {showGrid && (
        <Grid
          args={[30, 30]}
          cellSize={0.5}
          cellThickness={0.6}
          cellColor="#2b3038"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#3a414d"
          fadeDistance={28}
          infiniteGrid
        />
      )}

      <Suspense fallback={null}>{children}</Suspense>

      <Suspense fallback={null}>
        {items.map((item) => (
          <FurnitureItem
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            overlapping={overlaps.has(item.id)}
            onSelect={select}
            registerObject={registerObject}
          />
        ))}
      </Suspense>

      {selectedObj && (
        <TransformControls
          object={selectedObj}
          mode={mode}
          showY={mode !== "translate"}
          onMouseDown={() => setDragging(true)}
          onMouseUp={() => {
            setDragging(false);
            commit();
          }}
        />
      )}
    </>
  );
}
