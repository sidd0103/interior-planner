import { downloadGlb } from "@/lib/clients/meshyClient";

/** Streams the generated GLB bytes server-side so the browser avoids CORS on Meshy's signed URLs. */
export async function GET(_req: Request, ctx: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await ctx.params;
  try {
    const buf = await downloadGlb(taskId);
    return new Response(buf, {
      headers: {
        "Content-Type": "model/gltf-binary",
        "Content-Disposition": `attachment; filename="${taskId}.glb"`,
      },
    });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
}
