import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => undefined,
  })),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: vi.fn(),
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  getEffectiveWorkspaceLicense: vi.fn(),
}));

vi.mock("@/components/layout/app-sidebar-client", () => ({
  SIDEBAR_EXPANDED_WIDTH: 280,
  SIDEBAR_MINI_WIDTH: 80,
  SIDEBAR_MODE_COOKIE_NAME: "myc_sidebar_mode",
  AppSidebarClient: ({
    initialMode,
    unlockedFeatures,
    userAvatarUrl,
    userEmail,
    userName,
  }: {
    initialMode?: "expanded" | "mini" | null;
    unlockedFeatures?: string[];
    userAvatarUrl?: string | null;
    userEmail?: string | null;
    userName?: string | null;
  }) => (
    <div
      data-avatar={userAvatarUrl ?? ""}
      data-email={userEmail ?? ""}
      data-features={unlockedFeatures?.join(",") ?? ""}
      data-initial-mode={initialMode ?? ""}
      data-name={userName ?? ""}
      data-testid="sidebar-user"
    />
  ),
}));

vi.mock("@/components/layout/live-data-refresh", () => ({
  LiveDataRefresh: () => null,
}));

vi.mock("@/components/providers/formatting-settings-provider", () => ({
  FormattingSettingsProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/layout/app-theme-provider", () => ({
  AppThemeProvider: ({ children, initialTheme }: { children: React.ReactNode; initialTheme: string }) => (
    <div data-theme={initialTheme} className="theme-app">
      {children}
    </div>
  ),
}));

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  AppViewModeProvider: ({ children }: { children: React.ReactNode; initialViewMode?: string | null }) => <>{children}</>,
}));

vi.mock("@/components/layout/app-back-button", () => ({
  AppBackButton: () => <div>Back</div>,
}));

vi.mock("@/components/budget/view-mode-toggle", () => ({
  ViewModeToggle: () => <div>Toggle</div>,
}));

vi.mock("@/components/layout/app-theme-toggle", () => ({
  AppThemeToggle: () => <button>Tema</button>,
}));

vi.mock("@/components/notes/notes-drawer", () => ({
  NotesDrawer: () => <button>Notas</button>,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: vi.fn(),
  listUserWorkspaces: vi.fn(),
}));

vi.mock("@/components/layout/workspace-switcher", () => ({
  WorkspaceSwitcher: ({
    activeWorkspaceId,
    workspaces,
  }: {
    activeWorkspaceId: string;
    workspaces: Array<{ id: string; name: string }>;
  }) => (
    <div
      data-testid="workspace-switcher"
      data-active-id={activeWorkspaceId}
      data-workspace-count={workspaces.length}
      data-workspace-names={workspaces.map((w) => w.name).join(",")}
    />
  ),
}));

import { getAuthSession } from "@/lib/auth/session";
import { getEffectiveWorkspaceLicense } from "@/lib/workspace/entitlements";
import { getUserSettings } from "@/lib/data/settings";
import { getActiveWorkspaceId, listUserWorkspaces } from "@/lib/workspace/active-workspace";
import { AppShell } from "@/components/layout/app-shell";
import { cookies } from "next/headers";

