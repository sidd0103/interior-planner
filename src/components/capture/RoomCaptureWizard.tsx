"use client";

import { useState } from "react";
import * as repo from "@/lib/storage/repo";
import { fileToDataUri } from "@/lib/util/file";
import { CaptureStatus } from "./CaptureStatus";
import type { Room } from "@/lib/storage/types";

interface Props {
  room: Room;
  onUpdate: () => void;
}

type Tab = "generate" | "import";

/**
 * Two ways to give a room a 3D scene:
 *  1. Generate — upload room footage (video / frames) → World Labs Marble.
 *  2. Import — drop in an existing splat file (.ply/.ksplat/.splat) exported
 *     from World Labs, Luma, Polycam, etc. (works without an API key).
 */
export function RoomCaptureWizard({ room, onUpdate }: Props) {
  const [tab, setTab] = useState<Tab>("generate");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function startGeneration() {
    if (files.length === 0) return;
    setBusy(true);
    setErr(undefined);
    try {
      const images = files.filter((f) => f.type.startsWith("image/"));
      const video = files.find((f) => f.type.startsWith("video/"));
      const body: { imageUrls?: string[]; videoUrl?: string } = {};
      if (images.length) body.imageUrls = await Promise.all(images.map(fileToDataUri));
      if (video) body.videoUrl = await fileToDataUri(video);

      const job = await repo.createJob("worldlabs");
      await repo.updateRoom(room.id, { captureJobId: job.id });
      onUpdate();

      const res = await fetch("/api/worldlabs/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Capture request failed");
      await repo.updateJob(job.id, { externalId: json.worldId, status: "processing" });
      setFiles([]);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
      if (room.captureJobId)
        await repo.updateJob(room.captureJobId, { status: "error", error: (e as Error).message });
      onUpdate();
    } finally {
      setBusy(false);
    }
  }

  async function importSplat() {
    const file = files[0];
    if (!file) return;
    setBusy(true);
    setErr(undefined);
    try {
      const splatAssetId = await repo.putAsset(file);
      await repo.updateRoom(room.id, { splatAssetId });
      setFiles([]);
      onUpdate();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
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
                Upload a walkthrough video or several photos of the room.
              </span>
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <button
                className="primary"
                onClick={startGeneration}
                disabled={busy || inProgress || files.length === 0}
              >
                {busy ? "Uploading…" : "Reconstruct room"}
              </button>
            </div>
          ) : (
            <div className="col" style={{ gap: 8 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Import a .ply / .ksplat / .splat file.
              </span>
              <input
                type="file"
                accept=".ply,.ksplat,.splat"
                onChange={(e) => setFiles(e.target.files ? [e.target.files[0]] : [])}
              />
              <button className="primary" onClick={importSplat} disabled={busy || files.length === 0}>
                {busy ? "Importing…" : "Import"}
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
