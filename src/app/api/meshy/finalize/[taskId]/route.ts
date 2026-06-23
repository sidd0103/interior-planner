import { put } from "@vercel/blob";
import { downloadGlb } from "@/lib/clients/meshyClient";
import { requireWrite, projectIdOfFurniture } from "@/lib/auth/dal";
import { registerAsset, updateFurniture, updateJob } from "@/lib/storage/repo";

/**
 * Finalize a Meshy generation server-side: download the GLB, store it in
 * (private) Blob, register the asset, and attach it to the furniture record.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ taskId: string }> },
): Promise<Response> {
  const { taskId } = await ctx.params;
  try {
    const body = (await req.json()) as { furnitureId: string; jobId?: string };
    const projectId = await projectIdOfFurniture(body.furnitureId);
    await requireWrite(projectId);

    const buf = await downloadGlb(taskId);
    const blob = await put(`furniture/${body.furnitureId}/${taskId}.glb`, buf, {
      access: "private",
      addRandomSuffix: true,
      contentType: "model/gltf-binary",
    });
    const glbAssetId = await registerAsset({
      blobUrl: blob.url,
      pathname: blob.pathname,
      projectId: projectId as string,
      contentType: "model/gltf-binary",
      size: buf.byteLength,
    });

    await updateFurniture(body.furnitureId, { glbAssetId });
    if (body.jobId) await updateJob(body.jobId, { status: "done", resultAssetId: glbAssetId });
    return Response.json({ glbAssetId });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
