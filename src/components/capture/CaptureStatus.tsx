"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { useJob } from "@/lib/jobs/useJob";
import * as repo from "@/lib/storage/repo";
import { IDENTITY3 } from "@/lib/geometry/vec3";
import type { Room } from "@/lib/storage/types";

interface StatusResp {
  status: "processing" | "done" | "error";
  splatReady: boolean;
  /** World Labs' raw-units → meters factor + ground offset (when done). */
  metricScaleFactor?: number;
  groundPlaneOffset?: number;
  error?: string;
}

const isTerminal = (s: StatusResp) => s.status === "done" || s.status === "error";

/**
 * Drives a room's World Labs capture job to completion: polls the status route,
 * and on success downloads the splat into the blob store and attaches it to the
 * room. Resumes automatically after reload (derives state from room.captureJobId).
 */
export function CaptureStatus({ room, onUpdate }: { room: Room; onUpdate: () => void }) {
  const hasSplat = !!room.splatAssetId;

  const { data: job } = useSWR(
    room.captureJobId && !hasSplat ? ["job", room.captureJobId] : null,
    () => repo.getJob(room.captureJobId!),
  );
  const operationId = job?.externalId;
  const jobErrored = job?.status === "error";

  const pollUrl =
    operationId && !hasSplat && !jobErrored ? `/api/worldlabs/status/${operationId}` : null;
  // World Labs generation takes ~5 minutes; poll on a relaxed interval.
  const { data: status, error } = useJob<StatusResp>(pollUrl, isTerminal, 10000);

  const finalizing = useRef(false);
  useEffect(() => {
    if (!status || hasSplat || !operationId || finalizing.current) return;

    if (status.status === "done" && status.splatReady) {
      finalizing.current = true;
      (async () => {
        try {
          const res = await fetch(`/api/worldlabs/download/${operationId}`);
          if (!res.ok) throw new Error(await res.text());
          const blob = await res.blob();
          const splatAssetId = await repo.putAsset(blob);

          // World Labs gives us the metric scale directly — seed an initial
          // metric transform so the room is correctly scaled out of the box.
          // (The Measure-screenshot reconciler can still refine it.)
          const patch: Partial<Room> = { splatAssetId, splatFormat: "spz" };
          if (!room.metricTransform && status.metricScaleFactor) {
            patch.metricTransform = {
              scale: status.metricScaleFactor,
              rotation: IDENTITY3,
              translation: [0, status.groundPlaneOffset ?? 0, 0],
              rmsResidualMeters: 0,
              solvedAt: Date.now(),
            };
          }
          await repo.updateRoom(room.id, patch);
          if (room.captureJobId)
            await repo.updateJob(room.captureJobId, { status: "done", resultAssetId: splatAssetId });
          onUpdate();
        } catch (e) {
          if (room.captureJobId)
            await repo.updateJob(room.captureJobId, { status: "error", error: (e as Error).message });
          finalizing.current = false;
          onUpdate();
        }
      })();
    } else if (status.status === "error") {
      if (room.captureJobId) repo.updateJob(room.captureJobId, { status: "error", error: status.error });
    }
  }, [status, hasSplat, operationId, room.id, room.captureJobId, onUpdate]);

  if (hasSplat) return <span className="badge ok">captured ✓</span>;
  if (!room.captureJobId) return null;
  if (jobErrored || error)
    return (
      <span className="badge err" title={job?.error}>
        capture failed
      </span>
    );
  return <span className="badge busy">reconstructing… (~5 min)</span>;
}
