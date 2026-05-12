import type { ReactNode } from "react";
import Link from "next/link";
import { FileSpreadsheet, FolderKanban, LayoutDashboard, Rows3, SlidersHorizontal, Wrench } from "lucide-react";
import { getAuthSession } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/data/settings";
import { AppBackButton } from "@/components/layout/app-back-button";
import { LiveDataRefresh } from "@/components/layout/live-data-refresh";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { DEFAULT_DATE_FORMAT, DEFAULT_INITIAL_SUB_BUDGET_NAMES, type UserSettingsRecord } from "@/types/settings";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Proyectos", icon: FolderKanban },
  { href: "/budgets", label: "Presupuestos", icon: FileSpreadsheet },
  { href: "/resources", label: "Catalogo de Insumos", icon: Wrench },
  { href: "/partidas", label: "Catalogo de Partidas", icon: Rows3 },
  { href: "/settings", label: "Configuracion", icon: SlidersHorizontal },
];

export async function AppShell({
  children,
  settings: initialSettings,
}: {
  children: ReactNode;
  settings?: UserSettingsRecord;
}) {
  const session = await getAuthSession();
  const fallbackSettings: UserSettingsRecord = {
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    dateFormat: DEFAULT_DATE_FORMAT,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
    defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
  };
  const settings = initialSettings ?? (session?.user?.id ? await getUserSettings(session.user.id) : fallbackSettings);

  return (
    <FormattingSettingsProvider settings={settings}>
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4f8_40%,#f8fafc_100%)]">
        <div className="grid min-h-screen grid-cols-1 gap-5 px-3 py-4 lg:grid-cols-[250px_minmax(0,1fr)] lg:px-4 xl:px-5">
          <aside className="rounded-3xl border border-white/70 bg-slate-900 p-6 text-white shadow-xl shadow-slate-900/10">
            <div className="mb-8">
              <p className="text-xs uppercase tracking-[0.3em] text-sky-300">MYC Presupuestos</p>
              <h1 className="mt-3 text-2xl font-semibold">APU para obras en Peru</h1>
            </div>

            <nav className="space-y-2">
              {links.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-8 rounded-2xl bg-white/10 p-4 text-sm text-slate-200">
              <p className="font-medium">{session?.user?.name ?? "Equipo tecnico"}</p>
              <p className="mt-1 text-slate-300">{session?.user?.email}</p>
              <div className="mt-4">
                <SignOutButton />
              </div>
            </div>
          </aside>

          <main className="flex min-h-full min-w-0 flex-col gap-5">
            <LiveDataRefresh />
            <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 px-6 py-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2">
                <AppBackButton />
                <div>
                  <p className="text-sm text-slate-500">MVP inicial</p>
                  <h2 className="text-2xl font-semibold text-slate-900">Gestion de presupuestos de obra</h2>
                </div>
              </div>

              <Link href="/budgets/new">
                <Button>Nuevo presupuesto</Button>
              </Link>
            </header>

            {children}
          </main>
        </div>
      </div>
    </FormattingSettingsProvider>
  );
}
