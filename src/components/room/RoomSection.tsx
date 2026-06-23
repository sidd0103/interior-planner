"use client";

import { RoomCaptureWizard } from "@/components/capture/RoomCaptureWizard";
import { usePrefs, useMounted } from "@/lib/scene/prefs";
import { formatArea, formatLength } from "@/lib/geometry/units";
import * as repo from "@/lib/storage/repo";
import type { Room } from "@/lib/storage/types";

interface Props {
  room: Room;
  onUpdate: () => void;
  /** Enter in-editor calibration (draw tapes + the room box in the scene). */
  onCalibrate: () => void;
}

/** "Room" section body: dimensions, capture, flip-upright, calibrate. */
export function RoomSection({ room, onUpdate, onCalibrate }: Props) {
  const unitSystem = usePrefs((s) => s.unitSystem);
  const mounted = useMounted();
  const d = room.dimensions;

  return (
    <>
      {d && mounted && (
        <p className="muted" style={{ fontSize: 12, margin: "0 0 2px" }}>
          {formatLength(d.width, unitSystem)} × {formatLength(d.depth, unitSystem)} ·{" "}
          {formatLength(d.height, unitSystem)} tall · {formatArea(d.width * d.depth, unitSystem)}
        </p>
      )}

      <RoomCaptureWizard room={room} onUpdate={onUpdate} />

      {room.splatAssetId && (
        <>
          <button
            onClick={async () => {
              // Flip the currently-rendered orientation. Derive the current
              // state from the saved rotation's Y component (−1 ⇒ already
              // flipped) so one click always corrects an upside-down room.
              const flipped = (room.metricTransform?.rotation?.[4] ?? 1) < 0;
              await repo.updateRoom(room.id, { splatUpFlip: !flipped, metricTransform: undefined });
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
    </>
  );
}
