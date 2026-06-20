"use client";

import useSWR from "swr";
import Link from "next/link";
import * as repo from "@/lib/storage/repo";

interface Props {
  projectId: string;
  roomName: string;
  placedCount: number;
  onPlace: (furnitureAssetId: string) => void;
}

/**
 * Right-hand panel for the room editor: the project's furniture library with a
 * "place" action. (Phase 3 adds the photo → 3D generator above the list.)
 */
export function FurniturePanel({ projectId, roomName, placedCount, onPlace }: Props) {
  const { data: furniture, mutate } = useSWR(["furniture", projectId], () =>
    repo.listFurniture(projectId),
  );

  // Dev affordance: create a placeholder asset (no mesh yet) to test placement.
  async function addPlaceholder() {
    await repo.createFurniture({
      projectId,
      name: "Placeholder",
      sourceImageAssetId: "",
      realDims: { width: 0.8, height: 0.75, depth: 0.8 },
    });
    mutate();
  }

  return (
    <aside
      style={{
        width: 320,
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

      <button onClick={addPlaceholder}>+ Add placeholder</button>

      <div className="col" style={{ marginTop: 8 }}>
        {furniture?.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>
            No furniture yet. Add a placeholder to test the editor, or generate from a photo
            (coming next).
          </p>
        )}
        {furniture?.map((f) => (
          <div key={f.id} className="card row" style={{ justifyContent: "space-between" }}>
            <div className="col" style={{ gap: 2 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</span>
              <span className="muted" style={{ fontSize: 11 }}>
                {f.realDims.width.toFixed(2)}×{f.realDims.depth.toFixed(2)}×
                {f.realDims.height.toFixed(2)} m
                {f.glbAssetId ? " · mesh ✓" : " · box"}
              </span>
            </div>
            <button className="primary" onClick={() => onPlace(f.id)} style={{ padding: "6px 10px" }}>
              Place
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
