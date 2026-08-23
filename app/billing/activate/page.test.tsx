import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getUserSettings: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  companyFindUnique: vi.fn(),
  companySubscriptionFindFirst: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

vi.mock("@/components/billing/workspace-pro-activation", () => ({
  WorkspaceProActivation: ({
    workspaceId,
    workspaceName,
  }: {
    workspaceId: string;
    workspaceName: string;
  }) => (
    <div
      data-testid="workspace-pro-activation"
      data-workspace-id={workspaceId}
      data-workspace-name={workspaceName}
    />
  ),
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: { findUnique: mocks.companyFindUnique },
    companySubscription: { findFirst: mocks.companySubscriptionFindFirst },
  },
}));

import BillingActivatePage from "@/app/billing/activate/page";

describe("BillingActivatePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAuthSession.mockResolvedValue({
      user: {
        id: "user-1",
        email: "maria@example.com",
        name: "Maria Calderon",
        role: "USER" as const,
      },
    });
    mocks.getActiveWorkspaceId.mockResolvedValue("company-1");
    mocks.getUserSettings.mockResolvedValue({
      currencyDecimals: 2,
      defaultCurrency: "PEN",
    });
    mocks.companyFindUnique.mockResolvedValue({
      name: "Constructora Andina SAC",
    });
    mocks.companySubscriptionFindFirst.mockResolvedValue(null);
  });

  it("redirects to /login when there is no session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    await expect(
      BillingActivatePage({ searchParams: Promise.resolve({ plan: "pro" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when session has no user id", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: null });

    await expect(
      BillingActivatePage({ searchParams: Promise.resolve({ plan: "pro" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /dashboard when plan is not pro", async () => {
    await expect(
      BillingActivatePage({ searchParams: Promise.resolve({ plan: "starter" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects to /dashboard when plan param is missing", async () => {
    await expect(
      BillingActivatePage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects to /dashboard when no active workspace exists", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue(null);

    await expect(
      BillingActivatePage({ searchParams: Promise.resolve({ plan: "pro" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects to /dashboard when workspace already has an active Pro subscription", async () => {
    mocks.companySubscriptionFindFirst.mockResolvedValue({ id: "sub-active-1" });

    await expect(
      BillingActivatePage({ searchParams: Promise.resolve({ plan: "pro" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects to /dashboard when workspace has a trialing Pro subscription", async () => {
    mocks.companySubscriptionFindFirst.mockResolvedValue({ id: "sub-trialing-1" });

    await expect(
      BillingActivatePage({ searchParams: Promise.resolve({ plan: "pro" }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("renders WorkspaceProActivation for a Starter workspace without Pro subscription", async () => {
    const tree = await BillingActivatePage({
      searchParams: Promise.resolve({ plan: "pro" }),
    });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"workspace-pro-activation\"");
    expect(markup).toContain('data-workspace-id="company-1"');
    expect(markup).toContain('data-workspace-name="Constructora Andina SAC"');
  });

  it("falls back to a default workspace name when company has no name", async () => {
    mocks.companyFindUnique.mockResolvedValue({ name: null });

    const tree = await BillingActivatePage({
      searchParams: Promise.resolve({ plan: "pro" }),
    });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain('data-workspace-name="tu espacio de trabajo"');
  });

  it("queries only ACTIVE and TRIALING subscriptions when checking for Pro", async () => {
    await BillingActivatePage({
      searchParams: Promise.resolve({ plan: "pro" }),
    });

    expect(mocks.companySubscriptionFindFirst).toHaveBeenCalledWith({
      where: {
        companyId: "company-1",
        membershipPlan: { slug: "pro" },
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      select: { id: true },
    });
  });

  it("does not redirect when subscription is INCOMPLETE (Yape pending)", async () => {
    mocks.companySubscriptionFindFirst.mockResolvedValue(null);

    const tree = await BillingActivatePage({
      searchParams: Promise.resolve({ plan: "pro" }),
    });

    // Should render without throwing (no redirect)
    expect(() => renderToStaticMarkup(tree)).not.toThrow();
  });
});