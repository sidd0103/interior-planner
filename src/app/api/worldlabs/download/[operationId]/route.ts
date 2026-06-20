import { downloadSplat } from "@/lib/clients/worldLabsClient";

/** Streams the generated .spz splat bytes server-side (avoids browser CORS on signed URLs). */
export async function GET(_req: Request, ctx: { params: Promise<{ operationId: string }> }) {
  const { operationId } = await ctx.params;
  try {
    const buf = await downloadSplat(operationId);
    return new Response(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${operationId}.spz"`,
      },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
}
