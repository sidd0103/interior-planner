"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function ApartmentPage() {
  const projectId = useParams().id as string;

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <Link href={`/project/${projectId}`} className="muted" style={{ fontSize: 13 }}>
        ← Back to project
      </Link>
      <h1 style={{ margin: "6px 0 0" }}>Apartment view</h1>
      <p className="muted">Multi-room 3D assembly — built in a later phase.</p>
    </main>
  );
}
