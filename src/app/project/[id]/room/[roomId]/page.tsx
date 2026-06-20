"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import * as repo from "@/lib/storage/repo";

export default function RoomPage() {
  const { id: projectId, roomId } = useParams() as { id: string; roomId: string };
  const { data: room } = useSWR(["room", roomId], () => repo.getRoom(roomId));

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <Link href={`/project/${projectId}`} className="muted" style={{ fontSize: 13 }}>
        ← Back to project
      </Link>
      <h1 style={{ margin: "6px 0 0" }}>{room?.name ?? "…"}</h1>
      <p className="muted">Room editor — coming together across the next build phases.</p>
    </main>
  );
}
