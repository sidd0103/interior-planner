"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UnitSystem } from "@/lib/geometry/units";

interface PrefsState {
  /** Display + input unit system, shared across the editor and calibrator. */
  unitSystem: UnitSystem;
  setUnitSystem: (u: UnitSystem) => void;
  /** Editor sidebar minimized to the icon rail. */
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (c: boolean) => void;
}

/** App-wide display preferences, persisted to localStorage. */
export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      unitSystem: "imperial",
      setUnitSystem: (unitSystem) => set({ unitSystem }),
      sidebarCollapsed: false,
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: "ip-prefs" },
  ),
);

/**
 * True once mounted on the client. Guards unit-dependent text so server HTML
 * (which always uses the default unit) doesn't mismatch the persisted client
 * value during hydration.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
