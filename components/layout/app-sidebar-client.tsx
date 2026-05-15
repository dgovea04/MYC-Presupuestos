"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { FileSpreadsheet, FolderKanban, LayoutDashboard, Rows3, SlidersHorizontal, Wrench } from "lucide-react";
import { SidebarBrand } from "@/components/layout/sidebar-brand";
import { SidebarNav, type SidebarNavLink } from "@/components/layout/sidebar-nav";
import { SidebarUserCard } from "@/components/layout/sidebar-user-card";
import { cn } from "@/lib/utils";

type SidebarMode = "expanded" | "mini";

type AppSidebarClientProps = {
  userName?: string | null;
  userEmail?: string | null;
};

const NAV_LINKS: SidebarNavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/budgets", label: "Presupuestos", icon: FileSpreadsheet },
  { href: "/resources", label: "Catalogo de Insumos", icon: Wrench },
  { href: "/partidas", label: "Catalogo de Partidas", icon: Rows3 },
  { href: "/settings", label: "Configuracion", icon: SlidersHorizontal },
];

const FULL_WIDTH_QUERY = "(min-width: 1536px)";
const SIDEBAR_MODE_EVENT = "myc:sidebar-mode-change";
const SIDEBAR_MODE_STORAGE_KEY = "myc:sidebar-mode";
const SIDEBAR_NAV_ID = "app-sidebar-navigation";

function getViewportMode(): SidebarMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "expanded";
  }

  return window.matchMedia(FULL_WIDTH_QUERY).matches ? "mini" : "expanded";
}

function isSidebarMode(value: string | null): value is SidebarMode {
  return value === "expanded" || value === "mini";
}

function getStoredSidebarMode(): SidebarMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedMode = window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);

  return isSidebarMode(storedMode) ? storedMode : null;
}

function getSidebarModeSnapshot(): SidebarMode {
  return getStoredSidebarMode() ?? getViewportMode();
}

function getSidebarModeServerSnapshot(): SidebarMode {
  return "expanded";
}

function subscribeToSidebarMode(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQueryList = window.matchMedia(FULL_WIDTH_QUERY);
  const handleViewportChange = () => {
    if (!getStoredSidebarMode()) {
      onStoreChange();
    }
  };
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === SIDEBAR_MODE_STORAGE_KEY) {
      onStoreChange();
    }
  };
  const handleModePreferenceChange = () => {
    onStoreChange();
  };

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", handleViewportChange);
  } else {
    mediaQueryList.addListener(handleViewportChange);
  }

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(SIDEBAR_MODE_EVENT, handleModePreferenceChange);

  return () => {
    if (typeof mediaQueryList.removeEventListener === "function") {
      mediaQueryList.removeEventListener("change", handleViewportChange);
    } else {
      mediaQueryList.removeListener(handleViewportChange);
    }

    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(SIDEBAR_MODE_EVENT, handleModePreferenceChange);
  };
}

function getInitials(userName?: string | null, userEmail?: string | null) {
  const source = userName?.trim() || userEmail?.trim() || "MYC";
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

export function AppSidebarClient({ userEmail, userName }: AppSidebarClientProps) {
  const pathname = usePathname() ?? "";
  const mode = useSyncExternalStore(subscribeToSidebarMode, getSidebarModeSnapshot, getSidebarModeServerSnapshot);
  const isMini = mode === "mini";
  const initials = getInitials(userName, userEmail);
  const displayName = userName?.trim() || "Equipo tecnico";
  const displayEmail = userEmail?.trim() || "Sin correo";

  const toggleSidebarMode = () => {
    const nextMode: SidebarMode = isMini ? "expanded" : "mini";
    window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, nextMode);
    window.dispatchEvent(new Event(SIDEBAR_MODE_EVENT));
  };

  return (
    <aside
      className={cn(
        "flex min-h-full flex-col rounded-3xl border border-white/70 bg-slate-900 p-4 text-white shadow-xl shadow-slate-900/10 transition-[width,padding] duration-200",
        isMini ? "w-24 items-center" : "w-full max-w-[280px]",
      )}
      data-sidebar-mode={mode}
    >
      <SidebarBrand mode={mode} navigationId={SIDEBAR_NAV_ID} onToggle={toggleSidebarMode} />
      <SidebarNav links={NAV_LINKS} mode={mode} navigationId={SIDEBAR_NAV_ID} pathname={pathname} />
      <SidebarUserCard mode={mode} user={{ email: displayEmail, initials, name: displayName }} />
    </aside>
  );
}
