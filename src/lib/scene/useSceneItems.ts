"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import * as repo from "@/lib/storage/repo";
import { getAssetUrl, revokeAssetUrl } from "@/lib/storage/blobStore";
import type { FurnitureAsset } from "@/lib/storage/types";
import type { SceneItem } from "./types";

const FALLBACK_DIMS = { width: 0.6, height: 0.6, depth: 0.6 };

/**
 * Assembles the SceneItem view-models for a room: joins PlacedFurniture with
 * its FurnitureAsset and resolves GLB blob ids to object URLs (revoked on
 * cleanup). Returns the SWR mutator so callers can refresh after edits.
 */
export function useSceneItems(roomId: string) {
  const { data: placed, mutate } = useSWR(["placed", roomId], () => repo.listPlaced(roomId));

  // Resolve the furniture assets referenced by the placements.
  const [assets, setAssets] = useState<Record<string, FurnitureAsset>>({});
  useEffect(() => {
    if (!placed) return;
    const ids = [...new Set(placed.map((p) => p.furnitureAssetId))];
    Promise.all(ids.map((id) => repo.getFurniture(id))).then((list) => {
      const map: Record<string, FurnitureAsset> = {};
      for (const f of list) if (f) map[f.id] = f;
      setAssets(map);
    });
  }, [placed]);

  // Resolve GLB object URLs for assets that have a generated mesh.
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const glbIds = [
      ...new Set(Object.values(assets).map((a) => a.glbAssetId).filter(Boolean) as string[]),
    ];
    let active = true;
    const created: string[] = [];
    Promise.all(glbIds.map(async (id) => [id, await getAssetUrl(id)] as const)).then((pairs) => {
      if (!active) {
        pairs.forEach(([, u]) => u && revokeAssetUrl(u));
        return;
      }
      const map: Record<string, string> = {};
      for (const [id, u] of pairs)
        if (u) {
          map[id] = u;
          created.push(u);
        }
      setUrls(map);
    });
    return () => {
      active = false;
      created.forEach(revokeAssetUrl);
    };
  }, [assets]);

  const items: SceneItem[] = (placed ?? []).map((p) => {
    const asset = assets[p.furnitureAssetId];
    return {
      id: p.id,
      label: asset?.name ?? "Furniture",
      glbUrl: asset?.glbAssetId ? urls[asset.glbAssetId] : undefined,
      realDims: asset?.realDims ?? FALLBACK_DIMS,
      position: p.position,
      rotation: p.rotation,
      scale: p.scale,
    };
  });

  return { items, placed, mutate };
}
