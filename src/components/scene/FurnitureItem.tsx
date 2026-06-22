"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SceneLabel } from "@/components/measure/BoundsBox";
import { usePrefs } from "@/lib/scene/prefs";
import { formatLength } from "@/lib/geometry/units";
import type { RoomDimensions } from "@/lib/storage/types";
import type { SceneItem } from "@/lib/scene/types";

/**
 * Loads a GLB and scales it uniformly to fit the item's real-world dimensions.
 * Reports the actual rendered bounding size so the wireframe box wraps the mesh
 * tightly (no gap from proportion mismatch).
 */
function GLBModel({
  url,
  realDims,
  onSize,
}: {
  url: string;
  realDims: RoomDimensions;
  onSize: (size: RoomDimensions) => void;
}) {
  const { scene } = useGLTF(url);

  const { object, size } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const native = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(native);
    box.getCenter(center);

    const target = new THREE.Vector3(realDims.width, realDims.height, realDims.depth);
    const sx = native.x > 1e-6 ? target.x / native.x : 1;
    const sy = native.y > 1e-6 ? target.y / native.y : 1;
    const sz = native.z > 1e-6 ? target.z / native.z : 1;
    // Uniform scale keeps proportions; smallest ratio so it never exceeds a target.
    const s = Math.min(sx, sy, sz);

    const wrapper = new THREE.Group();
    clone.position.set(-center.x, -box.min.y, -center.z); // sit on y=0, centered in x/z
    wrapper.add(clone);
    wrapper.scale.setScalar(s);
    // Actual rendered extent of the mesh — the tight bounding size.
    const rendered: RoomDimensions = {
      width: native.x * s,
      height: native.y * s,
      depth: native.z * s,
    };
    return { object: wrapper, size: rendered };
  }, [scene, realDims.width, realDims.height, realDims.depth]);

  useEffect(() => onSize(size), [size, onSize]);

  return <primitive object={object} />;
}

/** Placeholder shown before a GLB exists: a labeled box at the real-world size. */
function PlaceholderBox({ realDims }: { realDims: RoomDimensions }) {
  const { width, height, depth } = realDims;
  return (
    <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color="#6b7585" roughness={0.8} metalness={0.05} />
    </mesh>
  );
}

/** The visual (GLB or placeholder box) for an item, with no interaction. */
function FurnitureVisual({
  item,
  onSize,
}: {
  item: SceneItem;
  onSize?: (size: RoomDimensions) => void;
}) {
  return item.glbUrl ? (
    <GLBModel url={item.glbUrl} realDims={item.realDims} onSize={onSize ?? (() => {})} />
  ) : (
    <PlaceholderBox realDims={item.realDims} />
  );
}

/** Non-interactive placement, used in the apartment overview. */
export function StaticFurnitureItem({ item }: { item: SceneItem }) {
  return (
    <group position={item.position} rotation={item.rotation} scale={item.scale}>
      <FurnitureVisual item={item} />
    </group>
  );
}

interface Props {
  item: SceneItem;
  selected: boolean;
  /** This item intersects another — drawn with a warning outline. */
  overlapping?: boolean;
  onSelect: (id: string) => void;
  /** Register/unregister this item's Object3D so the scene can attach the gizmo. */
  registerObject: (id: string, obj: THREE.Object3D | null) => void;
  /**
   * Reports the mesh's actual rendered size so it can be persisted as the real
   * dims (keeps the box, labels, collision, and editor in agreement).
   */
  onMeasure?: (assetId: string, size: RoomDimensions) => void;
}

export function FurnitureItem({
  item,
  selected,
  overlapping,
  onSelect,
  registerObject,
  onMeasure,
}: Props) {
  const ref = useRef<THREE.Group>(null);
  const unitSystem = usePrefs((s) => s.unitSystem);

  useEffect(() => {
    registerObject(item.id, ref.current);
    return () => registerObject(item.id, null);
    // Re-register if the id changes.
  }, [item.id, registerObject]);

  // Tight rendered size of the mesh (drives the box/labels immediately, and is
  // reported up so the asset's stored dims match what's drawn).
  const [measured, setMeasured] = useState<RoomDimensions | null>(null);
  const onSize = useCallback(
    (size: RoomDimensions) => {
      setMeasured(size);
      const r = item.realDims;
      const ref = Math.max(r.width, r.height, r.depth, 0.01);
      const diff =
        Math.abs(size.width - r.width) +
        Math.abs(size.height - r.height) +
        Math.abs(size.depth - r.depth);
      if (diff / ref > 0.02) onMeasure?.(item.assetId, size);
    },
    [item.realDims, item.assetId, onMeasure],
  );

  const box = item.glbUrl ? measured ?? item.realDims : item.realDims;
  const { width: w, height: h, depth: d } = box;

  return (
    <group
      ref={ref}
      position={item.position}
      rotation={item.rotation}
      scale={item.scale}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(item.id);
      }}
    >
      <FurnitureVisual item={item} onSize={onSize} />
      {selected && (
        // Wireframe bounds wrapping the mesh. Red if it intersects another item.
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w * 1.02, h * 1.02, d * 1.02]} />
          <meshBasicMaterial
            color={overlapping ? "#e2585b" : "#5b9dff"}
            wireframe
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
      {selected && (
        // Dimension labels (W along X, D along Z, H up) in the selected unit.
        <>
          <SceneLabel position={[0, 0, d / 2 + 0.02]} text={formatLength(w, unitSystem)} />
          <SceneLabel position={[w / 2 + 0.02, 0, 0]} text={formatLength(d, unitSystem)} />
          <SceneLabel position={[w / 2 + 0.02, h / 2, d / 2 + 0.02]} text={formatLength(h, unitSystem)} />
        </>
      )}
    </group>
  );
}
