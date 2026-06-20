"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEditor } from "@/lib/scene/editorStore";

interface Props {
  children: React.ReactNode;
}

/**
 * R3F <Canvas> root with camera + orbit controls. `makeDefault` on
 * OrbitControls lets drei's TransformControls auto-disable orbiting while a
 * gizmo is being dragged. Clicking empty space clears the selection.
 */
export function SceneCanvas({ children }: Props) {
  const select = useEditor((s) => s.select);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [4, 3, 6], fov: 50, near: 0.01, far: 1000 }}
      onPointerMissed={() => select(null)}
      style={{ width: "100%", height: "100%", background: "#0b0d11" }}
    >
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} maxDistance={60} />
      {children}
    </Canvas>
  );
}
