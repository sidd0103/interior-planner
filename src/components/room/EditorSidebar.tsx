"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePrefs } from "@/lib/scene/prefs";
import { SidebarSection } from "./SidebarSection";
import { KebabMenu } from "@/components/ui/Menu";
import { ChevronRight, PanelLeft, RoomIcon, SofaIcon } from "@/components/ui/icons";

interface Props {
  roomName: string;
  backHref: string;
  roomContent: ReactNode;
  furnitureContent: ReactNode;
  /** A furniture item is selected — surface (and auto-expand to) its properties. */
  hasSelection: boolean;
  /** Delete this room (kebab next to the name). */
  onDeleteRoom: () => void;
}

/**
 * The single Figma-style editor sidebar: a Room section over a Furniture
 * section, collapsible to a 48px icon rail. Minimized state is persisted; a
 * 3D selection temporarily pops the panel open to show the item's properties.
 */
export function EditorSidebar({
  roomName,
  backHref,
  roomContent,
  furnitureContent,
  hasSelection,
  onDeleteRoom,
}: Props) {
  const collapsed = usePrefs((s) => s.sidebarCollapsed);
  const setCollapsed = usePrefs((s) => s.setSidebarCollapsed);
  const [roomOpen, setRoomOpen] = useState(true);
  const [furnitureOpen, setFurnitureOpen] = useState(true);

  // A selection pops the rail open and reveals the Furniture properties.
  const showRail = collapsed && !hasSelection;
  const furnitureExpanded = furnitureOpen || hasSelection;

  if (showRail) {
    return (
      <div
        className="sidebar-rail"
        style={{
          width: 48,
          flexShrink: 0,
          height: "100vh",
          background: "var(--panel)",
          borderRight: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 4,
          padding: "10px 0",
        }}
      >
        <button className="icon-btn" title="Expand panel" onClick={() => setCollapsed(false)}>
          <ChevronRight size={16} />
        </button>
        <div style={{ width: 22, height: 1, background: "var(--border)", margin: "4px 0" }} />
        <button
          className="icon-btn"
          title="Room"
          onClick={() => {
            setCollapsed(false);
            setRoomOpen(true);
          }}
        >
          <RoomIcon size={17} />
        </button>
        <button
          className="icon-btn"
          title="Furniture"
          onClick={() => {
            setCollapsed(false);
            setFurnitureOpen(true);
          }}
        >
          <SofaIcon size={17} />
        </button>
      </div>
    );
  }

  return (
    <aside className="sidebar" style={{ width: 304 }}>
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          padding: "10px 10px 10px 14px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <Link href={backHref} className="muted" style={{ fontSize: 12 }}>
            ← Project
          </Link>
          <div
            style={{
              fontWeight: 600,
              fontSize: 14,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {roomName}
          </div>
        </div>
        <div className="row" style={{ gap: 2 }}>
          <KebabMenu items={[{ label: "Delete room", danger: true, onClick: onDeleteRoom }]} />
          <button className="icon-btn" title="Collapse panel" onClick={() => setCollapsed(true)}>
            <PanelLeft size={16} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <SidebarSection
          title="Room"
          icon={<RoomIcon size={15} />}
          open={roomOpen}
          onToggle={() => setRoomOpen((o) => !o)}
        >
          {roomContent}
        </SidebarSection>
        <SidebarSection
          title="Furniture"
          icon={<SofaIcon size={15} />}
          open={furnitureExpanded}
          onToggle={() => setFurnitureOpen((o) => !o)}
        >
          {furnitureContent}
        </SidebarSection>
      </div>
    </aside>
  );
}
