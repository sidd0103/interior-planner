"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import * as repo from "@/lib/storage/repo";

export default function Dashboard() {
  const { data: projects, mutate, isLoading } = useSWR("projects", () => repo.listProjects());
  const [name, setName] = useState("");

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    await repo.createProject(trimmed);
    setName("");
    mutate();
  }

  async function remove(id: string) {
    if (!confirm("Delete this project and everything in it?")) return;
    await repo.deleteProject(id);
    mutate();
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px" }}>
      <h1 style={{ marginBottom: 4 }}>Interior Planner</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Capture rooms, recover real dimensions, generate furniture, and arrange it in 3D.
      </p>

      <div className="card" style={{ marginTop: 24 }}>
        <div className="row">
          <input
            placeholder="New apartment / project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            style={{ flex: 1 }}
          />
          <button className="primary" onClick={create} disabled={!name.trim()}>
            Create
          </button>
        </div>
      </div>

      <div className="col" style={{ marginTop: 24 }}>
        {isLoading && <p className="muted">Loading…</p>}
        {projects?.length === 0 && (
          <p className="muted">No projects yet. Create one above to get started.</p>
        )}
        {projects?.map((p) => (
          <div key={p.id} className="card row" style={{ justifyContent: "space-between" }}>
            <Link href={`/project/${p.id}`} style={{ fontSize: 16, fontWeight: 600 }}>
              {p.name}
            </Link>
            <div className="row">
              <span className="muted" style={{ fontSize: 12 }}>
                {new Date(p.updatedAt).toLocaleDateString()}
              </span>
              <button className="danger" onClick={() => remove(p.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
