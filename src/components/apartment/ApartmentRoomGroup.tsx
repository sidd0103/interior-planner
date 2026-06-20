"use client";

import { useEffect, useRef } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { SplatRoom } from "@/components/scene/SplatRoom";
import { StaticFurnitureItem } from "@/components/scene/FurnitureItem";
import { useSceneItems } from "@/lib/scene/useSceneItems";
import { useAssetUrl } from "@/lib/storage/useAssetUrl";
import type { Room, Vec3 } from "@/lib/storage/types";

interface Props {
  room: Room;
  /** Fallback position when the room has no saved layout pose yet. */
  defaultPosition: Vec3;
  selected: boolean;
  onSelect: (id: string) => void;
  registerObject: (id: string, obj: THREE.Object3D | null) => void;
}

/** One room placed in the apartment assembly: its splat + furniture under a posable group. */
export function ApartmentRoomGroup({
  room,
  defaultPosition,
  selected,
  onSelect,
  registerObject,
}: Props) {
  const ref = useRef<THREE.Group>(null);
  const splatUrl = useAssetUrl(room.splatAssetId);
  const { items } = useSceneItems(room.id);

  useEffect(() => {
    registerObject(room.id, ref.current);
    return () => registerObject(room.id, null);
  }, [room.id, registerObject]);

  const pose = room.layoutPose ?? { position: defaultPosition, yaw: 0 };

  return (
    <group
      ref={ref}
      position={pose.position}
      rotation={[0, pose.yaw, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(room.id);
      }}
    >
      {splatUrl && <SplatRoom url={splatUrl} transform={room.metricTransform} lowDetail />}
      {items.map((item) => (
        <StaticFurnitureItem key={item.id} item={item} />
      ))}
      <Text
        position={[0, (room.dimensions?.height ?? 2.5) + 0.3, 0]}
        fontSize={0.35}
        color={selected ? "#5b9dff" : "#e6e8ec"}
        anchorX="center"
      >
        {room.name}
      </Text>
    </group>
  );
}
