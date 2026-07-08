import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getUserAccount: vi.fn(),
  getUserAccountMembership: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  getUserSettings: vi.fn(),
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/components/account/account-page-content", () => ({
  AccountPageContent: () => <div data-testid="account-page-content" />,
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => mocks.AppShell(props),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/account", () => ({
  getUserAccount: mocks.getUserAccount,
  getUserAccountMembership: mocks.getUserAccountMembership,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

import AccountPage from "@/app/account/page";

describe("AccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const session = {
      user: {
        id: "user-1",
        email: "test@test.com",
        name: "Test User",
        role: "USER" as const,
      },
    };

    mocks.getAuthSession.mockResolvedValue(session);
    mocks.getActiveWorkspaceId.mockResolvedValue("ws-1");
    mocks.getUserAccount.mockResolvedValue({
      id: "user-1",
      name: "Test User",
      email: "test@test.com",
      avatarUrl: null,
      phone: "",
      jobTitle: "",
      bio: "",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    mocks.getUserAccountMembership.mockResolvedValue({
      planName: "Pro",
      planSlug: "pro",
      effectivePlanSlug: "pro",
      billingProvider: null,
      billingStatus: null,
      currentPeriodEnd: null,
      graceEndsAt: null,
      canManageBilling: false,
      canUpgrade: false,
      monthlyTokenLimit: 0,
      extraTokens: 0,
      consumedTokens: 0,
      reservedTokens: 0,
      allowance: 0,
      availableTokens: 0,
    });
    mocks.getUserSettings.mockResolvedValue({
      currencyDecimals: 2,
      defaultCurrency: "PEN",
    });
  });

  it("redirects to login when no session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    await expect(AccountPage()).rejects.toThrow("NEXT_REDIRECT");
  });

  it("renders AccountPageContent with membership data", async () => {
    const tree = await AccountPage();
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"account-page-content\"");
  });

  it("passes activeWorkspaceId to getUserAccountMembership", async () => {
    await AccountPage();

    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith("user-1");
    expect(mocks.getUserAccountMembership).toHaveBeenCalledWith("user-1", "ws-1");
  });

  it("passes null when no active workspace", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue(null);

    await AccountPage();

    expect(mocks.getUserAccountMembership).toHaveBeenCalledWith("user-1", null);
  });
});
