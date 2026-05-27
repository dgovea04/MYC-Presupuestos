import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Plus } from "lucide-react";
import { getAuthSession } from "@/lib/auth/session";
import { APP_VIEW_MODE_COOKIE_NAME, coerceViewMode } from "@/lib/budget/view-mode";
import { getUserSettings } from "@/lib/data/settings";
import { AppBackButton } from "@/components/layout/app-back-button";
import { AppSidebarClient } from "@/components/layout/app-sidebar-client";
import {
  getSidebarWidthCssValue,
  isSidebarMode,
  SIDEBAR_MODE_COOKIE_NAME,
  SIDEBAR_WIDTH_CSS_VARIABLE,
} from "@/lib/layout/sidebar-mode";
import { LiveDataRefresh } from "@/components/layout/live-data-refresh";
import { NotesDrawer } from "@/components/notes/notes-drawer";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import { ViewModeToggle } from "@/components/budget/view-mode-toggle";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_DATE_FORMAT,
  DEFAULT_EXCEL_ROW_HEIGHT,
  DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
  DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  DEFAULT_VIEW_MODE,
  type UserSettingsRecord,
} from "@/types/settings";

export async function AppShell({
  children,
  currentUser,
  settings: initialSettings,
}: {
  children: ReactNode;
  currentUser?: {
    avatarUrl?: string | null;
    email?: string | null;
    name?: string | null;
    role?: "ADMIN" | "USER" | null;
  };
  settings?: UserSettingsRecord;
}) {
  const session = currentUser && initialSettings ? null : await getAuthSession();
  const fallbackSettings: UserSettingsRecord = {
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    dateFormat: DEFAULT_DATE_FORMAT,
    defaultViewMode: DEFAULT_VIEW_MODE,
    excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
    excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
    defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
  };
  const settings = initialSettings ?? (session?.user?.id ? await getUserSettings(session.user.id) : fallbackSettings);
  const cookieStore = await cookies();
  const initialViewMode = coerceViewMode(cookieStore.get(APP_VIEW_MODE_COOKIE_NAME)?.value);
  const initialSidebarMode = (() => {
    const rawValue = cookieStore.get(SIDEBAR_MODE_COOKIE_NAME)?.value;
    return isSidebarMode(rawValue) ? rawValue : null;
  })();
  const initialSidebarWidth = getSidebarWidthCssValue(initialSidebarMode ?? "expanded");

  return (
    <FormattingSettingsProvider settings={settings}>
      <AppViewModeProvider initialViewMode={initialViewMode}>
        <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4f8_40%,#f8fafc_100%)]">
          <div className="grid min-h-screen grid-cols-1 gap-5 px-3 py-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start lg:px-4 xl:px-5">
            <div
              className="z-[31] shrink-0 lg:sticky lg:top-4"
              style={{ width: `var(${SIDEBAR_WIDTH_CSS_VARIABLE}, ${initialSidebarWidth})` }}
            >
              <AppSidebarClient
                initialMode={initialSidebarMode}
                userAvatarUrl={currentUser?.avatarUrl ?? session?.user?.avatarUrl}
                userEmail={currentUser?.email ?? session?.user?.email}
                userName={currentUser?.name ?? session?.user?.name}
                userRole={currentUser?.role ?? session?.user?.role}
              />
            </div>

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

                <div className="flex flex-col items-stretch gap-3 md:items-end">
                  <div className="flex flex-col gap-1 md:items-end">
                    <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-500">Vista global</p>
                    <ViewModeToggle />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center md:justify-end">
                    <NotesDrawer />
                    <Link href="/projects/new">
                      <Button className="w-full gap-2 shadow-sm shadow-sky-950/10 sm:w-auto">
                        <Plus className="h-4 w-4" />
                        Nuevo proyecto
                      </Button>
                    </Link>
                  </div>
                </div>
              </header>

              {children}
            </main>
          </div>
        </div>
      </AppViewModeProvider>
    </FormattingSettingsProvider>
  );
}
