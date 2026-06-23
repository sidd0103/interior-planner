"use client";

import { useState } from "react";
import useSWR from "swr";
import * as repo from "@/lib/storage/repo";
import { usePrefs } from "@/lib/scene/prefs";
import {
  metersToSmall,
  smallToMeters,
  smallUnitLabel,
  type UnitSystem,
} from "@/lib/geometry/units";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import type { FurnitureAsset } from "@/lib/storage/types";
import { FurnitureGenerator } from "./FurnitureGenerator";
import { GenerationStatus } from "./GenerationStatus";

/** Round to 1 decimal, dropping a trailing `.0`. */
function fmt(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

interface Props {
  projectId: string;
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
 * "Furniture" section body. A focused asset — the placed item selected in 3D or
 * a library item clicked here — shows an editable properties card; otherwise you
 * generate from a photo and place any saved asset.
 */
export function FurnitureSection({
  projectId,
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

  // A library item clicked here (for editing) when nothing is selected in 3D.
  const [editingId, setEditingId] = useState<string | null>(null);
  const focusedId = selectedAssetId ?? editingId;
  const focused = focusedId ? furniture?.find((f) => f.id === focusedId) : undefined;
  const isPlacedFocus = !!selectedAssetId && focusedId === selectedAssetId;

  async function applyToFocused(patch: Partial<FurnitureAsset>) {
    if (!focusedId) return;
    await repo.updateFurniture(focusedId, patch);
    mutate();
    onAssetChange?.();
  }

  async function remove(id: string) {
    await repo.deleteFurniture(id);
    if (editingId === id) setEditingId(null);
    mutate();
  }

  function editFromLibrary(id: string) {
    onDeselect?.();
    setEditingId(id);
  }

  function closeFocused() {
    setEditingId(null);
    onDeselect?.();
  }

  return (
    <>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 2px" }}>
        {placedCount} placed in this room
      </p>

      {focused && (
        <FurnitureProperties
          asset={focused}
          unitSystem={unitSystem}
          placed={isPlacedFocus}
          onApply={applyToFocused}
          onPlace={() => onPlace(focused.id)}
          onUnplace={() => onUnplace?.()}
          onClose={closeFocused}
        />
      )}

      <FurnitureGenerator projectId={projectId} onCreated={mutate} />

      <div className="col" style={{ marginTop: 4, gap: 8 }}>
        <span className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.03em" }}>
          LIBRARY ({furniture?.length ?? 0})
        </span>
        {furniture?.length === 0 && (
          <p className="muted" style={{ fontSize: 13 }}>
            No furniture yet. Generate one from a photo above.
          </p>
        )}
        {furniture?.map((f) => (
          <div
            key={f.id}
            className="card col"
            onClick={() => editFromLibrary(f.id)}
            style={{
              gap: 8,
              padding: 12,
              cursor: "pointer",
              borderColor: focusedId === f.id ? "var(--accent)" : undefined,
            }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</span>
              <GenerationStatus furniture={f} onUpdate={mutate} />
            </div>
            <span className="muted" style={{ fontSize: 11 }}>
              {metersToSmall(f.realDims.width, unitSystem).toFixed(0)}×
              {metersToSmall(f.realDims.depth, unitSystem).toFixed(0)}×
              {metersToSmall(f.realDims.height, unitSystem).toFixed(0)} {unit}
              {f.price ? ` · $${f.price}` : ""}
            </span>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button
                className="primary btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlace(f.id);
                }}
              >
                Place in room
              </button>
              <button
                className="danger btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(f.id);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

interface PropsEditor {
  asset: FurnitureAsset;
  unitSystem: UnitSystem;
  /** True when this asset's placed instance is the current 3D selection. */
  placed: boolean;
  onApply: (patch: Partial<FurnitureAsset>) => void;
  onPlace: () => void;
  onUnplace: () => void;
  onClose: () => void;
}

/**
 * Editable properties for the focused asset: bounding-box dimensions, price, and
 * link. Every field is typed then applied with ✓ (a null draft follows the saved
 * value). The bottom action removes it from the room (if placed) or places it.
 */
function FurnitureProperties({
  asset,
  unitSystem,
  placed,
  onApply,
  onPlace,
  onUnplace,
  onClose,
}: PropsEditor) {
  const unit = smallUnitLabel(unitSystem);
  const dW = metersToSmall(asset.realDims.width, unitSystem);
  const dD = metersToSmall(asset.realDims.depth, unitSystem);
  const dH = metersToSmall(asset.realDims.height, unitSystem);

  const [w, setW] = useState<string | null>(null);
  const [d, setD] = useState<string | null>(null);
  const [h, setH] = useState<string | null>(null);
  const dimsDirty = w !== null || d !== null || h !== null;

  const setAxis = (axis: "w" | "d" | "h", val: string) => {
    const base = axis === "w" ? dW : axis === "d" ? dD : dH;
    const num = parseFloat(val);
    if (!num || num <= 0 || base <= 0) {
      if (axis === "w") setW(val);
      else if (axis === "d") setD(val);
      else setH(val);
      return;
    }
    const ratio = num / base;
    setW(axis === "w" ? val : fmt(dW * ratio));
    setD(axis === "d" ? val : fmt(dD * ratio));
    setH(axis === "h" ? val : fmt(dH * ratio));
  };
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
    <div className="card col" style={{ gap: 8, padding: 12, borderColor: "var(--accent)" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong style={{ fontSize: 13 }}>{asset.name}</strong>
        <button className="icon-btn" onClick={onClose} title="Close">
          <CloseIcon size={14} />
        </button>
      </div>

      <label className="muted" style={{ fontSize: 11 }}>
        Size — W×D×H ({unit}) · scales proportionally
      </label>
      <div className="row" style={{ gap: 6 }}>
        <input style={{ width: 48 }} inputMode="decimal" value={w ?? fmt(dW)} onChange={(e) => setAxis("w", e.target.value)} />
        <input style={{ width: 48 }} inputMode="decimal" value={d ?? fmt(dD)} onChange={(e) => setAxis("d", e.target.value)} />
        <input style={{ width: 48 }} inputMode="decimal" value={h ?? fmt(dH)} onChange={(e) => setAxis("h", e.target.value)} />
        <button className={`btn-sm ${dimsDirty ? "primary" : ""}`} disabled={!dimsDirty} onClick={applyDims} title="Apply size" style={{ marginLeft: "auto" }}>
          <CheckIcon size={14} />
        </button>
      </div>

      <label className="muted" style={{ fontSize: 11 }}>
        Price
      </label>
      <div className="row" style={{ gap: 6 }}>
        <span className="muted">$</span>
        <input style={{ width: 90 }} inputMode="decimal" value={price ?? String(asset.price ?? 0)} onChange={(e) => setPrice(e.target.value)} />
        <button className={`btn-sm ${priceDirty ? "primary" : ""}`} disabled={!priceDirty} onClick={applyPrice} title="Apply price" style={{ marginLeft: "auto" }}>
          <CheckIcon size={14} />
        </button>
      </div>

      <label className="muted" style={{ fontSize: 11 }}>
        Web link
      </label>
      <div className="row" style={{ gap: 6 }}>
        <input
          style={{ flex: 1, minWidth: 0 }}
          placeholder="https://…"
          value={link ?? asset.webLink ?? ""}
          onChange={(e) => setLink(e.target.value)}
        />
        <button className={`btn-sm ${linkDirty ? "primary" : ""}`} disabled={!linkDirty} onClick={applyLink} title="Apply link">
          <CheckIcon size={14} />
        </button>
      </div>
      {asset.webLink && !linkDirty && (
        <a
          href={asset.webLink}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 12, color: "var(--accent-hover)", wordBreak: "break-all" }}
        >
          {asset.webLink}
        </a>
      )}

      {placed ? (
        <button className="danger" onClick={onUnplace} style={{ marginTop: 2 }}>
          Remove from room
        </button>
      ) : (
        <button className="primary" onClick={onPlace} style={{ marginTop: 2 }}>
          Place in room
        </button>
      )}
    </div>
  );
}
