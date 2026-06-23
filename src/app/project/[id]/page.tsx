"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import * as repo from "@/lib/storage/repo";
import { TrashIcon } from "@/components/ui/icons";

export default function ProjectPage() {
  const projectId = useParams().id as string;
  const { data: project } = useSWR(["project", projectId], () => repo.getProject(projectId));
  const { data: access, mutate: mutateAccess } = useSWR(["access", projectId], () =>
    repo.getProjectAccess(projectId),
  );
  const { data: rooms, mutate: mutateRooms } = useSWR(["rooms", projectId], () =>
    repo.listRooms(projectId),
  );
  const { data: furniture } = useSWR(["furniture", projectId], () =>
    repo.listFurniture(projectId),
  );
  const [roomName, setRoomName] = useState("");
  const [copied, setCopied] = useState(false);

  const canEdit = access?.canEdit ?? false;
  const isPublic = access?.visibility === "public";

  async function addRoom() {
    const name = roomName.trim();
    if (!name) return;
    await repo.createRoom(projectId, name);
    setRoomName("");
    mutateRooms();
  }

  async function removeRoom(id: string, name: string) {
    if (!confirm(`Delete room “${name}” and everything in it?`)) return;
    await repo.deleteRoom(id);
    mutateRooms();
  }

  async function toggleVisibility() {
    await repo.setProjectVisibility(projectId, isPublic ? "private" : "public");
    mutateAccess();
  }

  function copyLink() {
    navigator.clipboard.writeText(`${location.origin}/project/${projectId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <Link href="/" className="muted" style={{ fontSize: 13 }}>
            ← All projects
          </Link>
          <h1 style={{ margin: "6px 0 0" }}>{project?.name ?? "…"}</h1>
        </div>
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          {canEdit && (
            <>
              <span className={`badge ${isPublic ? "ok" : ""}`}>
                {isPublic ? "Public" : "Private"}
              </span>
              <button onClick={toggleVisibility} title="Toggle who can view this project">
                {isPublic ? "Make private" : "Make public"}
              </button>
              {isPublic && (
                <button onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
              )}
            </>
          )}
          <Link href={`/project/${projectId}/apartment`}>
            <button className="primary">Apartment 3D view</button>
          </Link>
        </div>
      </div>
      {isPublic && (
        <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
          {canEdit
            ? "Anyone with the link can view this project (read-only)."
            : "You're viewing a shared project (read-only)."}
        </p>
      )}

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18 }}>Rooms</h2>
        {canEdit && (
          <div className="card">
            <div className="row">
              <input
                placeholder="Room name (e.g. Living Room)"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addRoom()}
                style={{ flex: 1 }}
              />
              <button className="primary" onClick={addRoom} disabled={!roomName.trim()}>
                Add room
              </button>
            </div>
          </div>
        )}

        <div className="col" style={{ marginTop: 14 }}>
          {rooms?.length === 0 && <p className="muted">No rooms yet.</p>}
          {rooms?.map((r) => (
            <div key={r.id} className="card row" style={{ gap: 8, padding: 14 }}>
              <Link
                href={`/project/${projectId}/room/${r.id}`}
                className="row"
                style={{ flex: 1, minWidth: 0, justifyContent: "space-between", color: "var(--text)" }}
              >
                <span style={{ fontWeight: 600 }}>{r.name}</span>
                <span className="row">
                  {r.splatAssetId ? (
                    <span className="badge ok">captured</span>
                  ) : (
                    <span className="badge">not captured</span>
                  )}
                  {r.metricTransform ? (
                    <span className="badge ok">scaled</span>
                  ) : (
                    <span className="badge">unscaled</span>
                  )}
                </span>
              </Link>
              {canEdit && (
                <button
                  className="icon-btn"
                  title="Delete room"
                  onClick={() => removeRoom(r.id, r.name)}
                  style={{ color: "#ff8a8c" }}
                >
                  <TrashIcon size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 18 }}>Furniture library</h2>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          {furniture?.length ?? 0} asset(s). Generate furniture from a photo inside any room.
        </p>
      </section>
    </main>
  );
}
