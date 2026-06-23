"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Grid, TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { FurnitureItem } from "./FurnitureItem";
import { BoundsBox, type WorldBox } from "@/components/measure/BoundsBox";
import { BACKGROUND_LAYER } from "./SplatStage";
import { useEditor } from "@/lib/scene/editorStore";
import { findOverlaps, withinBoundsXZ, snapToWalls } from "@/lib/geometry/collision";
import type { SceneItem, TransformPatch } from "@/lib/scene/types";

interface Props {
  items: SceneItem[];
  onTransform: (id: string, patch: TransformPatch) => void;
  /** Optional splat/background content (rooms) rendered behind furniture. */
  children?: React.ReactNode;
  /** Show the helper grid (room editor); hide it in apartment view. */
  showGrid?: boolean;
  /** Calibrated room bounds (world space) — drawn + used for snapping/warnings. */
  worldBounds?: WorldBox;
  /** Reports a mesh's actual rendered size (to persist as the asset's dims). */
  onMeasure?: (assetId: string, size: SceneItem["realDims"]) => void;
  /** View-only (public share): no transform gizmo / editing. */
  readOnly?: boolean;
}

/**
 * The interactive contents of a 3D scene: ground, lighting, furniture, and a
 * single transform gizmo bound to the current selection. Lives inside a
 * <Canvas> (see SceneCanvas).
 */
export function RoomScene({
  items,
  onTransform,
  children,
  showGrid = true,
  worldBounds,
  onMeasure,
  readOnly,
}: Props) {
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

  // Flag furniture that pokes outside the room bounds (drawn red, like overlaps).
  const warn = useMemo(() => {
    const set = new Set(overlaps);
    if (worldBounds) {
      for (const it of items) {
        if (!withinBoundsXZ(it, worldBounds)) set.add(it.id);
      }
    }
    return set;
  }, [overlaps, items, worldBounds]);

  const commit = useCallback(() => {
    if (!selectedId || !selectedObj) return;
    // Snap furniture to the floor: translation is locked to the X/Z plane.
    selectedObj.position.y = 0;
    const r = selectedObj.rotation;
    const s = selectedObj.scale.x;

    let pos: [number, number, number] = [selectedObj.position.x, 0, selectedObj.position.z];
    // Soft-snap to nearby walls.
    if (worldBounds) {
      const item = items.find((it) => it.id === selectedId);
      if (item) {
        pos = snapToWalls({ id: item.id, position: pos, realDims: item.realDims, scale: s }, worldBounds);
        selectedObj.position.set(pos[0], 0, pos[2]);
      }
    }

    onTransform(selectedId, { position: pos, rotation: [r.x, r.y, r.z], scale: s });
  }, [selectedId, selectedObj, onTransform, worldBounds, items]);

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
          // Background layer: drawn before the splat so the splat occludes it
          // (no bleeding through walls). See SplatStage. Lifted a hair above
          // the floor so its lines aren't z-fought away by the splat floor.
          ref={(o) => o?.traverse((c) => c.layers.set(BACKGROUND_LAYER))}
          position={[0, 0.012, 0]}
          args={[30, 30]}
          cellSize={0.5}
          cellThickness={1}
          cellColor="#a7adb7"
          sectionSize={0.5}
          sectionThickness={1}
          sectionColor="#a7adb7"
          fadeDistance={26}
          fadeStrength={1.5}
          infiniteGrid
        />
      )}

      <Suspense fallback={null}>{children}</Suspense>

      {worldBounds && <BoundsBox box={worldBounds} showLabels />}

      <Suspense fallback={null}>
        {items.map((item) => (
          <FurnitureItem
            key={item.id}
            item={item}
            selected={item.id === selectedId}
            overlapping={warn.has(item.id)}
            onSelect={select}
            registerObject={registerObject}
            onMeasure={onMeasure}
          />
        ))}
      </Suspense>

      {selectedObj && !readOnly && (
        <TransformControls
          object={selectedObj}
          mode={mode}
          // Move: slide on the floor (X/Z). Rotate: yaw only (Y). Never scale.
          showX={mode === "translate"}
          showZ={mode === "translate"}
          showY={mode === "rotate"}
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
