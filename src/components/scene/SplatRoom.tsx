"use client";

import { useEffect, useId, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSplatRegistry } from "./SplatStage";
import { fitTransformFromPoints } from "@/lib/geometry/splatFit";
import type { MetricTransform, Vec3 } from "@/lib/storage/types";

interface Props {
  /** Object URL of the splat file (.ply / .ksplat / .splat / .spz). */
  url: string;
  /** Format of the blob — required because blob URLs carry no file extension. */
  format?: "spz" | "ply" | "splat" | "ksplat";
  /** Similarity transform that maps raw splat space → metric world space. */
  transform?: MetricTransform;
  /** Render at reduced fidelity (apartment overview). */
  lowDetail?: boolean;
  /**
   * Called once with a transform auto-derived from the splat geometry when no
   * `transform` is provided (e.g. an imported splat with no World Labs metadata).
   */
  onAutoFit?: (t: MetricTransform) => void;
}

/** Apply the metric similarity transform (world = scale·R·p + t) to the splat mesh. */
function applyTransform(mesh: THREE.Object3D, transform?: MetricTransform) {
  if (transform) {
    const m = transform.rotation;
    const basis = new THREE.Matrix4().set(
      m[0], m[1], m[2], 0,
      m[3], m[4], m[5], 0,
      m[6], m[7], m[8], 0,
      0, 0, 0, 1,
    );
    mesh.quaternion.setFromRotationMatrix(basis);
    mesh.scale.setScalar(transform.scale);
    mesh.position.set(...transform.translation);
  } else {
    mesh.quaternion.identity();
    mesh.scale.setScalar(1);
    mesh.position.set(0, 0, 0);
  }
  mesh.updateMatrix();
  mesh.updateMatrixWorld(true);
}

/**
 * Loads a World Labs / photogrammetry Gaussian splat and registers it with the
 * canvas's SplatStage, which draws it in a dedicated pass alongside regular
 * meshes. Must be rendered inside a <SplatStage> (see SceneCanvas).
 */
export function SplatRoom({ url, format, transform, lowDetail, onAutoFit }: Props) {
  const id = useId();
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const registry = useSplatRegistry();
  const meshRef = useRef<THREE.Object3D | null>(null);
  const autoFitRef = useRef(false);

  useEffect(() => {
    if (!registry) return;
    let disposed = false;
    let instance: { dispose?: () => void } | null = null;

    (async () => {
      // Dynamically import (touches browser globals — keep off the SSR path).
      const GS = await import("@mkkellogg/gaussian-splats-3d");
      if (disposed) return;

      // Use the raw Viewer with R3F's renderer + camera supplied up front (an
      // "external renderer"). DropInViewer forces renderer=undefined, which
      // starves the initial GPU sort so splats never become ready; supplying
      // the renderer at construction lets addSplatScene run that first sort.
      const v = new GS.Viewer({
        renderer: gl,
        camera,
        useBuiltInControls: false,
        selfDrivenMode: false,
        gpuAcceleratedSort: false,
        sharedMemoryForWorkers: false,
        sceneRevealMode: GS.SceneRevealMode.Instant,
      });
      instance = v as unknown as { dispose?: () => void };

      // Blob URLs carry no extension, so pass the format explicitly.
      const fmt =
        format === "spz"
          ? GS.SceneFormat.Spz
          : format === "ply"
            ? GS.SceneFormat.Ply
            : format === "splat"
              ? GS.SceneFormat.Splat
              : format === "ksplat"
                ? GS.SceneFormat.KSplat
                : undefined;

      try {
        await v.addSplatScene(url, {
          showLoadingUI: false,
          splatAlphaRemovalThreshold: 5,
          progressiveLoad: false,
          ...(fmt !== undefined ? { format: fmt } : {}),
        });
        if (disposed) return;

        const mesh: THREE.Object3D | undefined = v.getSplatMesh?.() ?? v.splatMesh;
        if (!mesh) throw new Error("splat mesh unavailable after load");
        // The splat mesh's bounding volume isn't valid for THREE's frustum
        // culler, so it gets culled (0 draw calls). Disable culling on it.
        mesh.frustumCulled = false;
        mesh.traverse((c) => {
          c.frustumCulled = false;
        });
        applyTransform(mesh, transform);
        meshRef.current = mesh;
        registry.set(id, { viewer: v, mesh });

        // No transform yet (imported splat): derive one from the geometry so it
        // comes in upright, on the floor, with the capture point at eye height.
        if (!transform && onAutoFit && !autoFitRef.current) {
          autoFitRef.current = true;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sm = v.getSplatMesh?.() as any;
          const count: number = sm?.getSplatCount?.() ?? 0;
          if (count > 0) {
            const pts: Vec3[] = [];
            const tmp = new THREE.Vector3();
            const step = Math.max(1, Math.floor(count / 5000));
            for (let i = 0; i < count; i += step) {
              sm.getSplatCenter(i, tmp, false); // raw splat space
              pts.push([tmp.x, tmp.y, tmp.z]);
            }
            onAutoFit(fitTransformFromPoints(pts, Date.now()));
          }
        }
      } catch (err) {
        console.error("Failed to load splat:", err);
      }
    })();

    return () => {
      disposed = true;
      registry.delete(id);
      meshRef.current = null;
      try {
        instance?.dispose?.();
      } catch {
        /* best-effort */
      }
    };
  }, [url, format, lowDetail, gl, camera, id, registry]);

  // Re-apply the metric transform when it changes (e.g. after reconciliation).
  useEffect(() => {
    if (meshRef.current) applyTransform(meshRef.current, transform);
  }, [transform]);

  return null;
}
