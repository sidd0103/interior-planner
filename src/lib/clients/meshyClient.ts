/**
 * Server-only adapter for Meshy AI image-to-3D.
 * Docs: https://docs.meshy.ai/en/api/image-to-3d
 *
 * Behind this interface the rest of the app never sees Meshy's wire format,
 * so the provider can be swapped (Rodin, SF3D) without touching callers.
 */

import "server-only";
import { requireEnv } from "./env";

const BASE = "https://api.meshy.ai/openapi/v1";

export type MeshyStatus = "PENDING" | "IN_PROGRESS" | "SUCCEEDED" | "FAILED" | "CANCELED";

export interface MeshyTask {
  id: string;
  status: MeshyStatus;
  /** 0..100 */
  progress: number;
  modelUrls: { glb?: string; fbx?: string; obj?: string; usdz?: string };
  error?: string;
}

export interface CreateImageTo3DOptions {
  /** Data URI (data:image/...;base64,...) or a public image URL. */
  imageUrl: string;
  /** Lower polycount = lighter browser asset. */
  targetPolycount?: number;
  shouldTexture?: boolean;
  enablePbr?: boolean;
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${requireEnv("MESHY_API_KEY")}`,
    "Content-Type": "application/json",
  };
}

/** Kick off an image-to-3D task; returns the Meshy task id. */
export async function createImageTo3D(opts: CreateImageTo3DOptions): Promise<string> {
  const res = await fetch(`${BASE}/image-to-3d`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      image_url: opts.imageUrl,
      target_polycount: opts.targetPolycount ?? 30000,
      should_texture: opts.shouldTexture ?? true,
      enable_pbr: opts.enablePbr ?? true,
    }),
  });
  if (!res.ok) {
    throw new Error(`Meshy create failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { result?: string };
  if (!json.result) throw new Error("Meshy create returned no task id");
  return json.result;
}

/** Poll a task's current state. */
export async function getTask(taskId: string): Promise<MeshyTask> {
  const res = await fetch(`${BASE}/image-to-3d/${taskId}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Meshy get failed (${res.status}): ${await res.text()}`);
  }
  const j = (await res.json()) as {
    id: string;
    status: MeshyStatus;
    progress?: number;
    model_urls?: MeshyTask["modelUrls"];
    task_error?: { message?: string };
  };
  return {
    id: j.id,
    status: j.status,
    progress: j.progress ?? 0,
    modelUrls: j.model_urls ?? {},
    error: j.task_error?.message,
  };
}

/** Fetch the generated GLB bytes (server-side, avoiding browser CORS on signed URLs). */
export async function downloadGlb(taskId: string): Promise<ArrayBuffer> {
  const task = await getTask(taskId);
  if (task.status !== "SUCCEEDED" || !task.modelUrls.glb) {
    throw new Error(`Task ${taskId} has no GLB (status ${task.status})`);
  }
  const res = await fetch(task.modelUrls.glb);
  if (!res.ok) throw new Error(`GLB download failed (${res.status})`);
  return res.arrayBuffer();
}
