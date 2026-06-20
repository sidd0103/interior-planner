import { downloadSplat } from "@/lib/clients/worldLabsClient";

/** Streams the generated splat bytes server-side (avoids browser CORS on signed URLs). */
export async function GET(_req: Request, ctx: { params: Promise<{ worldId: string }> }) {
  const { worldId } = await ctx.params;
  try {
    const buf = await downloadSplat(worldId);
    return new Response(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${worldId}.ply"`,
      },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
}
