"use client";

import { useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { MetricTransform } from "@/lib/storage/types";

interface Props {
  /** Object URL of the splat file (.ply / .ksplat / .splat). */
  url: string;
  /** Similarity transform that maps raw splat space → metric world space. */
  transform?: MetricTransform;
  /** Render at reduced fidelity (apartment overview). */
  lowDetail?: boolean;
}

/**
 * Renders a World Labs / photogrammetry Gaussian splat inside the R3F scene
 * using @mkkellogg/gaussian-splats-3d's DropInViewer (a THREE.Group subclass
 * that self-updates each frame). The splat and regular GLB furniture meshes
 * coexist in one scene; keep furniture materials opaque (the splat renderer
 * does not composite transparent meshes correctly).
 */
export function SplatRoom({ url, transform, lowDetail }: Props) {
  const gl = useThree((s) => s.gl);
  const groupRef = useRef<THREE.Group>(null);
  const [viewer, setViewer] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    let disposed = false;
    let instance: { dispose?: () => void } | null = null;

    // Dynamically import the splat library (it touches browser globals) so it
    // never runs during SSR.
    (async () => {
      const { DropInViewer } = await import("@mkkellogg/gaussian-splats-3d");
      if (disposed) return;
      const v = new DropInViewer({
        gpuAcceleratedSort: true,
        sharedMemoryForWorkers: false, // avoids cross-origin-isolation requirement
        renderer: gl,
      });
      instance = v as unknown as { dispose?: () => void };
      try {
        await v.addSplatScene(url, {
          showLoadingUI: false,
          splatAlphaRemovalThreshold: 5,
          progressiveLoad: !lowDetail,
        });
        if (!disposed) setViewer(v as unknown as THREE.Object3D);
      } catch (err) {
        console.error("Failed to load splat:", err);
      }
    })();

    return () => {
      disposed = true;
      try {
        instance?.dispose?.();
      } catch {
        /* best-effort cleanup */
      }
    };
  }, [url, lowDetail, gl]);

  // Apply the metric similarity transform (scale · R · p + t) to the group.
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    if (transform) {
      const m = transform.rotation;
      const basis = new THREE.Matrix4().set(
        m[0], m[1], m[2], 0,
        m[3], m[4], m[5], 0,
        m[6], m[7], m[8], 0,
        0, 0, 0, 1,
      );
      const quat = new THREE.Quaternion().setFromRotationMatrix(basis);
      g.quaternion.copy(quat);
      g.scale.setScalar(transform.scale);
      g.position.set(...transform.translation);
    } else {
      g.quaternion.identity();
      g.scale.setScalar(1);
      g.position.set(0, 0, 0);
    }
  }, [transform, viewer]);

  return <group ref={groupRef}>{viewer && <primitive object={viewer} />}</group>;
}
