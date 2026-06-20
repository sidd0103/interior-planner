/**
 * Server-only adapter for the World Labs Marble "World API".
 * Docs: https://docs.worldlabs.ai/api
 *
 * Flow (verified against the docs):
 *   1. prepareUpload()  → POST /media-assets:prepare_upload → { mediaAssetId, uploadUrl }
 *   2. (client) PUT the file bytes to uploadUrl                (proxied via our /upload route)
 *   3. generateWorld()  → POST /worlds:generate (world_prompt references the asset) → operationId
 *   4. getOperation()   → GET /operations/{id} → done + the splat (.spz) download URL
 *
 * Output splats are SPZ (Gaussian splat) at several resolutions; we use 500k.
 */

import "server-only";
import { requireEnv } from "./env";

const BASE = "https://api.worldlabs.ai/marble/v1";

export type AssetKind = "image" | "video";

export interface PreparedUpload {
  mediaAssetId: string;
  uploadUrl: string;
  /** Headers the PUT to the signed URL must include (e.g. x-goog-content-length-range). */
  requiredHeaders: Record<string, string>;
}

export interface OperationResult {
  id: string;
  done: boolean;
  /** Download URL for the generated .spz splat, present when done. */
  splatUrl?: string;
  error?: string;
}

function authHeaders(): Record<string, string> {
  return {
    "WLT-Api-Key": requireEnv("WORLD_LABS_API_KEY"),
    "Content-Type": "application/json",
  };
}

/** Strip an `operations/` (or similar) resource prefix to the bare id. */
function bareId(name: string): string {
  const slash = name.lastIndexOf("/");
  return slash === -1 ? name : name.slice(slash + 1);
}

/** Step 1: ask for a signed upload URL for a local file. */
export async function prepareUpload(
  fileName: string,
  kind: AssetKind,
  extension: string,
): Promise<PreparedUpload> {
  const res = await fetch(`${BASE}/media-assets:prepare_upload`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ file_name: fileName, kind, extension }),
  });
  if (!res.ok) throw new Error(`prepare_upload failed (${res.status}): ${await res.text()}`);

  const j = (await res.json()) as {
    media_asset?: { media_asset_id?: string; id?: string };
    upload_info?: { upload_url?: string; required_headers?: Record<string, string> };
  };
  const mediaAssetId = j.media_asset?.media_asset_id ?? j.media_asset?.id;
  const uploadUrl = j.upload_info?.upload_url;
  if (!mediaAssetId || !uploadUrl) {
    throw new Error("prepare_upload returned no media_asset id / upload_url");
  }
  return { mediaAssetId, uploadUrl, requiredHeaders: j.upload_info?.required_headers ?? {} };
}

/** Step 3: start generation from an uploaded asset; returns the operation id. */
export async function generateWorld(
  mediaAssetId: string,
  kind: AssetKind,
  displayName: string,
): Promise<string> {
  const worldPrompt =
    kind === "video"
      ? { type: "video", video_prompt: { source: "media_asset", media_asset_id: mediaAssetId } }
      : { type: "image", image_prompt: { source: "media_asset", media_asset_id: mediaAssetId } };

  const res = await fetch(`${BASE}/worlds:generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      display_name: displayName,
      model: "marble-1.1",
      world_prompt: worldPrompt,
    }),
  });
  if (!res.ok) throw new Error(`worlds:generate failed (${res.status}): ${await res.text()}`);

  const j = (await res.json()) as { name?: string; id?: string; operation?: { name?: string } };
  const name = j.name ?? j.operation?.name ?? j.id;
  if (!name) throw new Error("worlds:generate returned no operation id");
  return bareId(name);
}

/** Extract the .spz splat URL from a completed operation's World response. */
function extractSplatUrl(response: unknown): string | undefined {
  const r = response as
    | { assets?: { splats?: { spz_urls?: Record<string, string> } } }
    | undefined;
  const urls = r?.assets?.splats?.spz_urls;
  if (!urls) return undefined;
  return urls["500k"] ?? urls["full_res"] ?? urls["100k"] ?? Object.values(urls)[0];
}

/** Step 4: poll a generation operation. */
export async function getOperation(operationId: string): Promise<OperationResult> {
  const res = await fetch(`${BASE}/operations/${bareId(operationId)}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`operations get failed (${res.status}): ${await res.text()}`);

  const j = (await res.json()) as {
    name?: string;
    done?: boolean;
    error?: { message?: string } | string;
    response?: unknown;
  };
  const error = typeof j.error === "string" ? j.error : j.error?.message;
  return {
    id: operationId,
    done: !!j.done,
    splatUrl: j.done ? extractSplatUrl(j.response) : undefined,
    error,
  };
}

/** Fetch the generated splat bytes server-side (avoids browser CORS on signed URLs). */
export async function downloadSplat(operationId: string): Promise<ArrayBuffer> {
  const op = await getOperation(operationId);
  if (!op.done || !op.splatUrl) {
    throw new Error(`Operation ${operationId} has no splat yet (done=${op.done})`);
  }
  const res = await fetch(op.splatUrl);
  if (!res.ok) throw new Error(`Splat download failed (${res.status})`);
  return res.arrayBuffer();
}
