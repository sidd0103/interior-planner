"use client";

import { useState } from "react";
import { DotsVertical } from "./icons";

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/**
 * A three-dots (kebab) button that opens a small floating menu. Outside-clicks
 * close it via a transparent full-screen backdrop (no document listeners).
 */
export function KebabMenu({ items, align = "right" }: { items: MenuItem[]; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        className={`icon-btn ${open ? "active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title="More options"
        aria-label="More options"
      >
        <DotsVertical size={16} />
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
          />
          <div
            className="menu"
            style={{ position: "absolute", top: "calc(100% + 4px)", [align]: 0, zIndex: 41 }}
          >
            {items.map((it, i) => (
              <button
                key={i}
                className={`menu-item ${it.danger ? "danger" : ""}`}
                onClick={() => {
                  setOpen(false);
                  it.onClick();
                }}
              >
                {it.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
