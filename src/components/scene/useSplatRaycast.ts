"use client";

import { useCallback } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSplatRegistry } from "./SplatStage";

/**
 * Returns a function that raycasts a screen pixel against the registered
 * Gaussian splat(s) and yields the nearest world-space surface point (or null).
 *
 * Splats aren't in the R3F scene graph, so this uses the mkkellogg Viewer's
 * internal `raycaster` (setFromCameraAndScreenPosition + intersectSplatMesh),
 * which `SplatStage` exposes via its per-canvas registry.
 */
export function useSplatRaycast() {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const registry = useSplatRegistry();

  return useCallback(
    (clientX: number, clientY: number): THREE.Vector3 | null => {
      if (!registry) return null;
      const rect = gl.domElement.getBoundingClientRect();
      const screenPos = { x: clientX - rect.left, y: clientY - rect.top };
      const dims = { x: rect.width, y: rect.height };

      let best: { point: THREE.Vector3; dist: number } | null = null;
      for (const { viewer } of registry.values()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v = viewer as any;
        const mesh = v.getSplatMesh?.() ?? v.splatMesh;
        if (!v.raycaster || !mesh) continue;
        try {
          v.raycaster.setFromCameraAndScreenPosition(camera, screenPos, dims);
          const hits: { origin: THREE.Vector3 }[] = [];
          v.raycaster.intersectSplatMesh(mesh, hits);
          if (hits.length) {
            const p = hits[0].origin;
            const d = camera.position.distanceTo(p);
            if (!best || d < best.dist) best = { point: p.clone(), dist: d };
          }
        } catch {
          /* raycaster not ready */
        }
      }
      return best?.point ?? null;
    },
    [gl, camera, registry],
  );
}
