"use client";

/**
 * Resolve an assetId to its authenticated read URL — the /api/asset/<id> proxy,
 * which access-checks the request and streams the private Blob. Same-origin, so
 * the browser sends the session cookie automatically.
 */
export function useAssetUrl(assetId?: string): string | undefined {
  return assetId ? `/api/asset/${assetId}` : undefined;
}

/** Non-hook variant for building the same URL outside React. */
export function assetSrc(assetId?: string): string | undefined {
  return assetId ? `/api/asset/${assetId}` : undefined;
}
