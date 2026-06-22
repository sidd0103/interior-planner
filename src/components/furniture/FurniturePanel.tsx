"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import * as repo from "@/lib/storage/repo";
import { usePrefs } from "@/lib/scene/prefs";
import {
  metersToSmall,
  smallToMeters,
  smallUnitLabel,
  type UnitSystem,
} from "@/lib/geometry/units";
import type { FurnitureAsset } from "@/lib/storage/types";
import { FurnitureGenerator } from "./FurnitureGenerator";
import { GenerationStatus } from "./GenerationStatus";

interface Props {
  projectId: string;
  roomName: string;
  placedCount: number;
  onPlace: (furnitureAssetId: string) => void;
  /** Asset id of the currently-selected placed item, if any. */
  selectedAssetId?: string | null;
  /** Remove the selected instance from the room (keeps the asset). */
  onUnplace?: () => void;
  onDeselect?: () => void;
  /** Refresh the 3D scene after an asset edit (e.g. new dimensions). */
  onAssetChange?: () => void;
}

/**
 * Right-hand panel for the room editor: when a placed item is selected, edit its
 * properties (dimensions, price, link) and remove it from the room. Otherwise,
 * generate furniture from a photo and place any saved asset into the room.
 */
export function FurniturePanel({
  projectId,
  roomName,
  placedCount,
  onPlace,
  selectedAssetId,
  onUnplace,
  onDeselect,
  onAssetChange,
}: Props) {
  const unitSystem = usePrefs((s) => s.unitSystem);
  const unit = smallUnitLabel(unitSystem);
  const { data: furniture, mutate } = useSWR(["furniture", projectId], () =>
    repo.listFurniture(projectId),
  );

  const selected = selectedAssetId ? furniture?.find((f) => f.id === selectedAssetId) : undefined;

  async function applyToSelected(patch: Partial<FurnitureAsset>) {
    if (!selectedAssetId) return;
    await repo.updateFurniture(selectedAssetId, patch);
    mutate();
    onAssetChange?.();
  }

  async function remove(id: string) {
    await repo.deleteFurniture(id);
    mutate();
  }

  return (
    <aside
      style={{
        width: 340,
        height: "100vh",
        borderLeft: "1px solid var(--border)",
        background: "var(--panel)",
        padding: 16,
        overflowY: "auto",
      }}
      className="col"
    >
      <div>
        <Link href={`/project/${projectId}`} className="muted" style={{ fontSize: 13 }}>
          ← {roomName}
        </Link>
        <h2 style={{ margin: "6px 0 0", fontSize: 18 }}>Furniture</h2>
        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {placedCount} placed in this room
        </p>
      </div>

      {selected && (
        <SelectedFurniture
          asset={selected}
          unitSystem={unitSystem}
          onApply={applyToSelected}
          onUnplace={() => onUnplace?.()}
          onDeselect={() => onDeselect?.()}
        />
      )}

      <FurnitureGenerator projectId={projectId} onCreated={mutate} />

      <div className="col" style={{ marginTop: 8 }}>
        <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
          Library ({furniture?.length ?? 0})
        </span>
        {furniture?.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>
            No furniture yet. Generate one from a photo above.
          </p>
        )}
        {furniture?.map((f) => (
          <div key={f.id} className="card col" style={{ gap: 8 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{f.name}</span>
              <GenerationStatus furniture={f} onUpdate={mutate} />
            </div>
            <span className="muted" style={{ fontSize: 11 }}>
              {metersToSmall(f.realDims.width, unitSystem).toFixed(0)}×
              {metersToSmall(f.realDims.depth, unitSystem).toFixed(0)}×
              {metersToSmall(f.realDims.height, unitSystem).toFixed(0)} {unit}
              {f.price ? ` · $${f.price}` : ""}
            </span>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button className="primary" onClick={() => onPlace(f.id)} style={{ padding: "6px 12px" }}>
                Place in room
              </button>
              <button className="danger" onClick={() => remove(f.id)} style={{ padding: "6px 10px" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

interface SelectedProps {
  asset: FurnitureAsset;
  unitSystem: UnitSystem;
  onApply: (patch: Partial<FurnitureAsset>) => void;
  onUnplace: () => void;
  onDeselect: () => void;
}

/**
 * Editable properties for the selected placed item. Every field is typed then
 * applied with ✓ (a null draft follows the saved value, so it stays in sync).
 */
function SelectedFurniture({ asset, unitSystem, onApply, onUnplace, onDeselect }: SelectedProps) {
  const unit = smallUnitLabel(unitSystem);
  const dW = metersToSmall(asset.realDims.width, unitSystem);
  const dD = metersToSmall(asset.realDims.depth, unitSystem);
  const dH = metersToSmall(asset.realDims.height, unitSystem);

  const [w, setW] = useState<string | null>(null);
  const [d, setD] = useState<string | null>(null);
  const [h, setH] = useState<string | null>(null);
  const dimsDirty = w !== null || d !== null || h !== null;
  const applyDims = () => {
    onApply({
      realDims: {
        width: smallToMeters(parseFloat(w ?? String(dW)) || 0, unitSystem),
        depth: smallToMeters(parseFloat(d ?? String(dD)) || 0, unitSystem),
        height: smallToMeters(parseFloat(h ?? String(dH)) || 0, unitSystem),
      },
    });
    setW(null);
    setD(null);
    setH(null);
  };

  const [price, setPrice] = useState<string | null>(null);
  const priceDirty = price !== null;
  const applyPrice = () => {
    onApply({ price: parseFloat(price ?? String(asset.price ?? 0)) || 0 });
    setPrice(null);
  };

  const [link, setLink] = useState<string | null>(null);
  const linkDirty = link !== null;
  const applyLink = () => {
    onApply({ webLink: (link ?? asset.webLink ?? "").trim() || undefined });
    setLink(null);
  };

  return (
    <div className="card col" style={{ gap: 8, borderColor: "#3a6ea5" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong style={{ fontSize: 14 }}>{asset.name}</strong>
        <button onClick={onDeselect} title="Deselect" style={{ padding: "4px 9px" }}>
          ✕
        </button>
      </div>

      <label className="muted" style={{ fontSize: 12 }}>
        Size — W×D×H ({unit})
      </label>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <input style={{ width: 50 }} inputMode="decimal" value={w ?? dW.toFixed(0)} onChange={(e) => setW(e.target.value)} />
        <input style={{ width: 50 }} inputMode="decimal" value={d ?? dD.toFixed(0)} onChange={(e) => setD(e.target.value)} />
        <input style={{ width: 50 }} inputMode="decimal" value={h ?? dH.toFixed(0)} onChange={(e) => setH(e.target.value)} />
        <button className={dimsDirty ? "primary" : ""} disabled={!dimsDirty} onClick={applyDims} title="Apply size" style={{ padding: "6px 10px", marginLeft: "auto" }}>
          ✓
        </button>
      </div>

      <label className="muted" style={{ fontSize: 12 }}>
        Price
      </label>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <span className="muted">$</span>
        <input style={{ width: 90 }} inputMode="decimal" value={price ?? String(asset.price ?? 0)} onChange={(e) => setPrice(e.target.value)} />
        <button className={priceDirty ? "primary" : ""} disabled={!priceDirty} onClick={applyPrice} title="Apply price" style={{ padding: "6px 10px", marginLeft: "auto" }}>
          ✓
        </button>
      </div>

      <label className="muted" style={{ fontSize: 12 }}>
        Web link
      </label>
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <input
          style={{ flex: 1, minWidth: 0 }}
          placeholder="https://…"
          value={link ?? asset.webLink ?? ""}
          onChange={(e) => setLink(e.target.value)}
        />
        <button className={linkDirty ? "primary" : ""} disabled={!linkDirty} onClick={applyLink} title="Apply link" style={{ padding: "6px 10px" }}>
          ✓
        </button>
      </div>
      {asset.webLink && !linkDirty && (
        <a
          href={asset.webLink}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: "#7fb0ff", wordBreak: "break-all" }}
        >
          {asset.webLink}
        </a>
      )}

      <button className="danger" onClick={onUnplace} style={{ marginTop: 2 }}>
        Remove from room
      </button>
    </div>
  );
}
