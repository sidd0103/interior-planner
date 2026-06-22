"use client";

import { useEffect } from "react";
import { useEditor, type TransformMode } from "@/lib/scene/editorStore";

const MODES: { key: TransformMode; label: string; shortcut: string }[] = [
  { key: "translate", label: "Move", shortcut: "G" },
  { key: "rotate", label: "Rotate", shortcut: "R" },
];

interface Props {
  /** Called when the user deletes the current selection. */
  onDelete?: () => void;
}

/** Floating overlay toolbar for gizmo mode + selection actions. */
export function Toolbar({ onDelete }: Props) {
  const { mode, setMode, selectedId, select } = useEditor();

  // Keyboard shortcuts: G/R/S switch modes, Esc deselects, Delete removes.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "g" || e.key === "G") setMode("translate");
      else if (e.key === "r" || e.key === "R") setMode("rotate");
      else if (e.key === "Escape") select(null);
      else if ((e.key === "Delete" || e.key === "Backspace") && selectedId) onDelete?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMode, select, selectedId, onDelete]);

  return (
    <div
      className="row"
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        padding: 6,
        background: "rgba(23,26,33,0.9)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        backdropFilter: "blur(6px)",
        gap: 6,
      }}
    >
      {MODES.map((m) => (
        <button
          key={m.key}
          onClick={() => setMode(m.key)}
          className={mode === m.key ? "primary" : ""}
          title={`${m.label} (${m.shortcut})`}
          style={{ padding: "6px 12px" }}
        >
          {m.label}
        </button>
      ))}
      <div style={{ width: 1, height: 22, background: "var(--border)", margin: "0 2px" }} />
      <button onClick={() => select(null)} disabled={!selectedId} title="Deselect (Esc)">
        Deselect
      </button>
      {onDelete && (
        <button className="danger" onClick={onDelete} disabled={!selectedId} title="Delete (Del)">
          Delete
        </button>
      )}
    </div>
  );
}
