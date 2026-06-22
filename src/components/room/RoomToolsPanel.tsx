"use client";

import Link from "next/link";
import { RoomCaptureWizard } from "@/components/capture/RoomCaptureWizard";
import { usePrefs, useMounted } from "@/lib/scene/prefs";
import { formatArea, formatLength } from "@/lib/geometry/units";
import * as repo from "@/lib/storage/repo";
import type { Room } from "@/lib/storage/types";

interface Props {
  projectId: string;
  room: Room;
  onUpdate: () => void;
  /** Enter in-editor calibration (draw tapes + the room box in the scene). */
  onCalibrate: () => void;
}

/** Left panel: room-level tools — capture and calibration. */
export function RoomToolsPanel({ projectId, room, onUpdate, onCalibrate }: Props) {
  const unitSystem = usePrefs((s) => s.unitSystem);
  const mounted = useMounted();
  const d = room.dimensions;
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
        {d && mounted && (
          <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {formatLength(d.width, unitSystem)} × {formatLength(d.depth, unitSystem)} ·{" "}
            {formatLength(d.height, unitSystem)} tall · {formatArea(d.width * d.depth, unitSystem)}
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
          <button className="primary" onClick={onCalibrate}>
            {room.dimensions ? "Re-calibrate room" : "Calibrate room"}
          </button>
        </>
      )}
    </aside>
  );
}
