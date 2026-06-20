"use client";

import { useParams } from "next/navigation";
import { RoomEditor } from "@/components/room/RoomEditor";

export default function RoomPage() {
  const { id: projectId, roomId } = useParams() as { id: string; roomId: string };
  return <RoomEditor projectId={projectId} roomId={roomId} />;
}
