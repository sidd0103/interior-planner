"use client";

import { useEffect } from "react";
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

  useEffect(() => () => select(null), [select]);

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
        <SceneCanvas>
          <RoomScene items={items} onTransform={onTransform}>
            {splatUrl && (
              <SplatRoom
                url={splatUrl}
                format={room?.splatFormat}
                transform={room?.metricTransform}
              />
            )}
          </RoomScene>
        </SceneCanvas>
        <div className="muted" style={{ position: "absolute", bottom: 12, left: 12, fontSize: 12 }}>
          {items.length} item(s) · drag the gizmo to move · click empty space to deselect
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
