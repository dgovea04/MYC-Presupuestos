import Link from "next/link";
import { BarChart3, Bot, CreditCard, ScrollText, ShieldCheck, Users } from "lucide-react";

export const ADMIN_TABS = [
  { id: "analytics", label: "Analytics", description: "Adquisición y monetización", icon: BarChart3 },
  { id: "ai", label: "IA", description: "Consumo y proveedores", icon: Bot },
  { id: "users", label: "Usuarios", description: "Cuentas y acceso", icon: Users },
  { id: "billing", label: "Facturación", description: "Planes y pagos", icon: CreditCard },
  { id: "security", label: "Seguridad", description: "Protección y ciclo de vida", icon: ShieldCheck },
  { id: "audit", label: "Auditoría", description: "Registro administrativo", icon: ScrollText },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]["id"];

export function normalizeAdminTab(value?: string): AdminTab {
  return ADMIN_TABS.some((tab) => tab.id === value) ? (value as AdminTab) : "analytics";
}

export function AdminPageTabs({
  activeTab,
  marketingFrom,
  marketingTo,
}: {
  activeTab: AdminTab;
  marketingFrom?: string;
  marketingTo?: string;
}) {
  return (
    <nav aria-label="Secciones de administración" className="theme-surface-card overflow-x-auto rounded-2xl border p-1.5 shadow-sm">
      <div className="flex min-w-max gap-1">
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          const params = new URLSearchParams({ adminTab: tab.id });
          if (marketingFrom) params.set("marketingFrom", marketingFrom);
          if (marketingTo) params.set("marketingTo", marketingTo);

          return (
            <Link
              key={tab.id}
              href={`/admin?${params.toString()}`}
              scroll={false}
              aria-current={isActive ? "page" : undefined}
              className={`group flex min-w-[9.5rem] items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                isActive
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-[var(--app-text-muted)] hover:bg-[var(--app-muted-surface)] hover:text-[var(--app-text-strong)]"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : "text-sky-600"}`} aria-hidden="true" />
              <span>
                <span className="block text-sm font-semibold">{tab.label}</span>
                <span className={`block text-[11px] ${isActive ? "text-sky-100" : "text-[var(--app-text-subtle)]"}`}>{tab.description}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
