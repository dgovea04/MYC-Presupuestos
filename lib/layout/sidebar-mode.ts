export const SIDEBAR_MODE_STORAGE_KEY = "myc:sidebar-mode" as const;
export const SIDEBAR_MODE_COOKIE_NAME = "myc_sidebar_mode" as const;
export const SIDEBAR_EXPANDED_WIDTH = 280;
export const SIDEBAR_MINI_WIDTH = 80;
export const SIDEBAR_WIDTH_CSS_VARIABLE = "--app-sidebar-initial-width" as const;

export type SidebarMode = "expanded" | "mini";

export function isSidebarMode(value: string | null | undefined): value is SidebarMode {
  return value === "expanded" || value === "mini";
}

export function getSidebarWidth(mode: SidebarMode): number {
  return mode === "mini" ? SIDEBAR_MINI_WIDTH : SIDEBAR_EXPANDED_WIDTH;
}

export function getSidebarWidthCssValue(mode: SidebarMode): `${number}px` {
  return `${getSidebarWidth(mode)}px`;
}
