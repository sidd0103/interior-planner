import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Minimal inline icon set (Geist-ish, 16px, currentColor). No icon dependency. */
function Icon({ children, size = 16, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const ChevronLeft = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);
export const ChevronRight = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 18l6-6-6-6" />
  </Icon>
);
export const ChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);
/** Sidebar/panel-collapse glyph. */
export const PanelLeft = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Icon>
);
/** Room / scene. */
export const RoomIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 10.2L12 4l9 6.2" />
    <path d="M5 9.5V20h14V9.5" />
    <path d="M9 20v-6h6v6" />
  </Icon>
);
/** Furniture / sofa. */
export const SofaIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
    <path d="M2 13a2 2 0 0 1 2 2v3h16v-3a2 2 0 0 1 2-2 2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z" />
    <path d="M6 18v2M18 18v2" />
  </Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" />
  </Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Icon>
);
