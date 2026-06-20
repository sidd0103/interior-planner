"use client";

import useSWR from "swr";
import Link from "next/link";
import * as repo from "@/lib/storage/repo";
import { FurnitureGenerator } from "./FurnitureGenerator";
import { GenerationStatus } from "./GenerationStatus";

interface Props {
  projectId: string;
  roomName: string;
  placedCount: number;
  onPlace: (furnitureAssetId: string) => void;
}

/**
 * Right-hand panel for the room editor: generate furniture from a photo, then
 * place any library asset into the room.
 */
export function FurniturePanel({ projectId, roomName, placedCount, onPlace }: Props) {
  const { data: furniture, mutate } = useSWR(["furniture", projectId], () =>
    repo.listFurniture(projectId),
  );

  async function remove(id: string) {
    await repo.deleteFurniture(id);
    mutate();
  }

  return (
    <aside
      style={{
        width: 340,
        height: "100vh",
        borderLeft: "1px solid var(--border)",
        background: "var(--panel)",
        padding: 16,
        overflowY: "auto",
      }}
      className="col"
    >
      <div>
        <Link href={`/project/${projectId}`} className="muted" style={{ fontSize: 13 }}>
          ← {roomName}
        </Link>
        <h2 style={{ margin: "6px 0 0", fontSize: 18 }}>Furniture</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {placedCount} placed in this room
        </p>
      </div>

      <FurnitureGenerator projectId={projectId} onCreated={mutate} />

      <div className="col" style={{ marginTop: 8 }}>
        {furniture?.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>
            No furniture yet. Generate one from a photo above.
          </p>
        )}
        {furniture?.map((f) => (
          <div key={f.id} className="card col" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</span>
              <GenerationStatus furniture={f} onUpdate={mutate} />
            </div>
            <span className="muted" style={{ fontSize: 11 }}>
              {(f.realDims.width * 100).toFixed(0)}×{(f.realDims.depth * 100).toFixed(0)}×
              {(f.realDims.height * 100).toFixed(0)} cm
            </span>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="primary" onClick={() => onPlace(f.id)} style={{ padding: "6px 12px" }}>
                Place in room
              </button>
              <button className="danger" onClick={() => remove(f.id)} style={{ padding: "6px 10px" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
