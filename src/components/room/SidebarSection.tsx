"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "@/components/ui/icons";

interface Props {
  title: string;
  icon?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** Figma-style collapsible disclosure section for the editor sidebar. */
export function SidebarSection({ title, icon, open, onToggle, children }: Props) {
  return (
    <div className="section">
      <button className="section-head" onClick={onToggle} type="button">
        {icon && <span style={{ display: "inline-flex", color: "var(--muted)" }}>{icon}</span>}
        <span style={{ flex: 1, textAlign: "left" }}>{title}</span>
        <ChevronDown
          size={14}
          style={{
            color: "var(--muted)",
            transform: open ? "none" : "rotate(-90deg)",
            transition: "transform 0.15s",
          }}
        />
      </button>
      {open && <div className="section-body col">{children}</div>}
    </div>
  );
}
