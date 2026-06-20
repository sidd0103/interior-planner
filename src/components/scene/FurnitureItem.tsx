"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { SceneItem } from "@/lib/scene/types";

/**
 * Loads a GLB and normalizes it to fit the item's real-world bounding box, so a
 * Meshy mesh of arbitrary native scale appears at correct metric size.
 */
function GLBModel({ url, realDims }: { url: string; realDims: SceneItem["realDims"] }) {
  const { scene } = useGLTF(url);

  const normalized = useMemo(() => {
    const clone = scene.clone(true);
    // Measure native bounds, then scale uniformly so the largest axis matches
    // the requested real-world dimension and recenter on the floor.
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const target = new THREE.Vector3(realDims.width, realDims.height, realDims.depth);
    const sx = size.x > 1e-6 ? target.x / size.x : 1;
    const sy = size.y > 1e-6 ? target.y / size.y : 1;
    const sz = size.z > 1e-6 ? target.z / size.z : 1;
    // Uniform scale keeps proportions; pick the smallest so it never exceeds any target dim.
    const s = Math.min(sx, sy, sz);

    const wrapper = new THREE.Group();
    clone.position.set(-center.x, -box.min.y, -center.z); // sit on y=0, centered in x/z
    wrapper.add(clone);
    wrapper.scale.setScalar(s);
    return wrapper;
  }, [scene, realDims.width, realDims.height, realDims.depth]);

  return <primitive object={normalized} />;
}

/** Placeholder shown before a GLB exists: a labeled box at the real-world size. */
function PlaceholderBox({ realDims }: { realDims: SceneItem["realDims"] }) {
  const { width, height, depth } = realDims;
  return (
    <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color="#6b7585" roughness={0.8} metalness={0.05} />
    </mesh>
  );
}

interface Props {
  item: SceneItem;
  selected: boolean;
  onSelect: (id: string) => void;
  /** Register/unregister this item's Object3D so the scene can attach the gizmo. */
  registerObject: (id: string, obj: THREE.Object3D | null) => void;
}

export function FurnitureItem({ item, selected, onSelect, registerObject }: Props) {
  const ref = useRef<THREE.Group>(null);

  useEffect(() => {
    registerObject(item.id, ref.current);
    return () => registerObject(item.id, null);
    // Re-register if the id changes.
  }, [item.id, registerObject]);

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
      {item.glbUrl ? (
        <GLBModel url={item.glbUrl} realDims={item.realDims} />
      ) : (
        <PlaceholderBox realDims={item.realDims} />
      )}
      {selected && (
        // Subtle selection outline: a wireframe box around the real-world bounds.
        <mesh position={[0, item.realDims.height / 2, 0]}>
          <boxGeometry
            args={[
              item.realDims.width * 1.02,
              item.realDims.height * 1.02,
              item.realDims.depth * 1.02,
            ]}
          />
          <meshBasicMaterial color="#5b9dff" wireframe transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}
