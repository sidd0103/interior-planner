"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ApartmentScene } from "@/components/apartment/ApartmentScene";

export default function ApartmentPage() {
  const projectId = useParams().id as string;

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 2,
          background: "rgba(23,26,33,0.9)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "8px 12px",
        }}
      >
        <Link href={`/project/${projectId}`} className="muted" style={{ fontSize: 13 }}>
          ← Back to project
        </Link>
      </div>
      <ApartmentScene projectId={projectId} />
    </div>
  );
}
