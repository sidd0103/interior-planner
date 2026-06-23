import { put } from "@vercel/blob";
import { requireUser, requireWrite } from "@/lib/auth/dal";
import { registerAsset } from "@/lib/storage/repo";

/**
 * Backend file upload: the browser POSTs a file (multipart/form-data) here; the
 * server authorizes it, uploads the bytes to Vercel Blob, and records the asset
 * row — so neither the Blob write nor the DB write happens on the client.
 * Returns the assetId for the caller to attach (e.g. room.splatAssetId).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    await requireUser();
    const form = await req.formData();
    const file = form.get("file");
    const projectId = String(form.get("projectId") ?? "");
    const prefix = String(form.get("prefix") ?? "assets");
    if (!(file instanceof File)) {
      return Response.json({ error: "No file" }, { status: 400 });
    }
    await requireWrite(projectId);

    const pathname = `${prefix}/${projectId}/${file.name || "file"}`;
    const blob = await put(pathname, file, { access: "private", addRandomSuffix: true });
    const assetId = await registerAsset({
      blobUrl: blob.url,
      pathname: blob.pathname,
      projectId,
      contentType: file.type || undefined,
      size: file.size,
    });
    return Response.json({ assetId });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
