"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import * as repo from "@/lib/storage/repo";

export default function ProjectPage() {
  const projectId = useParams().id as string;
  const { data: project } = useSWR(["project", projectId], () => repo.getProject(projectId));
  const { data: rooms, mutate: mutateRooms } = useSWR(["rooms", projectId], () =>
    repo.listRooms(projectId),
  );
  const { data: furniture } = useSWR(["furniture", projectId], () =>
    repo.listFurniture(projectId),
  );
  const [roomName, setRoomName] = useState("");

  async function addRoom() {
    const name = roomName.trim();
    if (!name) return;
    await repo.createRoom(projectId, name);
    setRoomName("");
    mutateRooms();
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
        <Link href={`/project/${projectId}/apartment`}>
          <button className="primary">Apartment 3D view</button>
        </Link>
      </div>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 18 }}>Rooms</h2>
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

        <div className="col" style={{ marginTop: 14 }}>
          {rooms?.length === 0 && <p className="muted">No rooms yet.</p>}
          {rooms?.map((r) => (
            <Link
              key={r.id}
              href={`/project/${projectId}/room/${r.id}`}
              className="card row"
              style={{ justifyContent: "space-between" }}
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
