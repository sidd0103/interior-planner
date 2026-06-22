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

/**
 * Objects on this THREE layer are drawn *before* the splat (so the splat
 * occludes them — e.g. the floor grid, which otherwise bleeds through walls).
 * Everything else is drawn after the splat, always on top.
 */
export const BACKGROUND_LAYER = 1;

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

    const cam = state.camera;

    if (entries.length === 0) {
      cam.layers.enableAll();
      gl.autoClear = true;
      gl.render(state.scene, cam);
      return;
    }

    // 2. Background layer (e.g. the floor grid) — drawn first so the splat
    //    occludes it (no bleeding through walls).
    cam.layers.set(BACKGROUND_LAYER);
    gl.autoClear = true;
    gl.clear();
    gl.render(state.scene, cam);

    // 3. Splats (depth-tested against the background).
    cam.layers.enableAll();
    gl.autoClear = false;
    for (const e of entries) {
      try {
        e.viewer.render();
      } catch {
        /* viewer not ready */
      }
    }

    // 4. Foreground (furniture, gizmos, bounds box, markers) — on top of the
    //    splat (depth cleared so editing UI is never hidden behind it).
    cam.layers.set(0);
    gl.clearDepth();
    gl.render(state.scene, cam);

    // Restore so R3F pointer raycasting sees every layer.
    cam.layers.enableAll();
    gl.autoClear = true;
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
