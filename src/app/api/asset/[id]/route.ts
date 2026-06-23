import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { canRead, projectIdOfAsset } from "@/lib/auth/dal";

/**
 * Authenticated read proxy for private Blob assets. Every read is access-checked
 * (the viewer must own the asset's project, or it must be public), then the
 * private blob is streamed from Vercel Blob. The browser fetches /api/asset/<id>
 * with its session cookie; nothing is publicly reachable.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await ctx.params;

  if (!(await canRead(await projectIdOfAsset(id)))) {
    return new Response("Forbidden", { status: 403 });
  }
  const rows = await getDb()
    .select({ pathname: assets.pathname })
    .from(assets)
    .where(eq(assets.id, id))
    .limit(1);
  if (!rows[0]) return new Response("Not found", { status: 404 });

  const result = await get(rows[0].pathname, { access: "private" });
  if (!result) return new Response("Not found", { status: 404 });

  // Forward only safe headers — NOT content-encoding/length, which would be
  // stale after re-streaming and break decoding (ERR_CONTENT_DECODING_FAILED).
  const headers = new Headers();
  const ct = result.headers.get("content-type");
  if (ct) headers.set("content-type", ct);
  const cd = result.headers.get("content-disposition");
  if (cd) headers.set("content-disposition", cd);
  headers.set("cache-control", "private, max-age=3600");
  return new Response(result.stream as unknown as ReadableStream, { headers });
}
