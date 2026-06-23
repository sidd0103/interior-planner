"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Loader } from "@react-three/drei";
import { SceneCanvas } from "@/components/scene/SceneCanvas";
import { RoomScene } from "@/components/scene/RoomScene";
import { SplatRoom } from "@/components/scene/SplatRoom";
import { Toolbar } from "@/components/scene/Toolbar";
import { EditorSidebar } from "./EditorSidebar";
import { RoomSection } from "./RoomSection";
import { FurnitureSection } from "@/components/furniture/FurnitureSection";
import { CalibratePanel } from "@/components/measure/CalibratePanel";
import { CalibrateTools } from "@/components/measure/CalibrateTools";
import { useCalibration } from "@/components/measure/useCalibration";
import { useSceneItems } from "@/lib/scene/useSceneItems";
import { useEditor } from "@/lib/scene/editorStore";
import { useAssetUrl } from "@/lib/storage/useAssetUrl";
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
  const { data: access } = useSWR(["access", projectId], () => repo.getProjectAccess(projectId));
  const canEdit = access?.canEdit ?? false;
  const splatUrl = useAssetUrl(room?.splatAssetId);

  const [calibrating, setCalibrating] = useState(false);
  const calib = useCalibration(room, mutateRoom);

  // Click-to-place bridge: the canvas reports the screen pixel; CalibrateTools
  // raycasts it against the splat. downPos lets us ignore look-drags.
  const placeRef = useRef<((x: number, y: number) => void) | undefined>(undefined);
  const downPos = useRef<{ x: number; y: number } | null>(null);

  // The splat follows the live calibration scale while calibrating.
  const splatTransform = calibrating ? calib.transform : room?.metricTransform;

  // Spawn at the room's capture point (inside), looking into the room.
  const initialView = useMemo(() => {
    const t = room?.metricTransform?.translation;
    if (!t) return undefined;
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

  const startCalibrating = () => {
    select(null);
    setCalibrating(true);
  };
  const stopCalibrating = () => {
    calib.reset();
    setCalibrating(false);
  };

  async function onTransform(id: string, patch: TransformPatch) {
    await repo.updatePlaced(id, patch);
    // Optimistically apply the new transform to the cache without revalidating,
    // so the mesh stays put instead of briefly snapping back to its old pose.
    mutate((prev) => prev?.map((p) => (p.id === id ? { ...p, ...patch } : p)), {
      revalidate: false,
    });
  }

  async function onDelete() {
    if (!selectedId) return;
    await repo.removePlaced(selectedId);
    select(null);
    mutate();
  }

  // Asset behind the selected placed instance (for the properties panel).
  const selectedAssetId = placed?.find((p) => p.id === selectedId)?.furnitureAssetId ?? null;

  async function placeAsset(furnitureAssetId: string) {
    await repo.placeFurniture(roomId, furnitureAssetId, { position: [0, 0, 0] });
    mutate();
  }

  // The GLB's actual rendered size becomes the asset's stored dims, so the box,
  // labels, collision, and editor all agree (and the box wraps the mesh tight).
  async function onMeasure(assetId: string, size: { width: number; height: number; depth: number }) {
    await repo.updateFurniture(assetId, { realDims: size });
    mutate();
  }

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw" }}>
      {room &&
        canEdit &&
        (calibrating ? (
          <CalibratePanel calib={calib} onDone={stopCalibrating} />
        ) : (
          <EditorSidebar
            roomName={room.name}
            backHref={`/project/${projectId}`}
            hasSelection={!!selectedId}
            roomContent={
              <RoomSection room={room} onUpdate={mutateRoom} onCalibrate={startCalibrating} />
            }
            furnitureContent={
              <FurnitureSection
                projectId={projectId}
                placedCount={placed?.length ?? 0}
                onPlace={placeAsset}
                selectedAssetId={selectedAssetId}
                onUnplace={onDelete}
                onDeselect={() => select(null)}
                onAssetChange={mutate}
              />
            }
          />
        ))}

      <div style={{ flex: 1, position: "relative" }}>
        {canEdit && !calibrating && selectedId && <Toolbar onDelete={onDelete} />}
        <SceneCanvas
          initialView={initialView}
          onPointerDown={(e) => (downPos.current = { x: e.clientX, y: e.clientY })}
          onPointerMissed={(e) => {
            if (!calibrating) {
              select(null);
              return;
            }
            const d = downPos.current;
            // Ignore look-drags (only near-stationary clicks place a point).
            if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
            placeRef.current?.(e.clientX, e.clientY);
          }}
        >
          <RoomScene
            items={calibrating ? [] : items}
            onTransform={onTransform}
            worldBounds={calibrating ? undefined : worldBounds}
            onMeasure={onMeasure}
            readOnly={!canEdit}
          >
            {splatUrl && (
              <SplatRoom
                url={splatUrl}
                format={room?.splatFormat}
                transform={splatTransform}
                upFlip={room?.splatUpFlip}
                onAutoFit={async (t) => {
                  await repo.updateRoom(roomId, { metricTransform: t });
                  mutateRoom();
                }}
              />
            )}
            {calibrating && <CalibrateTools calib={calib} placeRef={placeRef} />}
          </RoomScene>
        </SceneCanvas>
        <div
          className="muted"
          style={{ position: "absolute", bottom: 12, left: 12, fontSize: 12, zIndex: 10 }}
        >
          {calibrating
            ? `WASD to walk · drag to look · ${calib.tool === "measure" ? "click to place tape points" : "drag the box faces"}`
            : `${items.length} item(s) · WASD to walk · drag to look · scroll to move · drag the gizmo to move furniture`}
        </div>
        <Loader />
      </div>

    </div>
  );
}
