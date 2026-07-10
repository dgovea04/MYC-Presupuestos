"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  FileSpreadsheet,
  FolderKanban,
  Import,
  PackageOpen,
  Sparkles,
  LayoutDashboard,
  Library,
  Network,
  Rows3,
  Ruler,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
  Wrench,
} from "lucide-react";
import { KhipuBadge } from "@/components/khipu/KhipuBadge";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import type { FeatureKey } from "@/lib/billing/entitlements";
import { SidebarBrand } from "@/components/layout/sidebar-brand";
import { SidebarNav, type SidebarNavItem, type SidebarNavLink } from "@/components/layout/sidebar-nav";
import { SidebarUserCard } from "@/components/layout/sidebar-user-card";
import {
  getSidebarWidthCssValue,
  isSidebarMode,
  SIDEBAR_MODE_COOKIE_NAME,
  SIDEBAR_MODE_STORAGE_KEY,
  SIDEBAR_WIDTH_CSS_VARIABLE,
  type SidebarMode,
} from "@/lib/layout/sidebar-mode";
import { cn } from "@/lib/utils";

type AppSidebarClientProps = {
  initialMode?: SidebarMode | null;
  userAvatarUrl?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: "ADMIN" | "USER" | null;
  unlockedFeatures?: FeatureKey[];
};

const NAV_ITEMS: SidebarNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  {
    id: "presupuestos",
    label: "Presupuestos",
    icon: FileSpreadsheet,
    children: [
      { href: "/budgets", label: "Presupuestos", icon: FileSpreadsheet },
      { href: "/metrados-avanzados", label: "Metrados", icon: Ruler },
    ],
  },
  {
    id: "importaciones",
    label: "Importaciones",
    icon: Import,
    children: [
      { href: "/imports/s10", label: "S10", icon: Import },
      { href: "/imports/rw7", label: "RW7", icon: FileSpreadsheet },
      { href: "/imports/delphin", label: "Delphin Express", icon: FileSpreadsheet },
      { href: "/imports/mcp", label: "MCP", icon: PackageOpen },
    ],
  },
  {
    href: "/ai",
    label: "Khipu",
    icon: function KhipuSidebarIcon({ className }: { className?: string }) {
      return (
        <span
          className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden", className)}
          style={{ width: 30, height: 30, borderRadius: 99, border: "2px solid" }}
        >
          <KhipuSymbol className="h-full w-full" />
        </span>
      );
    },
    badge: <KhipuBadge compact variant="dark" />,
    requiredFeature: "ai.local",
  },
  { href: "/dashboard/khipu-agent", label: "Khipu Agent", icon: Bot, requiredFeature: "khipu.agent" },
  {
    id: "catalogos",
    label: "Catalogos",
    icon: Library,
    children: [
      { href: "/resources", label: "Catalogo de Insumos", icon: Wrench },
      { href: "/partidas", label: "Catalogo de Partidas", icon: Rows3 },
      { href: "/partidas/generar", label: "Generador de partidas", icon: Sparkles, requiredFeature: "partidas.similarity" },
      { href: "/templates", label: "Plantillas", icon: BookOpen },
    ],
  },
  {
    id: "tablas",
    label: "Tablas",
    icon: Table2,
    children: [
      { href: "/unified-indices", label: "Indices Unificados (IU)", icon: Network },
      { href: "/unified-index-dictionary", label: "Diccionario de IU", icon: BookOpen },
    ],
  },
  { href: "/settings", label: "Configuracion", icon: SlidersHorizontal },
];

const ADMIN_NAV_LINK: SidebarNavLink = { href: "/admin", label: "Administracion", icon: ShieldCheck };

const FULL_WIDTH_QUERY = "(min-width: 1536px)";
const SIDEBAR_MODE_EVENT = "myc:sidebar-mode-change";
const SIDEBAR_NAV_ID = "app-sidebar-navigation";

function persistSidebarModeCookie(mode: SidebarMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${SIDEBAR_MODE_COOKIE_NAME}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

function syncSidebarWidthCssVariable(mode: SidebarMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.style.setProperty(
    SIDEBAR_WIDTH_CSS_VARIABLE,
    getSidebarWidthCssValue(mode),
  );
}

function getViewportMode(): SidebarMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "expanded";
  }

  return window.matchMedia(FULL_WIDTH_QUERY).matches ? "mini" : "expanded";
}

function getStoredSidebarMode(): SidebarMode | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedMode = window.localStorage.getItem(SIDEBAR_MODE_STORAGE_KEY);

  return isSidebarMode(storedMode) ? storedMode : null;
}

function getSidebarModeServerSnapshot(initialMode?: SidebarMode | null): SidebarMode {
  return initialMode ?? "expanded";
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

export function AppSidebarClient({ initialMode, unlockedFeatures, userAvatarUrl, userEmail, userName, userRole }: AppSidebarClientProps) {
  const pathname = usePathname() ?? "";
  const mode = useSyncExternalStore(
    subscribeToSidebarMode,
    () => getStoredSidebarMode() ?? initialMode ?? getViewportMode(),
    () => getSidebarModeServerSnapshot(initialMode),
  );
  const transitionsEnabled = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const isMini = mode === "mini";
  const initials = getInitials(userName, userEmail);
  const displayName = userName?.trim() || "Equipo tecnico";
  const displayEmail = userEmail?.trim() || "Sin correo";
  const items = userRole === "ADMIN" ? [...NAV_ITEMS, ADMIN_NAV_LINK] : NAV_ITEMS;

  useEffect(() => {
    if (!initialMode) {
      return;
    }

    if (getStoredSidebarMode() !== initialMode) {
      window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    persistSidebarModeCookie(mode);
    syncSidebarWidthCssVariable(mode);
  }, [mode]);

  const toggleSidebarMode = () => {
    const nextMode: SidebarMode = isMini ? "expanded" : "mini";
    window.localStorage.setItem(SIDEBAR_MODE_STORAGE_KEY, nextMode);
    persistSidebarModeCookie(nextMode);
    window.dispatchEvent(new Event(SIDEBAR_MODE_EVENT));
  };

  return (
    <aside
      className={cn(
        "flex min-h-full flex-col overflow-visible rounded-3xl border border-white/70 bg-slate-900 p-4 text-white shadow-xl shadow-slate-900/10 lg:h-[calc(100vh-2rem)] lg:min-h-[calc(100vh-2rem)]",
        transitionsEnabled ? "transition-[width,padding] duration-200" : "transition-none",
        isMini ? "items-center" : "",
      )}
      data-sidebar-mode={mode}
      style={{
        width: `var(${SIDEBAR_WIDTH_CSS_VARIABLE}, 280px)`,
        minWidth: `var(${SIDEBAR_WIDTH_CSS_VARIABLE}, 280px)`,
        maxWidth: `var(${SIDEBAR_WIDTH_CSS_VARIABLE}, 280px)`,
      }}
    >
      <SidebarBrand mode={mode} navigationId={SIDEBAR_NAV_ID} onToggle={toggleSidebarMode} />
      <SidebarNav items={items} mode={mode} navigationId={SIDEBAR_NAV_ID} pathname={pathname} unlockedFeatures={unlockedFeatures} />
      <SidebarUserCard mode={mode} user={{ avatarUrl: userAvatarUrl ?? null, email: displayEmail, initials, name: displayName }} />
    </aside>
  );
}
