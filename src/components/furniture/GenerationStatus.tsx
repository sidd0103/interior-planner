"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import { useJob } from "@/lib/jobs/useJob";
import * as repo from "@/lib/storage/repo";
import type { FurnitureAsset } from "@/lib/storage/types";

interface StatusResp {
  status: "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";
  progress: number;
  glbReady: boolean;
  error?: string;
}

const isTerminal = (s: StatusResp) =>
  s.status === "SUCCEEDED" || s.status === "FAILED" || s.status === "CANCELED";

/**
 * Drives a furniture asset's Meshy job to completion: polls the status route,
 * and on success downloads the GLB into the blob store and attaches it. Because
 * it derives everything from persisted state (furniture.jobId → Job.externalId),
 * it resumes automatically after a page reload.
 */
export function GenerationStatus({
  furniture,
  onUpdate,
}: {
  furniture: FurnitureAsset;
  onUpdate: () => void;
}) {
  const hasMesh = !!furniture.glbAssetId;

  const { data: job } = useSWR(
    furniture.jobId && !hasMesh ? ["job", furniture.jobId] : null,
    () => repo.getJob(furniture.jobId!),
  );
  const taskId = job?.externalId;
  const jobErrored = job?.status === "error";

  const pollUrl = taskId && !hasMesh && !jobErrored ? `/api/meshy/status/${taskId}` : null;
  const { data: status, error } = useJob<StatusResp>(pollUrl, isTerminal);

  const finalizing = useRef(false);
  useEffect(() => {
    if (!status || hasMesh || !taskId || finalizing.current) return;

    if (status.status === "SUCCEEDED" && status.glbReady) {
      finalizing.current = true;
      (async () => {
        try {
          const res = await fetch(`/api/meshy/download/${taskId}`);
          if (!res.ok) throw new Error(await res.text());
          const blob = await res.blob();
          const glbAssetId = await repo.putAsset(blob);
          await repo.updateFurniture(furniture.id, { glbAssetId });
          if (furniture.jobId)
            await repo.updateJob(furniture.jobId, { status: "done", resultAssetId: glbAssetId });
          onUpdate();
        } catch (e) {
          if (furniture.jobId)
            await repo.updateJob(furniture.jobId, { status: "error", error: (e as Error).message });
          finalizing.current = false;
          onUpdate();
        }
      })();
    } else if (status.status === "FAILED" || status.status === "CANCELED") {
      if (furniture.jobId)
        repo.updateJob(furniture.jobId, { status: "error", error: status.error });
    }
  }, [status, hasMesh, taskId, furniture.id, furniture.jobId, onUpdate]);

  if (hasMesh) return <span className="badge ok">mesh ✓</span>;
  if (!furniture.jobId) return <span className="badge">box</span>;
  if (jobErrored || error) return <span className="badge err" title={job?.error}>mesh failed · box</span>;
  if (status?.status === "FAILED") return <span className="badge err">failed</span>;
  const pct = status?.progress ?? 0;
  return <span className="badge busy">generating {pct ? `${pct}%` : "…"}</span>;
}
