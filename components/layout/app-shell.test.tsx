import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
  })),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: vi.fn(),
}));

vi.mock("@/components/layout/app-sidebar-client", () => ({
  SIDEBAR_EXPANDED_WIDTH: 280,
  SIDEBAR_MINI_WIDTH: 80,
  SIDEBAR_MODE_COOKIE_NAME: "myc_sidebar_mode",
  AppSidebarClient: ({
    userAvatarUrl,
    userEmail,
    userName,
  }: {
    userAvatarUrl?: string | null;
    userEmail?: string | null;
    userName?: string | null;
  }) => (
    <div
      data-avatar={userAvatarUrl ?? ""}
      data-email={userEmail ?? ""}
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

vi.mock("@/components/view-mode/app-view-mode-provider", () => ({
  AppViewModeProvider: ({ children }: { children: React.ReactNode; initialViewMode?: string | null }) => <>{children}</>,
}));

vi.mock("@/components/layout/app-back-button", () => ({
  AppBackButton: () => <div>Back</div>,
}));

vi.mock("@/components/budget/view-mode-toggle", () => ({
  ViewModeToggle: () => <div>Toggle</div>,
}));

import { getAuthSession } from "@/lib/auth/session";
import { getUserSettings } from "@/lib/data/settings";
import { AppShell } from "@/components/layout/app-shell";

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
      defaultViewMode: "modern",
      excelShowFieldBorders: true,
      excelRowHeight: 52,
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
      defaultSubBudgetNames: ["Estructuras"],
    });

    const markup = renderToStaticMarkup(
      await AppShell({
        children: <div>Contenido</div>,
      }),
    );

    expect(markup).toContain('data-avatar="/uploads/avatars/user-1.webp"');
    expect(markup).toContain('data-name="Maria Actualizada"');
    expect(markup).toContain('data-email="maria@example.com"');
  });

  it("skips fetching the session when currentUser and settings are provided", async () => {
    vi.mocked(getAuthSession).mockReset();
    vi.mocked(getUserSettings).mockReset();

    const markup = renderToStaticMarkup(
      await AppShell({
        children: <div>Contenido</div>,
        currentUser: {
          avatarUrl: "/uploads/avatars/user-2.webp",
          email: "ana@example.com",
          name: "Ana",
        },
        settings: {
          defaultCurrency: "PEN",
          currencyDecimals: 2,
          dateFormat: "DD_MMM_YYYY",
          defaultViewMode: "modern",
          excelShowFieldBorders: true,
          excelRowHeight: 52,
          defaultIgvRate: 0.18,
          defaultGeneralExpensesRate: 0.1,
          defaultUtilityRate: 0.08,
          defaultSubBudgetNames: ["Arquitectura"],
        },
      }),
    );

    expect(markup).toContain('data-avatar="/uploads/avatars/user-2.webp"');
    expect(markup).toContain('data-name="Ana"');
    expect(markup).toContain('data-email="ana@example.com"');
    expect(getAuthSession).not.toHaveBeenCalled();
    expect(getUserSettings).not.toHaveBeenCalled();
  });
});
