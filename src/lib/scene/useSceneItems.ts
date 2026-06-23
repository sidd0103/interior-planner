"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import * as repo from "@/lib/storage/repo";
import { assetSrc } from "@/lib/storage/useAssetUrl";
import type { FurnitureAsset } from "@/lib/storage/types";
import type { SceneItem } from "./types";

const FALLBACK_DIMS = { width: 0.6, height: 0.6, depth: 0.6 };

/**
 * Assembles the SceneItem view-models for a room: joins PlacedFurniture with its
 * FurnitureAsset and resolves each GLB to its authenticated read URL
 * (/api/asset/<id>). Returns the SWR mutator so callers can refresh after edits.
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

  const items: SceneItem[] = (placed ?? []).map((p) => {
    const asset = assets[p.furnitureAssetId];
    return {
      id: p.id,
      assetId: p.furnitureAssetId,
      label: asset?.name ?? "Furniture",
      glbUrl: assetSrc(asset?.glbAssetId),
      realDims: asset?.realDims ?? FALLBACK_DIMS,
      position: p.position,
      rotation: p.rotation,
      scale: p.scale,
    };
  });

  return { items, placed, mutate };
}
