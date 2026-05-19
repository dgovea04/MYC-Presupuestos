export const SIDEBAR_MODE_STORAGE_KEY = "myc:sidebar-mode" as const;
export const SIDEBAR_MODE_COOKIE_NAME = "myc_sidebar_mode" as const;
export const SIDEBAR_EXPANDED_WIDTH = 280;
export const SIDEBAR_MINI_WIDTH = 80;

export type SidebarMode = "expanded" | "mini";

export function isSidebarMode(value: string | null | undefined): value is SidebarMode {
  return value === "expanded" || value === "mini";
}

