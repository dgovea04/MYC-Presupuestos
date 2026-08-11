import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  ensureUserHasCompany: vi.fn(),
  getUserAccount: vi.fn(),
  getUserCompanies: vi.fn(),
  getWorkCalendars: vi.fn(),
  getUserSettings: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  getEffectiveWorkspaceLicense: vi.fn(),
  hasFeatureAccess: vi.fn(),
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => mocks.AppShell(props),
}));

vi.mock("@/components/settings/settings-page-content", () => ({
  SettingsPageContent: () => <div data-testid="settings-page-content" />,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/auth/registration", () => ({
  ensureUserHasCompany: mocks.ensureUserHasCompany,
}));

vi.mock("@/lib/data/account", () => ({
  getUserAccount: mocks.getUserAccount,
}));

vi.mock("@/lib/data/projects", () => ({
  getUserCompanies: mocks.getUserCompanies,
}));

vi.mock("@/lib/data/work-calendars", () => ({
  getWorkCalendars: mocks.getWorkCalendars,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  getEffectiveWorkspaceLicense: mocks.getEffectiveWorkspaceLicense,
  hasFeatureAccess: mocks.hasFeatureAccess,
}));

import SettingsPage from "@/app/settings/page";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({
      user: {
        id: "user-google",
        email: "google@example.com",
        name: "Google User",
      },
    });
    mocks.getActiveWorkspaceId.mockResolvedValue("company-1");
    mocks.ensureUserHasCompany.mockResolvedValue("company-repaired");
    mocks.getUserCompanies.mockResolvedValue([{ id: "company-1", name: "Empresa", ruc: null, logoUrl: null }]);
    mocks.getUserSettings.mockResolvedValue({ defaultCurrency: "PEN", currencyDecimals: 2 });
    mocks.getUserAccount.mockResolvedValue({ id: "user-google", name: "Google User", email: "google@example.com" });
    mocks.getWorkCalendars.mockResolvedValue([]);
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue({ availableFeatures: [] });
    mocks.hasFeatureAccess.mockReturnValue(false);
  });

  it("renders settings content", async () => {
    const tree = await SettingsPage();
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"settings-page-content\"");
  });

  it("repairs a missing workspace before loading settings data", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue(null);

    await SettingsPage();

    expect(mocks.ensureUserHasCompany).toHaveBeenCalledWith("user-google", {
      name: "Google User",
      email: "google@example.com",
    });
    expect(mocks.getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
      userId: "user-google",
      companyId: "company-repaired",
    });
  });
});
