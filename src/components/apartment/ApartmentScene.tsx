"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, TransformControls } from "@react-three/drei";
import useSWR from "swr";
import * as THREE from "three";
import { ApartmentRoomGroup } from "./ApartmentRoomGroup";
import * as repo from "@/lib/storage/repo";
import type { Vec3 } from "@/lib/storage/types";

type Mode = "translate" | "rotate";

/** Apartment-level assembly: place each captured room on the floor plan. */
export function ApartmentScene({ projectId }: { projectId: string }) {
  const { data: rooms } = useSWR(["rooms", projectId], () => repo.listRooms(projectId));
  const placeable = (rooms ?? []).filter((r) => r.splatAssetId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("translate");

  const objects = useRef(new Map<string, THREE.Object3D>());
  const [selectedObj, setSelectedObj] = useState<THREE.Object3D | null>(null);

  const registerObject = useCallback((id: string, obj: THREE.Object3D | null) => {
    if (obj) objects.current.set(id, obj);
    else objects.current.delete(id);
  }, []);

  useEffect(() => {
    setSelectedObj(selectedId ? objects.current.get(selectedId) ?? null : null);
  }, [selectedId, placeable]);

  const commit = useCallback(async () => {
    if (!selectedId || !selectedObj) return;
    const p = selectedObj.position;
    await repo.updateRoom(selectedId, {
      layoutPose: { position: [p.x, 0, p.z], yaw: selectedObj.rotation.y },
    });
    // Keep rooms flat on the floor.
    selectedObj.position.y = 0;
    selectedObj.rotation.x = 0;
    selectedObj.rotation.z = 0;
  }, [selectedId, selectedObj]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        className="row"
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 1,
          padding: 6,
          gap: 6,
          background: "rgba(23,26,33,0.9)",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}
      >
        <button className={mode === "translate" ? "primary" : ""} onClick={() => setMode("translate")}>
          Move
        </button>
        <button className={mode === "rotate" ? "primary" : ""} onClick={() => setMode("rotate")}>
          Rotate
        </button>
        <button onClick={() => setSelectedId(null)} disabled={!selectedId}>
          Deselect
        </button>
      </div>

      <Canvas
        shadows
        camera={{ position: [8, 9, 12], fov: 50, near: 0.01, far: 2000 }}
        onPointerMissed={() => setSelectedId(null)}
        style={{ background: "#0b0d11" }}
      >
        <OrbitControls makeDefault enableDamping dampingFactor={0.1} maxDistance={120} />
        <ambientLight intensity={0.65} />
        <hemisphereLight args={["#cfd8ff", "#202028", 0.5]} />
        <directionalLight position={[10, 16, 8]} intensity={1} />
        <Grid
          args={[80, 80]}
          cellSize={1}
          cellColor="#2b3038"
          sectionSize={5}
          sectionColor="#3a414d"
          fadeDistance={80}
          infiniteGrid
        />

        {placeable.map((room, i) => (
          <ApartmentRoomGroup
            key={room.id}
            room={room}
            defaultPosition={[i * 6, 0, 0] as Vec3}
            selected={room.id === selectedId}
            onSelect={setSelectedId}
            registerObject={registerObject}
          />
        ))}

        {selectedObj && (
          <TransformControls
            object={selectedObj}
            mode={mode}
            showX={mode === "translate"}
            showZ={mode === "translate"}
            showY={mode === "rotate"}
            onMouseUp={commit}
          />
        )}
      </Canvas>

      {placeable.length === 0 && (
        <div
          className="muted"
          style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}
        >
          Capture at least one room to assemble the apartment.
        </div>
      )}
    </div>
  );
}
