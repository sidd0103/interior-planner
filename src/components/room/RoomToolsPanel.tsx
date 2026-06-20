"use client";

import Link from "next/link";
import { RoomCaptureWizard } from "@/components/capture/RoomCaptureWizard";
import type { Room } from "@/lib/storage/types";

interface Props {
  projectId: string;
  room: Room;
  onUpdate: () => void;
}

/** Left panel: room-level tools — capture and (Phase 5) dimension reconciliation. */
export function RoomToolsPanel({ projectId, room, onUpdate }: Props) {
  return (
    <aside
      style={{
        width: 320,
        height: "100vh",
        borderRight: "1px solid var(--border)",
        background: "var(--panel)",
        padding: 16,
        overflowY: "auto",
      }}
      className="col"
    >
      <div>
        <Link href={`/project/${projectId}`} className="muted" style={{ fontSize: 13 }}>
          ← Project
        </Link>
        <h2 style={{ margin: "6px 0 0", fontSize: 18 }}>{room.name}</h2>
        {room.dimensions && (
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {room.dimensions.width.toFixed(2)} × {room.dimensions.depth.toFixed(2)} m ·{" "}
            {room.dimensions.height.toFixed(2)} m tall
          </p>
        )}
      </div>

      <RoomCaptureWizard room={room} onUpdate={onUpdate} />
    </aside>
  );
}
