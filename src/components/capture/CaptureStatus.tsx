"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { useJob } from "@/lib/jobs/useJob";
import * as repo from "@/lib/storage/repo";
import type { Room } from "@/lib/storage/types";

interface StatusResp {
  status: "queued" | "processing" | "done" | "error";
  progress: number;
  splatReady: boolean;
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
  const worldId = job?.externalId;
  const jobErrored = job?.status === "error";

  const pollUrl =
    worldId && !hasSplat && !jobErrored ? `/api/worldlabs/status/${worldId}` : null;
  const { data: status, error } = useJob<StatusResp>(pollUrl, isTerminal);

  const finalizing = useRef(false);
  useEffect(() => {
    if (!status || hasSplat || !worldId || finalizing.current) return;

    if (status.status === "done" && status.splatReady) {
      finalizing.current = true;
      (async () => {
        try {
          const res = await fetch(`/api/worldlabs/download/${worldId}`);
          if (!res.ok) throw new Error(await res.text());
          const blob = await res.blob();
          const splatAssetId = await repo.putAsset(blob);
          await repo.updateRoom(room.id, { splatAssetId });
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
  }, [status, hasSplat, worldId, room.id, room.captureJobId, onUpdate]);

  if (hasSplat) return <span className="badge ok">captured ✓</span>;
  if (!room.captureJobId) return null;
  if (jobErrored || error)
    return (
      <span className="badge err" title={job?.error}>
        capture failed
      </span>
    );
  const pct = Math.round((status?.progress ?? 0) * 100);
  return <span className="badge busy">reconstructing {pct ? `${pct}%` : "…"}</span>;
}
