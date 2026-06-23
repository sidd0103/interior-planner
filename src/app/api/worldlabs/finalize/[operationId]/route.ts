import { put } from "@vercel/blob";
import { downloadSplat } from "@/lib/clients/worldLabsClient";
import { requireWrite, projectIdOfRoom } from "@/lib/auth/dal";
import { registerAsset, updateRoom, updateJob } from "@/lib/storage/repo";
import { ROT_X180 } from "@/lib/geometry/vec3";
import type { Room } from "@/lib/storage/types";

/**
 * Finalize a World Labs capture entirely server-side: download the .spz, store
 * it in (private) Blob, register the asset, and attach it + an initial metric
 * transform to the room. Keeps the 7MB+ bytes off the browser.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ operationId: string }> },
): Promise<Response> {
  const { operationId } = await ctx.params;
  try {
    const body = (await req.json()) as {
      roomId: string;
      jobId?: string;
      metricScaleFactor?: number;
      groundPlaneOffset?: number;
      hasTransform?: boolean;
    };
    const projectId = await projectIdOfRoom(body.roomId);
    await requireWrite(projectId);

    const buf = await downloadSplat(operationId);
    const blob = await put(`rooms/${body.roomId}/${operationId}.spz`, buf, {
      access: "private",
      addRandomSuffix: true,
      contentType: "application/octet-stream",
    });
    const splatAssetId = await registerAsset({
      blobUrl: blob.url,
      pathname: blob.pathname,
      projectId: projectId as string,
      contentType: "application/octet-stream",
      size: buf.byteLength,
    });

    const patch: Partial<Room> = { splatAssetId, splatFormat: "spz" };
    if (!body.hasTransform && body.metricScaleFactor) {
      patch.metricTransform = {
        scale: body.metricScaleFactor,
        rotation: ROT_X180,
        translation: [0, body.groundPlaneOffset ?? 0, 0],
        rmsResidualMeters: 0,
        solvedAt: Date.now(),
      };
    }
    await updateRoom(body.roomId, patch);
    if (body.jobId) await updateJob(body.jobId, { status: "done", resultAssetId: splatAssetId });
    return Response.json({ splatAssetId });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