describe("AppShell", () => {
  it("uses the hydrated session user fields for the sidebar when currentUser is not passed", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({
      user: {
        id: "user-1",
        name: "Maria Actualizada",
        email: "maria@example.com",
        avatarUrl: "/uploads/avatars/user-1.webp",
      },
    });
    vi.mocked(getUserSettings).mockResolvedValue({
      defaultCurrency: "PEN",
      currencyDecimals: 2,
      dateFormat: "DD_MMM_YYYY",
      appTheme: "light",
      defaultViewMode: "modern",
      excelShowFieldBorders: true,
      excelRowHeight: 52,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: ["Estructuras"],
      aiProviderPreference: "auto",
      floatingKhipuProvider: "ollama",
      floatingKhipuWidth: 600,
      floatingKhipuHeight: 500,
      floatingKhipuFontSize: "normal",
      floatingKhipuPosition: "bottom-right",
      floatingKhipuTheme: "light",
    });
    vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue({
      availableFeatures: ["exports.basic"],
      planSlug: "starter",
      planName: "Starter",
      role: "OWNER",
    });
    vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-1");
    vi.mocked(listUserWorkspaces).mockResolvedValue([]);

    const markup = renderToStaticMarkup(
      await AppShell({
        children: <div>Contenido</div>,
      }),
    );

    expect(markup).toContain('data-avatar="/uploads/avatars/user-1.webp"');
    expect(markup).toContain('data-name="Maria Actualizada"');
    expect(markup).toContain('data-email="maria@example.com"');
    expect(markup).toContain('data-features="exports.basic"');
    expect(markup).toContain("Notas");
  });

  it("skips fetching the session when currentUser and settings are provided", async () => {
    vi.mocked(getAuthSession).mockReset();
    vi.mocked(getUserSettings).mockReset();
    vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue({
      availableFeatures: ["exports.basic", "ai.local", "partidas.similarity"],
      planSlug: "empresa",
      planName: "Empresa",
      role: "OWNER",
    });
    vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-2");
    vi.mocked(listUserWorkspaces).mockResolvedValue([]);

    const markup = renderToStaticMarkup(
      await AppShell({
        children: <div>Contenido</div>,
        currentUser: {
          id: "user-2",
          avatarUrl: "/uploads/avatars/user-2.webp",
          email: "ana@example.com",
          name: "Ana",
        },
        settings: {
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          appTheme: "light",
          defaultViewMode: "modern",
          excelShowFieldBorders: true,
          excelRowHeight: 52,
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Arquitectura"],
          aiProviderPreference: "auto",
          floatingKhipuProvider: "ollama",
          floatingKhipuWidth: 600,
          floatingKhipuHeight: 500,
          floatingKhipuFontSize: "normal",
          floatingKhipuPosition: "bottom-right",
          floatingKhipuTheme: "light",
        },
      }),
    );

    expect(markup).toContain('data-avatar="/uploads/avatars/user-2.webp"');
    expect(markup).toContain('data-name="Ana"');
    expect(markup).toContain('data-email="ana@example.com"');
    expect(markup).toContain('data-features="exports.basic,ai.local,partidas.similarity"');
    expect(getAuthSession).not.toHaveBeenCalled();
    expect(getUserSettings).not.toHaveBeenCalled();
    expect(getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
      userId: "user-2",
      companyId: "company-2",
    });
  });

  it("applies data-theme dark to the authenticated app shell when appTheme is dark", async () => {
    vi.mocked(getAuthSession).mockReset();
    vi.mocked(getUserSettings).mockReset();
    vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue({
      availableFeatures: ["exports.basic"],
      planSlug: "pro",
      planName: "Pro",
      role: "OWNER",
    });
    vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-3");
    vi.mocked(listUserWorkspaces).mockResolvedValue([]);

    const markup = renderToStaticMarkup(
      await AppShell({
        children: <div>Contenido</div>,
        currentUser: {
          id: "user-3",
          avatarUrl: "/uploads/avatars/user-3.webp",
          email: "dark@example.com",
          name: "Tema Dark",
        },
        settings: {
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          appTheme: "dark",
          defaultViewMode: "modern",
          excelShowFieldBorders: true,
          excelRowHeight: 52,
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Arquitectura"],
          aiProviderPreference: "auto",
          floatingKhipuProvider: "ollama",
          floatingKhipuWidth: 600,
          floatingKhipuHeight: 500,
          floatingKhipuFontSize: "normal",
          floatingKhipuPosition: "bottom-right",
          floatingKhipuTheme: "light",
        },
      }),
    );

    expect(markup).toContain('data-theme="dark"');
    expect(markup).toContain("theme-app");
  });

  it("prefers the stored app view mode cookie over the settings default", async () => {
    vi.mocked(getAuthSession).mockReset();
    vi.mocked(getUserSettings).mockReset();
    vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue(null);
    vi.mocked(getActiveWorkspaceId).mockResolvedValue(null);
    vi.mocked(listUserWorkspaces).mockResolvedValue([]);
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => (name === "app_view_mode" ? { name, value: "excel" } : undefined),
    } as Awaited<ReturnType<typeof cookies>>);

    const markup = renderToStaticMarkup(
      await AppShell({
        children: <div>Contenido</div>,
        currentUser: {
          id: "user-4",
          avatarUrl: "/uploads/avatars/user-4.webp",
          email: "excel@example.com",
          name: "Modo Excel",
        },
        settings: {
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          appTheme: "light",
          defaultViewMode: "modern",
          excelShowFieldBorders: true,
          excelRowHeight: 52,
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Arquitectura"],
          aiProviderPreference: "auto",
          floatingKhipuProvider: "ollama",
          floatingKhipuWidth: 600,
          floatingKhipuHeight: 500,
          floatingKhipuFontSize: "normal",
          floatingKhipuPosition: "bottom-right",
          floatingKhipuTheme: "light",
        },
      }),
    );

    expect(markup).toContain("Contenido");
    expect(cookies).toHaveBeenCalled();
  });

  it("passes the stored sidebar mode cookie to the client sidebar to avoid refresh jumps", async () => {
    vi.mocked(getAuthSession).mockReset();
    vi.mocked(getUserSettings).mockReset();
    vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue(null);
    vi.mocked(getActiveWorkspaceId).mockResolvedValue(null);
    vi.mocked(listUserWorkspaces).mockResolvedValue([]);
    vi.mocked(cookies).mockResolvedValue({
      get: (name: string) => {
        if (name === "myc_sidebar_mode") {
          return { name, value: "mini" };
        }

        return undefined;
      },
    } as Awaited<ReturnType<typeof cookies>>);

    const markup = renderToStaticMarkup(
      await AppShell({
        children: <div>Contenido</div>,
        currentUser: {
          id: "user-5",
          avatarUrl: "/uploads/avatars/user-5.webp",
          email: "mini@example.com",
          name: "Modo Mini",
        },
        settings: {
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          appTheme: "light",
          defaultViewMode: "modern",
          excelShowFieldBorders: true,
          excelRowHeight: 52,
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Arquitectura"],
          aiProviderPreference: "auto",
          floatingKhipuProvider: "ollama",
          floatingKhipuWidth: 600,
          floatingKhipuHeight: 500,
          floatingKhipuFontSize: "normal",
          floatingKhipuPosition: "bottom-right",
          floatingKhipuTheme: "light",
        },
      }),
    );

    expect(markup).toContain('data-initial-mode="mini"');
  });

  describe("currentUser.id license resolution", () => {
    const mockSettings = {
      defaultCurrency: "PEN" as const,
      currencyDecimals: 2,
      dateFormat: "DD_MMM_YYYY" as const,
      appTheme: "light" as const,
      defaultViewMode: "modern" as const,
      excelShowFieldBorders: true,
      excelRowHeight: 52,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: ["Arquitectura"],
      aiProviderPreference: "auto" as const,
      floatingKhipuProvider: "ollama" as const,
      floatingKhipuWidth: 600,
      floatingKhipuHeight: 500,
      floatingKhipuFontSize: "normal" as const,
      floatingKhipuPosition: "bottom-right" as const,
      floatingKhipuTheme: "light" as const,
    };

    beforeEach(() => {
      vi.mocked(getAuthSession).mockReset();
      vi.mocked(getUserSettings).mockReset();
      vi.mocked(getEffectiveWorkspaceLicense).mockReset();
      vi.mocked(getActiveWorkspaceId).mockReset();
      vi.mocked(listUserWorkspaces).mockReset();
    });

    it("calls getEffectiveWorkspaceLicense when currentUser.id is present", async () => {
      vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue({
        availableFeatures: ["ai.local", "exports.basic"],
        planSlug: "empresa",
        planName: "Empresa",
        role: "OWNER",
      });
      vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-id-present");
      vi.mocked(listUserWorkspaces).mockResolvedValue([]);

      const markup = renderToStaticMarkup(
        await AppShell({
          children: <div>Contenido</div>,
          currentUser: {
            id: "user-with-id",
            email: "test@example.com",
            name: "Test User",
          },
          settings: mockSettings,
        }),
      );

      expect(getAuthSession).not.toHaveBeenCalled();
      expect(getUserSettings).not.toHaveBeenCalled();
      expect(getActiveWorkspaceId).toHaveBeenCalledWith("user-with-id");
      expect(getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
        userId: "user-with-id",
        companyId: "company-id-present",
      });
      expect(markup).toContain('data-features="ai.local,exports.basic"');
    });

    it("does NOT call getEffectiveWorkspaceLicense when currentUser is passed without id", async () => {
      vi.mocked(getActiveWorkspaceId).mockResolvedValue("some-company");
      vi.mocked(listUserWorkspaces).mockResolvedValue([]);

      const markup = renderToStaticMarkup(
        await AppShell({
          children: <div>Contenido</div>,
          currentUser: {
            email: "no-id@example.com",
            name: "No ID User",
          },
          settings: mockSettings,
        }),
      );

      expect(getAuthSession).not.toHaveBeenCalled();
      expect(getUserSettings).not.toHaveBeenCalled();
      expect(getActiveWorkspaceId).not.toHaveBeenCalled();
      expect(listUserWorkspaces).not.toHaveBeenCalled();
      expect(getEffectiveWorkspaceLicense).not.toHaveBeenCalled();
      // Sidebar receives no features when license is not fetched
      expect(markup).toContain('data-features=""');
    });
  });

  describe("workspace integration", () => {
    beforeEach(() => {
      vi.mocked(getAuthSession).mockReset();
      vi.mocked(getUserSettings).mockReset();
      vi.mocked(getEffectiveWorkspaceLicense).mockReset();
      vi.mocked(getActiveWorkspaceId).mockReset();
      vi.mocked(listUserWorkspaces).mockReset();
    });

    it("renders WorkspaceSwitcher when user has an active workspace", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({
        user: { id: "user-1", name: "User", email: "user@test.com" },
      });
      vi.mocked(getUserSettings).mockResolvedValue({
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: "DD_MMM_YYYY",
        appTheme: "light",
        defaultViewMode: "modern",
        excelShowFieldBorders: true,
        excelRowHeight: 52,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: ["Estructuras"],
        aiProviderPreference: "auto",
        floatingKhipuProvider: "ollama",
        floatingKhipuWidth: 600,
        floatingKhipuHeight: 500,
        floatingKhipuFontSize: "normal",
        floatingKhipuPosition: "bottom-right",
        floatingKhipuTheme: "light",
      });
      vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue({
        availableFeatures: [],
        planSlug: "pro",
        planName: "Pro",
        role: "OWNER",
      });
      vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-1");
      vi.mocked(listUserWorkspaces).mockResolvedValue([
        { id: "company-1", name: "MYC Ingenieria", role: "OWNER", logoUrl: null },
      ]);

      const markup = renderToStaticMarkup(
        await AppShell({
          children: <div>Contenido</div>,
        }),
      );

      expect(markup).toContain('data-testid="workspace-switcher"');
      expect(markup).toContain('data-active-id="company-1"');
      expect(markup).toContain('data-workspace-count="1"');
      expect(markup).toContain("Workspace");
    });

    it("does NOT render WorkspaceSwitcher when user has no active workspace", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({
        user: { id: "user-2", name: "User 2", email: "user2@test.com" },
      });
      vi.mocked(getUserSettings).mockResolvedValue({
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: "DD_MMM_YYYY",
        appTheme: "light",
        defaultViewMode: "modern",
        excelShowFieldBorders: true,
        excelRowHeight: 52,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: ["Estructuras"],
        aiProviderPreference: "auto",
        floatingKhipuProvider: "ollama",
        floatingKhipuWidth: 600,
        floatingKhipuHeight: 500,
        floatingKhipuFontSize: "normal",
        floatingKhipuPosition: "bottom-right",
        floatingKhipuTheme: "light",
      });
      vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue(null);
      vi.mocked(getActiveWorkspaceId).mockResolvedValue(null);
      vi.mocked(listUserWorkspaces).mockResolvedValue([]);

      const markup = renderToStaticMarkup(
        await AppShell({
          children: <div>Contenido</div>,
        }),
      );

      expect(markup).not.toContain('data-testid="workspace-switcher"');
      expect(markup).not.toContain("Workspace");
    });

    it("renders WorkspaceSwitcher with multiple workspaces", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({
        user: { id: "user-3", name: "User 3", email: "user3@test.com" },
      });
      vi.mocked(getUserSettings).mockResolvedValue({
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: "DD_MMM_YYYY",
        appTheme: "light",
        defaultViewMode: "modern",
        excelShowFieldBorders: true,
        excelRowHeight: 52,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: ["Estructuras"],
        aiProviderPreference: "auto",
        floatingKhipuProvider: "ollama",
        floatingKhipuWidth: 600,
        floatingKhipuHeight: 500,
        floatingKhipuFontSize: "normal",
        floatingKhipuPosition: "bottom-right",
        floatingKhipuTheme: "light",
      });
      vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue(null);
      vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-1");
      vi.mocked(listUserWorkspaces).mockResolvedValue([
        { id: "company-1", name: "MYC Ingenieria", role: "OWNER", logoUrl: null },
        { id: "company-2", name: "Constructora Demo", role: "EDITOR", logoUrl: null },
      ]);

      const markup = renderToStaticMarkup(
        await AppShell({
          children: <div>Contenido</div>,
        }),
      );

      expect(markup).toContain('data-testid="workspace-switcher"');
      expect(markup).toContain('data-active-id="company-1"');
      expect(markup).toContain('data-workspace-count="2"');
      expect(markup).toContain("MYC Ingenieria");
      expect(markup).toContain("Constructora Demo");
    });

    it("fetches workspace data and license for the authenticated user", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({
        user: { id: "user-workspace", name: "WS User", email: "ws@test.com" },
      });
      vi.mocked(getUserSettings).mockResolvedValue({
        defaultCurrency: "PEN",
        currencyDecimals: 2,
        dateFormat: "DD_MMM_YYYY",
        appTheme: "light",
        defaultViewMode: "modern",
        excelShowFieldBorders: true,
        excelRowHeight: 52,
        defaultIgvRate: 0.18,
        defaultGeneralExpensesRate: 0.1,
        defaultUtilityRate: 0.08,
        defaultSubBudgetNames: ["Estructuras"],
        aiProviderPreference: "auto",
        floatingKhipuProvider: "ollama",
        floatingKhipuWidth: 600,
        floatingKhipuHeight: 500,
        floatingKhipuFontSize: "normal",
        floatingKhipuPosition: "bottom-right",
        floatingKhipuTheme: "light",
      });
      vi.mocked(getEffectiveWorkspaceLicense).mockResolvedValue(null);
      vi.mocked(getActiveWorkspaceId).mockResolvedValue("company-ws");
      vi.mocked(listUserWorkspaces).mockResolvedValue([]);

      await AppShell({
        children: <div>Contenido</div>,
      });

      expect(getActiveWorkspaceId).toHaveBeenCalledWith("user-workspace");
      expect(listUserWorkspaces).toHaveBeenCalledWith("user-workspace");
      expect(getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
        userId: "user-workspace",
        companyId: "company-ws",
      });
    });
  });
});
