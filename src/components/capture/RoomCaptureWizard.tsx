"use client";

import { useState } from "react";
import * as repo from "@/lib/storage/repo";
import { putAsset } from "@/lib/storage/blobStore";
import { CaptureStatus } from "./CaptureStatus";
import type { Room } from "@/lib/storage/types";

interface Props {
  room: Room;
  onUpdate: () => void;
}

type Tab = "generate" | "import";

const SPLAT_EXTS = ["ply", "splat", "ksplat", "spz"] as const;
type SplatExt = (typeof SPLAT_EXTS)[number];

function fileExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/**
 * Two ways to give a room a 3D scene:
 *  1. Generate — upload one room walkthrough video (or a single photo) → World
 *     Labs Marble (two-step: prepare upload → PUT bytes → generate → poll).
 *  2. Import — drop in an existing splat file (.ply/.ksplat/.splat/.spz) from
 *     World Labs, Luma, Polycam, etc. (works without an API key).
 */
export function RoomCaptureWizard({ room, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>("generate");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string>();

  async function startGeneration() {
    // Prefer a video; otherwise the first image. Marble takes one primary input.
    const file = files.find((f) => f.type.startsWith("video/")) ?? files[0];
    if (!file) return;
    setErr(undefined);

    const kind: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
    const extension = fileExt(file.name) || (kind === "video" ? "mp4" : "jpg");

    try {
      // 1. Reserve a signed upload slot.
      setBusy("Preparing upload…");
      const prep = await fetch("/api/worldlabs/prepare-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, kind, extension }),
      });
      const prepJson = await prep.json();
      if (!prep.ok) throw new Error(prepJson.error || "prepare_upload failed");

      // 2. Upload the file bytes (proxied to the signed URL to avoid CORS),
      //    forwarding the exact headers GCS signed (x-goog-content-length-range).
      setBusy("Uploading footage…");
      const put = await fetch("/api/worldlabs/upload", {
        method: "PUT",
        headers: {
          "x-wl-upload-url": prepJson.uploadUrl,
          "x-wl-headers": JSON.stringify(prepJson.requiredHeaders ?? {}),
        },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed: ${await put.text()}`);

      // 3. Kick off generation.
      setBusy("Starting reconstruction…");
      const gen = await fetch("/api/worldlabs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaAssetId: prepJson.mediaAssetId, kind, displayName: room.name }),
      });
      const genJson = await gen.json();
      if (!gen.ok) throw new Error(genJson.error || "Generation request failed");

      // 4. Record the job so CaptureStatus can poll it (and survive reloads).
      const job = await repo.createJob("worldlabs", room.projectId);
      await repo.updateJob(job.id, { externalId: genJson.operationId, status: "processing" });
      await repo.updateRoom(room.id, { captureJobId: job.id });
      setFiles([]);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function importSplat() {
    const file = files[0];
    if (!file) return;
    setBusy("Importing…");
    setErr(undefined);
    try {
      const ext = fileExt(file.name);
      const splatFormat = (SPLAT_EXTS as readonly string[]).includes(ext)
        ? (ext as SplatExt)
        : undefined;
      const splatAssetId = await putAsset(file);
      await repo.updateRoom(room.id, { splatAssetId, splatFormat });
      setFiles([]);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const inProgress = !!room.captureJobId && !room.splatAssetId;

  return (
    <div className="card col" style={{ gap: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong style={{ fontSize: 14 }}>Room capture</strong>
        <CaptureStatus room={room} onUpdate={onUpdate} />
      </div>

      {room.splatAssetId ? (
        <div className="col" style={{ gap: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            Scene loaded. Re-capture to replace it.
          </span>
          <button
            className="danger"
            onClick={async () => {
              await repo.updateRoom(room.id, { splatAssetId: undefined });
              onUpdate();
            }}
          >
            Clear scene
          </button>
        </div>
      ) : (
        <>
          <div className="row" style={{ gap: 6 }}>
            <button className={tab === "generate" ? "primary" : ""} onClick={() => setTab("generate")}>
              Generate
            </button>
            <button className={tab === "import" ? "primary" : ""} onClick={() => setTab("import")}>
              Import splat
            </button>
          </div>

          {tab === "generate" ? (
            <div className="col" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Upload one room walkthrough video (mp4/mov) or a single photo.
                Reconstruction takes about 5 minutes.
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                onChange={(e) => setFiles(e.target.files ? [e.target.files[0]] : [])}
              />
              <button
                className="primary"
                onClick={startGeneration}
                disabled={!!busy || inProgress || files.length === 0}
              >
                {busy ?? "Reconstruct room"}
              </button>
            </div>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Import a .ply / .ksplat / .splat / .spz file.
              </span>
              <input
                type="file"
                accept=".ply,.ksplat,.splat,.spz"
                onChange={(e) => setFiles(e.target.files ? [e.target.files[0]] : [])}
              />
              <button className="primary" onClick={importSplat} disabled={!!busy || files.length === 0}>
                {busy ?? "Import"}
              </button>
            </div>
          )}
        </>
      )}

      {err && (
        <span className="badge err" style={{ alignSelf: "flex-start" }}>
          {err}
        </span>
      )}
    </div>
  );
}
