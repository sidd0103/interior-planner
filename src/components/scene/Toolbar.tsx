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

/** A small keycap shown inline on a button to advertise its shortcut. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="kbd" style={{ marginLeft: 4 }}>
      {children}
    </kbd>
  );
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
        zIndex: 10, // above the WebGL canvas, which otherwise paints over it
        padding: 5,
        background: "rgba(17,17,19,0.82)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        boxShadow: "var(--shadow-lg)",
        backdropFilter: "blur(10px)",
        gap: 4,
      }}
    >
      {MODES.map((m) => (
        <button
          key={m.key}
          onClick={() => setMode(m.key)}
          className={`btn-sm ${mode === m.key ? "primary" : "ghost"}`}
          title={`${m.label} (${m.shortcut})`}
        >
          {m.label}
          <Kbd>{m.shortcut}</Kbd>
        </button>
      ))}
      <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 2px" }} />
      <button className="btn-sm ghost" onClick={() => select(null)} disabled={!selectedId} title="Deselect (Esc)">
        Deselect
        <Kbd>Esc</Kbd>
      </button>
      {onDelete && (
        <button className="btn-sm danger" onClick={onDelete} disabled={!selectedId} title="Remove from room (Del)">
          Remove
          <Kbd>Del</Kbd>
        </button>
      )}
    </div>
  );
}
