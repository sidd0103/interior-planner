"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEditor } from "@/lib/scene/editorStore";
import { SplatStage } from "./SplatStage";
import { WalkControls, type InitialView } from "./WalkControls";

interface Props {
  children: React.ReactNode;
  /** Initial camera placement (e.g. inside a captured room). */
  initialView?: InitialView;
}

/**
 * R3F <Canvas> root with orbit controls + WASD walking. `makeDefault` lets
 * drei's TransformControls auto-disable orbiting while a gizmo is dragged.
 * Clicking empty space clears the selection.
 */
export function SceneCanvas({ children, initialView }: Props) {
  const select = useEditor((s) => s.select);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: false, alpha: false, premultipliedAlpha: false }}
      camera={{ position: [4, 3, 6], fov: 55, near: 0.01, far: 1000 }}
      onPointerMissed={() => select(null)}
      style={{ width: "100%", height: "100%", background: "#0b0d11" }}
    >
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} minDistance={0.05} maxDistance={60} />
      <WalkControls initialView={initialView} />
      <SplatStage>{children}</SplatStage>
    </Canvas>
  );
}
