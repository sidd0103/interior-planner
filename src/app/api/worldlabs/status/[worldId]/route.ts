import { NextResponse } from "next/server";
import { getWorld } from "@/lib/clients/worldLabsClient";

export async function GET(_req: Request, ctx: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await ctx.params;
  try {
    const world = await getWorld(worldId);
    return NextResponse.json({
      status: world.status,
      progress: world.progress,
      splatReady: !!world.splatUrl,
      error: world.error,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
