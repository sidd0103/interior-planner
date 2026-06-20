/**
 * Proxies the file PUT to World Labs' signed upload URL, server-side, so the
 * browser never deals with cross-origin PUT/CORS on the GCS bucket.
 *
 * The signed URL is a GCS V4 signed URL whose signature covers specific headers
 * (e.g. `x-goog-content-length-range`). Those exact headers — and no extra
 * `x-goog-*` headers — must be sent on the PUT, so we forward precisely the
 * `required_headers` returned by prepare_upload (passed as JSON) and nothing else.
 */
export const runtime = "nodejs";
export const maxDuration = 300; // allow large (video) uploads

export async function PUT(req: Request) {
  const uploadUrl = req.headers.get("x-wl-upload-url");
  const headersJson = req.headers.get("x-wl-headers");
  if (!uploadUrl) {
    return new Response("Missing x-wl-upload-url header", { status: 400 });
  }

  let putHeaders: Record<string, string> = {};
  try {
    putHeaders = headersJson ? JSON.parse(headersJson) : {};
  } catch {
    return new Response("Invalid x-wl-headers JSON", { status: 400 });
  }

  try {
    const body = await req.arrayBuffer();
    const res = await fetch(uploadUrl, { method: "PUT", headers: putHeaders, body });
    if (!res.ok) {
      return new Response(`Upload to storage failed (${res.status}): ${await res.text()}`, {
        status: 502,
      });
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    return new Response((e as Error).message, { status: 500 });
  }
}
