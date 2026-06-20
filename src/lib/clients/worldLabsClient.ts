/**
 * Server-only adapter for the World Labs Marble "World API".
 * Docs: https://docs.worldlabs.ai/api  ·  https://www.worldlabs.ai/blog/announcing-the-world-api
 *
 * ⚠️ VERIFY AGAINST LIVE DOCS: the Marble API is new and its exact request /
 * response field names may differ from what is encoded below. Everything Marble-
 * specific is isolated in this file, so correcting the wire format here requires
 * no changes elsewhere. The generate → poll → download lifecycle and the splat
 * output (Gaussian splats) are stable per the announcement.
 */

import "server-only";
import { requireEnv } from "./env";

const BASE = "https://api.worldlabs.ai/marble/v1";

export type WorldStatus = "queued" | "processing" | "done" | "error";

export interface WorldResult {
  id: string;
  status: WorldStatus;
  /** 0..1 */
  progress: number;
  /** Download URL for the generated splat, present when status === "done". */
  splatUrl?: string;
  error?: string;
}

export interface GenerateWorldInput {
  /** Input frames / panorama as data URIs or public URLs (at least one). */
  imageUrls?: string[];
  /** Alternatively a short video clip as a data URI or URL. */
  videoUrl?: string;
}

function authHeaders(): Record<string, string> {
  return {
    "WLT-Api-Key": requireEnv("WORLD_LABS_API_KEY"),
    "Content-Type": "application/json",
  };
}

/** Normalize the provider's status vocabulary to ours. */
function normalizeStatus(s: string): WorldStatus {
  const v = s.toLowerCase();
  if (v.includes("succeed") || v === "done" || v === "completed") return "done";
  if (v.includes("fail") || v === "error" || v.includes("cancel")) return "error";
  if (v.includes("process") || v.includes("running") || v.includes("progress")) return "processing";
  return "queued";
}

/** Start a world generation job; returns the provider world id for polling. */
export async function generateWorld(input: GenerateWorldInput): Promise<string> {
  const inputs = [
    ...(input.imageUrls ?? []).map((url) => ({ type: "image", url })),
    ...(input.videoUrl ? [{ type: "video", url: input.videoUrl }] : []),
  ];
  if (inputs.length === 0) throw new Error("generateWorld requires at least one image or a video");

  const res = await fetch(`${BASE}/worlds:generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ inputs, output_format: "ply" }),
  });
  if (!res.ok) throw new Error(`World Labs generate failed (${res.status}): ${await res.text()}`);

  const j = (await res.json()) as { id?: string; name?: string; world_id?: string };
  const id = j.id ?? j.world_id ?? j.name;
  if (!id) throw new Error("World Labs generate returned no world id");
  return id;
}

/** Poll a world's state. */
export async function getWorld(worldId: string): Promise<WorldResult> {
  const res = await fetch(`${BASE}/worlds/${worldId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`World Labs get failed (${res.status}): ${await res.text()}`);

  const j = (await res.json()) as {
    id?: string;
    status?: string;
    progress?: number;
    assets?: { splat_url?: string; ply_url?: string; url?: string };
    error?: string;
  };
  const splatUrl = j.assets?.splat_url ?? j.assets?.ply_url ?? j.assets?.url;
  return {
    id: j.id ?? worldId,
    status: normalizeStatus(j.status ?? "queued"),
    progress: j.progress ?? 0,
    splatUrl,
    error: j.error,
  };
}

/** Fetch the generated splat bytes server-side (avoids browser CORS on signed URLs). */
export async function downloadSplat(worldId: string): Promise<ArrayBuffer> {
  const world = await getWorld(worldId);
  if (world.status !== "done" || !world.splatUrl) {
    throw new Error(`World ${worldId} has no splat (status ${world.status})`);
  }
  const res = await fetch(world.splatUrl);
  if (!res.ok) throw new Error(`Splat download failed (${res.status})`);
  return res.arrayBuffer();
}
