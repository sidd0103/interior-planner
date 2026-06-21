"use client";

import { createContext, useContext, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";

/**
 * Gaussian-splat rendering for R3F.
 *
 * The mkkellogg splat mesh does NOT render correctly as an ordinary child in a
 * scene-graph traversal — the library draws it in a dedicated pass
 * (`renderer.render(splatMesh, camera)` with autoClear off, after the main
 * scene). So instead of adding splats to the scene, SplatRoom registers its
 * inner viewer + splat mesh here, and SplatStage takes over R3F's render loop
 * to: update each viewer (sort), render the scene, then render each splat mesh
 * in its own pass. This lets splats and regular meshes coexist in one canvas.
 *
 * The registry is per-canvas (via context) so overlapping canvases (e.g. the
 * measurement modal over the room editor) don't cross-render each other.
 */

export interface SplatEntry {
  // The inner mkkellogg Viewer (has update(renderer, camera)).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewer: any;
  mesh: THREE.Object3D;
}

type Registry = Map<string, SplatEntry>;

const SplatContext = createContext<Registry | null>(null);

export function useSplatRegistry(): Registry | null {
  return useContext(SplatContext);
}

function SplatFrame({ registry }: { registry: Registry }) {
  useFrame((state) => {
    const entries = [...registry.values()];
    const gl = state.gl;

    // 1. Update each splat viewer (runs the CPU sort + uniform updates). Force
    //    R3F's live camera + renderer so the sort/projection match the view.
    for (const e of entries) {
      try {
        e.viewer.camera = state.camera;
        e.viewer.renderer = gl;
        e.viewer.update(gl, state.camera);
      } catch {
        /* viewer not ready yet */
      }
    }

    // 2. Render the regular scene (furniture, grid, gizmos).
    gl.autoClear = true;
    gl.render(state.scene, state.camera);

    // 3. Render each splat in its own pass on top, without clearing.
    if (entries.length) {
      gl.autoClear = false;
      for (const e of entries) {
        try {
          e.viewer.render();
        } catch {
          /* viewer not ready */
        }
      }
      gl.autoClear = true;
    }
  }, 1); // priority > 0 takes over R3F's automatic render

  return null;
}

/** Wrap the contents of a <Canvas> so any SplatRoom inside renders correctly. */
export function SplatStage({ children }: { children: React.ReactNode }) {
  const registry = useRef<Registry>(new Map());
  return (
    <SplatContext.Provider value={registry.current}>
      <SplatFrame registry={registry.current} />
      {children}
    </SplatContext.Provider>
  );
}
