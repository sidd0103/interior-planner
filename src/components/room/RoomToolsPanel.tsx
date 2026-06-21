"use client";

import { useState } from "react";
import Link from "next/link";
import { RoomCaptureWizard } from "@/components/capture/RoomCaptureWizard";
import { RoomCalibrator } from "@/components/measure/RoomCalibrator";
import * as repo from "@/lib/storage/repo";
import type { Room } from "@/lib/storage/types";

interface Props {
  projectId: string;
  room: Room;
  onUpdate: () => void;
}

/** Left panel: room-level tools — capture and dimension reconciliation. */
export function RoomToolsPanel({ projectId, room, onUpdate }: Props) {
  const [calibrating, setCalibrating] = useState(false);
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

      {room.splatAssetId && (
        <>
          <button
            onClick={async () => {
              // Flip the currently-rendered orientation. Derive the current
              // state from the saved rotation's Y component (−1 ⇒ already
              // flipped) so one click always corrects an upside-down room.
              const flipped = (room.metricTransform?.rotation?.[4] ?? 1) < 0;
              await repo.updateRoom(room.id, {
                splatUpFlip: !flipped,
                metricTransform: undefined,
              });
              onUpdate();
            }}
            title="If the room is upside down, flip it upright"
          >
            ↕ Flip upright
          </button>
          <button className="primary" onClick={() => setCalibrating(true)}>
            {room.dimensions ? "Re-calibrate room" : "Calibrate room"}
          </button>
        </>
      )}

      {calibrating && (
        <RoomCalibrator
          room={room}
          onClose={() => setCalibrating(false)}
          onCalibrated={onUpdate}
        />
      )}
    </aside>
  );
}
