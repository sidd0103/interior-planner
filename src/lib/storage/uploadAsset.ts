"use client";

/**
 * Upload a user file to the backend (/api/blob/upload), which stores it in
 * Vercel Blob and records the asset row server-side. Returns the assetId — a
 * drop-in replacement for the old OPFS putAsset(file). The browser never writes
 * to Blob or the DB directly.
 */
export async function uploadAsset(
  file: File | Blob,
  projectId: string,
  prefix = "assets",
): Promise<string> {
  const fd = new FormData();
  const named = file instanceof File ? file : new File([file], "file");
  fd.append("file", named);
  fd.append("projectId", projectId);
  fd.append("prefix", prefix);

  const res = await fetch("/api/blob/upload", { method: "POST", body: fd });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.assetId) {
    throw new Error(json.error || `Upload failed (${res.status})`);
  }
  return json.assetId as string;
}
