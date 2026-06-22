"use client";

import { useState } from "react";
import * as repo from "@/lib/storage/repo";
import { fileToDataUri } from "@/lib/util/file";
import { usePrefs } from "@/lib/scene/prefs";
import { smallToMeters, smallUnitLabel } from "@/lib/geometry/units";

interface Props {
  projectId: string;
  onCreated: () => void;
}

// Sensible default size (a chair), per unit: ~80 cm ≈ 31 in.
const DEFAULTS = {
  metric: { w: "80", d: "80", h: "75" },
  imperial: { w: "31", d: "31", h: "30" },
};

/**
 * Upload a furniture photo + real dimensions → kick off a Meshy image-to-3D job.
 * The asset is created immediately (usable as a correctly-sized box) and the
 * GLB is attached when generation finishes (see GenerationStatus).
 */
export function FurnitureGenerator({ projectId, onCreated }: Props) {
  const unitSystem = usePrefs((s) => s.unitSystem);
  const def = DEFAULTS[unitSystem];
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [w, setW] = useState(def.w);
  const [d, setD] = useState(def.d);
  const [h, setH] = useState(def.h);
  const [price, setPrice] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  function reset() {
    setFile(null);
    setName("");
    setW(def.w);
    setD(def.d);
    setH(def.h);
    setPrice("0");
    setErr(undefined);
  }

  async function generate() {
    if (!file || !name.trim()) return;
    setBusy(true);
    setErr(undefined);

    const realDims = {
      width: smallToMeters(+w, unitSystem),
      depth: smallToMeters(+d, unitSystem),
      height: smallToMeters(+h, unitSystem),
    };
    const sourceImageAssetId = await repo.putAsset(file);
    const asset = await repo.createFurniture({
      projectId,
      name: name.trim(),
      sourceImageAssetId,
      realDims,
      price: +price || 0,
    });
    const job = await repo.createJob("meshy");
    await repo.updateFurniture(asset.id, { jobId: job.id });
    onCreated(); // show the new asset (as a box) immediately

    try {
      const imageUrl = await fileToDataUri(file);
      const res = await fetch("/api/meshy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Generation request failed");
      await repo.updateJob(job.id, { externalId: json.taskId, status: "processing" });
      onCreated();
      reset();
      setOpen(false);
    } catch (e) {
      await repo.updateJob(job.id, { status: "error", error: (e as Error).message });
      setErr((e as Error).message);
      onCreated();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="primary" onClick={() => setOpen(true)}>
        + Generate from photo
      </button>
    );
  }

  return (
    <div className="card col" style={{ gap: 10 }}>
      <strong style={{ fontSize: 14 }}>New furniture from photo</strong>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />
      <input placeholder="Name (e.g. Armchair)" value={name} onChange={(e) => setName(e.target.value)} />

      <div className="row" style={{ gap: 6 }}>
        <label className="muted" style={{ fontSize: 12, width: 70 }}>
          W×D×H {smallUnitLabel(unitSystem)}
        </label>
        <input style={{ width: 60 }} value={w} onChange={(e) => setW(e.target.value)} inputMode="numeric" />
        <input style={{ width: 60 }} value={d} onChange={(e) => setD(e.target.value)} inputMode="numeric" />
        <input style={{ width: 60 }} value={h} onChange={(e) => setH(e.target.value)} inputMode="numeric" />
      </div>

      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <label className="muted" style={{ fontSize: 12, width: 70 }}>
          Price
        </label>
        <span className="muted">$</span>
        <input style={{ width: 90 }} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
      </div>

      {err && (
        <span className="badge err" style={{ alignSelf: "flex-start" }}>
          {err}
        </span>
      )}

      <div className="row">
        <button className="primary" onClick={generate} disabled={busy || !file || !name.trim()}>
          {busy ? "Starting…" : "Generate"}
        </button>
        <button
          onClick={() => {
            reset();
            setOpen(false);
          }}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
