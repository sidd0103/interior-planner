"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { useJob } from "@/lib/jobs/useJob";
import * as repo from "@/lib/storage/repo";
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
          // Server-side: download the .spz, store it in Blob, attach to the room
          // (+ initial metric transform). 7MB never round-trips the browser.
          const res = await fetch(`/api/worldlabs/finalize/${operationId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: room.id,
              jobId: room.captureJobId,
              metricScaleFactor: status.metricScaleFactor,
              groundPlaneOffset: status.groundPlaneOffset,
              hasTransform: !!room.metricTransform,
            }),
          });
          if (!res.ok) throw new Error(await res.text());
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
