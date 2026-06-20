"use client";

import { useEffect, useState } from "react";
import { getAssetUrl, revokeAssetUrl } from "./blobStore";

/**
 * Resolve a blob-store assetId to an object URL for the lifetime of the
 * component. The URL is revoked on unmount or when the id changes.
 */
export function useAssetUrl(assetId?: string): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    if (!assetId) {
      setUrl(undefined);
      return;
    }
    let active = true;
    let created: string | undefined;
    getAssetUrl(assetId).then((u) => {
      if (!active) {
        if (u) revokeAssetUrl(u);
        return;
      }
      created = u;
      setUrl(u);
    });
    return () => {
      active = false;
      if (created) revokeAssetUrl(created);
    };
  }, [assetId]);

  return url;
}
