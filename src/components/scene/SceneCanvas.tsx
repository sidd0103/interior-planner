"use client";

import { Canvas } from "@react-three/fiber";
import { useEditor } from "@/lib/scene/editorStore";
import { SplatStage } from "./SplatStage";
import { FirstPersonControls, type InitialView } from "./FirstPersonControls";

interface Props {
  children: React.ReactNode;
  /** Initial camera placement (e.g. inside a captured room). */
  initialView?: InitialView;
}

/**
 * R3F <Canvas> root with first-person navigation: drag to look, scroll to move
 * forward/back, WASD to walk. Clicking empty space clears the selection;
 * furniture gizmos still work (look is suppressed while dragging a gizmo).
 */
export function SceneCanvas({ children, initialView }: Props) {
  const select = useEditor((s) => s.select);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: false, alpha: false, premultipliedAlpha: false }}
      camera={{ position: [4, 3, 6], fov: 60, near: 0.01, far: 1000 }}
      onPointerMissed={() => select(null)}
      style={{ width: "100%", height: "100%", background: "#0b0d11" }}
    >
      <FirstPersonControls initialView={initialView} />
      <SplatStage>{children}</SplatStage>
    </Canvas>
  );
}
