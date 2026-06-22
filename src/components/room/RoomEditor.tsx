"use client";

import { useEffect, useMemo } from "react";
import useSWR from "swr";
import { Loader } from "@react-three/drei";
import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { RoomScene } from "@/components/scene/RoomScene";
import { SplatRoom } from "@/components/scene/SplatRoom";
import { Toolbar } from "@/components/scene/Toolbar";
import { FurniturePanel } from "@/components/furniture/FurniturePanel";
import { RoomToolsPanel } from "./RoomToolsPanel";
import { useSceneItems } from "@/lib/scene/useSceneItems";
import { useEditor } from "@/lib/scene/editorStore";
import { useAssetUrl } from "@/lib/storage/useAssetUrl";
import { ensureDemoProject } from "@/lib/storage/seed";
import { orientedToWorld } from "@/lib/geometry/calibrate";
import * as repo from "@/lib/storage/repo";
import type { TransformPatch } from "@/lib/scene/types";

interface Props {
  projectId: string;
  roomId: string;
}

export function RoomEditor({ projectId, roomId }: Props) {
  const { items, placed, mutate } = useSceneItems(roomId);
  const { selectedId, select } = useEditor();
  const { data: room, mutate: mutateRoom } = useSWR(["room", roomId], () => repo.getRoom(roomId));
  const splatUrl = useAssetUrl(room?.splatAssetId);

  // Spawn at the room's capture point (inside), looking into the room.
  const initialView = useMemo(() => {
    const t = room?.metricTransform?.translation;
    if (!t) return undefined;
    // Stand at eye height (the capture point can sit near the floor for imports).
    const eyeY = Math.max(t[1], 1.4);
    return {
      position: [t[0], eyeY, t[2]] as [number, number, number],
      target: [t[0], eyeY, t[2] - 3] as [number, number, number],
    };
  }, [room?.metricTransform]);

  // Calibrated room bounds in world space (for drawing + furniture snapping).
  const worldBounds = useMemo(() => {
    const t = room?.metricTransform;
    const b = room?.bounds;
    if (!t || !b) return undefined;
    return { min: orientedToWorld(b.min, t), max: orientedToWorld(b.max, t) };
  }, [room?.metricTransform, room?.bounds]);

  useEffect(() => () => select(null), [select]);

  // Apply any pending demo migrations (e.g. orientation fix) even when the room
  // is opened directly, then refresh so the corrected transform takes effect.
  useEffect(() => {
    ensureDemoProject().then(() => mutateRoom());
  }, [mutateRoom]);

  async function onTransform(id: string, patch: TransformPatch) {
    await repo.updatePlaced(id, patch);
    mutate();
  }

  async function onDelete() {
    if (!selectedId) return;
    await repo.removePlaced(selectedId);
    select(null);
    mutate();
  }

  async function placeAsset(furnitureAssetId: string) {
    await repo.placeFurniture(roomId, furnitureAssetId, { position: [0, 0, 0] });
    mutate();
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      {room && <RoomToolsPanel projectId={projectId} room={room} onUpdate={mutateRoom} />}

      <div style={{ flex: 1, position: "relative" }}>
        <Toolbar onDelete={onDelete} />
        <SceneCanvas initialView={initialView}>
          <RoomScene items={items} onTransform={onTransform} worldBounds={worldBounds}>
            {splatUrl && (
              <SplatRoom
                url={splatUrl}
                format={room?.splatFormat}
                transform={room?.metricTransform}
                upFlip={room?.splatUpFlip}
                onAutoFit={async (t) => {
                  await repo.updateRoom(roomId, { metricTransform: t });
                  mutateRoom();
                }}
              />
            )}
          </RoomScene>
        </SceneCanvas>
        <div className="muted" style={{ position: "absolute", bottom: 12, left: 12, fontSize: 12 }}>
          {items.length} item(s) · WASD to walk · drag to look · scroll to move · drag the gizmo to
          move furniture
        </div>
        <Loader />
      </div>

      <FurniturePanel
        projectId={projectId}
        roomName={room?.name ?? "Room"}
        placedCount={placed?.length ?? 0}
        onPlace={placeAsset}
      />
    </div>
  );
}
