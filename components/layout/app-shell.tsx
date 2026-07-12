import type { ReactNode } from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { Plus } from "lucide-react";
import { AiViewContextBridge } from "@/hooks/use-ai-view-context";
import { getAuthSession } from "@/lib/auth/session";
import { getEffectiveWorkspaceLicense } from "@/lib/workspace/entitlements";
import { APP_VIEW_MODE_COOKIE_NAME, coerceViewMode, type ViewMode } from "@/lib/budget/view-mode";
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
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { getActiveWorkspaceId, listUserWorkspaces } from "@/lib/workspace/active-workspace";
import { FormattingSettingsProvider } from "@/components/providers/formatting-settings-provider";
import { AppThemeProvider } from "@/components/layout/app-theme-provider";
import { AppThemeToggle } from "@/components/layout/app-theme-toggle";
import { AppViewModeProvider } from "@/components/view-mode/app-view-mode-provider";
import { ViewModeToggle } from "@/components/budget/view-mode-toggle";
import { Button } from "@/components/ui/button";
import { measureAsync } from "@/lib/platform/performance";
import {
  DEFAULT_APP_THEME,
  DEFAULT_DATE_FORMAT,
  DEFAULT_EXCEL_ROW_HEIGHT,
  DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
  DEFAULT_INITIAL_SUB_BUDGET_NAMES,
  DEFAULT_VIEW_MODE,
  FLOATING_KHIPU_DEFAULTS,
  type UserSettingsRecord,
} from "@/types/settings";
import type { AiContext } from "@/lib/ai/types";

export async function AppShell({
  aiContext,
  children,
  currentUser,
  settings: initialSettings,
}: {
  aiContext?: AiContext;
  children: ReactNode;
  currentUser?: {
    id?: string | null;
    activeCompanyId?: string | null;
    avatarUrl?: string | null;
    companyId?: string | null;
    email?: string | null;
    name?: string | null;
    workspaces?: { id: string; name: string; role: string; logoUrl: string | null }[] | null;
    role?: "ADMIN" | "USER" | null;
  };
  settings?: UserSettingsRecord;
}) {
  const session = currentUser ? null : await measureAsync("appShell.session", () => getAuthSession());
  const fallbackSettings: UserSettingsRecord = {
    defaultCurrency: "PEN",
    currencyDecimals: 2,
    dateFormat: DEFAULT_DATE_FORMAT,
    appTheme: DEFAULT_APP_THEME,
    defaultViewMode: DEFAULT_VIEW_MODE,
    excelShowFieldBorders: DEFAULT_EXCEL_SHOW_FIELD_BORDERS,
    excelRowHeight: DEFAULT_EXCEL_ROW_HEIGHT,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
    defaultSubBudgetNames: [...DEFAULT_INITIAL_SUB_BUDGET_NAMES],
    aiProviderPreference: "auto",
    floatingKhipuProvider: FLOATING_KHIPU_DEFAULTS.provider,
    floatingKhipuWidth: FLOATING_KHIPU_DEFAULTS.width,
    floatingKhipuHeight: FLOATING_KHIPU_DEFAULTS.height,
    floatingKhipuFontSize: FLOATING_KHIPU_DEFAULTS.fontSize,
    floatingKhipuPosition: FLOATING_KHIPU_DEFAULTS.position,
    floatingKhipuTheme: FLOATING_KHIPU_DEFAULTS.theme,
  };
  const userId = session?.user?.id ?? currentUser?.id;

  // Prefer session-provided workspace list from the JWT token to avoid refetches.
  // Always call getActiveWorkspaceId (cached per-request) for validated active workspace.
  const sessionWorkspaces = session?.user?.workspaces ?? currentUser?.workspaces ?? [];
  const hasSessionWorkspaces = sessionWorkspaces.length > 0;

  const activeWorkspaceId = currentUser?.activeCompanyId ?? currentUser?.companyId ?? (
    userId ? await measureAsync("appShell.activeWorkspace", () => getActiveWorkspaceId(userId), { userId }) : null
  );

  const [settings, workspaces, license] = await measureAsync("appShell.shellData", () => Promise.all([
    initialSettings
      ? Promise.resolve(initialSettings)
      : userId
        ? getUserSettings(userId)
        : Promise.resolve(fallbackSettings),
    hasSessionWorkspaces
      ? Promise.resolve(sessionWorkspaces as { id: string; name: string; role: string; logoUrl: string | null }[])
      : userId
        ? listUserWorkspaces(userId)
        : Promise.resolve([]),
    userId && activeWorkspaceId
      ? getEffectiveWorkspaceLicense({ userId, companyId: activeWorkspaceId })
      : Promise.resolve(null),
  ]), { userId, activeWorkspaceId: activeWorkspaceId ?? undefined });

  const cookieStore = await measureAsync("appShell.cookies", () => cookies());
  const storedViewModeCookie = cookieStore.get(APP_VIEW_MODE_COOKIE_NAME)?.value;
  const storedSidebarModeCookie = cookieStore.get(SIDEBAR_MODE_COOKIE_NAME)?.value;
  const initialViewMode: ViewMode =
    storedViewModeCookie === "excel" || storedViewModeCookie === "modern"
      ? coerceViewMode(storedViewModeCookie)
      : settings.defaultViewMode;
  const initialSidebarMode = isSidebarMode(storedSidebarModeCookie) ? storedSidebarModeCookie : null;
  const appTheme = settings.appTheme ?? DEFAULT_APP_THEME;
  const initialSidebarWidth = getSidebarWidthCssValue("expanded");

  return (
    <FormattingSettingsProvider settings={settings}>
      <AppViewModeProvider initialViewMode={initialViewMode}>
        <AppThemeProvider initialTheme={appTheme}>
          {aiContext ? <AiViewContextBridge value={aiContext} /> : null}
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
                unlockedFeatures={license?.availableFeatures}
              />
            </div>

            <main className="flex min-h-full min-w-0 flex-col gap-5">
              <LiveDataRefresh />
              <header className="z-10 flex flex-col gap-4 rounded-3xl border border-[var(--app-border-soft)] bg-[var(--app-surface)]/90 px-6 py-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
                <div className="flex flex-col gap-2">
                  <AppBackButton />
                  <div>
                    <p className="text-sm text-[var(--app-text-muted)]">Plataforma tecnica de costos</p>
                    <h2 className="text-2xl font-semibold text-[var(--app-text-strong)]">Gestion de presupuestos de obra</h2>
                  </div>
                </div>

                <div className="flex flex-col items-stretch gap-3 md:items-end">
                  <div className="flex flex-wrap items-end gap-3 md:justify-end">
                    {/* Workspace switcher */}
                    {activeWorkspaceId && workspaces.length > 0 ? (
                      <div className="flex flex-col gap-1 md:items-end">
                        <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--app-text-muted)]">Workspace</p>
                        <WorkspaceSwitcher
                          activeWorkspaceId={activeWorkspaceId}
                          workspaces={workspaces}
                        />
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-1 md:items-end">
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--app-text-muted)]">Tema</p>
                      <AppThemeToggle />
                    </div>
                    <div className="flex flex-col gap-1 md:items-end">
                      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--app-text-muted)]">Vista global</p>
                      <ViewModeToggle />
                    </div>
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
        </AppThemeProvider>
      </AppViewModeProvider>
    </FormattingSettingsProvider>
  );
}
