"use client";

import { create } from "zustand";

export type TransformMode = "translate" | "rotate";

interface EditorState {
  /** id of the currently selected PlacedFurniture, or null. */
  selectedId: string | null;
  /** Active gizmo mode. */
  mode: TransformMode;
  /** True while a transform gizmo is being dragged (used to gate OrbitControls / saves). */
  dragging: boolean;

  select: (id: string | null) => void;
  setMode: (mode: TransformMode) => void;
  setDragging: (d: boolean) => void;
}

export const useEditor = create<EditorState>((set) => ({
  selectedId: null,
  mode: "translate",
  dragging: false,
  select: (id) => set({ selectedId: id }),
  setMode: (mode) => set({ mode }),
  setDragging: (dragging) => set({ dragging }),
}));
