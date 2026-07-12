import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  getEffectiveWorkspaceLicense: vi.fn(),
  getWorkspaceContextForUser: vi.fn(),
  hasFeatureAccess: vi.fn(),
  getUserSettings: vi.fn(),
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => mocks.AppShell(props),
}));

vi.mock("@/components/ai/KhipuWorkspace", () => ({
  KhipuWorkspace: () => <div data-testid="khipu-workspace" />,
}));

vi.mock("@/components/billing/upgrade-cta", () => ({
  UpgradeCTA: ({ title }: { title: string }) => <div data-testid="upgrade-cta">{title}</div>,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  getEffectiveWorkspaceLicense: mocks.getEffectiveWorkspaceLicense,
  hasFeatureAccess: mocks.hasFeatureAccess,
}));

vi.mock("@/lib/workspace/context", () => ({
  getWorkspaceContextForUser: mocks.getWorkspaceContextForUser,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

import AIPage from "@/app/ai/page";

describe("AIPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAuthSession.mockResolvedValue({
      user: { id: "user-1", email: "test@test.com", role: "USER" },
    });
    mocks.getActiveWorkspaceId.mockResolvedValue("ws-1");
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue({
      planSlug: "pro",
      planName: "Pro",
      role: "OWNER",
      availableFeatures: ["ai.local", "khipu.agent", "exports.advanced"],
    });
    mocks.hasFeatureAccess.mockImplementation(
      (_license: unknown, feature: string) => feature === "ai.local",
    );
    mocks.getWorkspaceContextForUser.mockResolvedValue({
      workspace: { id: "ws-1", name: "MYC Ingenieria", logoUrl: null },
      subscription: null,
    });
    mocks.getUserSettings.mockResolvedValue({
      currencyDecimals: 2,
      defaultCurrency: "PEN",
    });
  });

  it("redirects to login when no session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    await expect(
      AIPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });

  it("renders UpgradeCTA when license lacks ai.local", async () => {
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await AIPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"upgrade-cta\"");
    expect(markup).toContain("Khipu disponible en Pro");
    expect(markup).not.toContain("data-testid=\"khipu-workspace\"");
  });

  it("renders KhipuWorkspace when license has ai.local", async () => {
    const tree = await AIPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"khipu-workspace\"");
    expect(markup).not.toContain("data-testid=\"upgrade-cta\"");
  });

  it("calls getActiveWorkspaceId and getEffectiveWorkspaceLicense with correct params", async () => {
    await AIPage({ searchParams: Promise.resolve({}) });

    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith("user-1");
    expect(mocks.getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "ws-1",
    });
    expect(mocks.hasFeatureAccess).toHaveBeenCalledWith(
      expect.objectContaining({ planSlug: "pro" }),
      "ai.local",
    );
    expect(mocks.hasFeatureAccess).toHaveBeenCalledWith(
      expect.objectContaining({ planSlug: "pro" }),
      "khipu.agent",
    );
  });

  it("renders UpgradeCTA when workspace is null (no active workspace)", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue(null);
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue(null);
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await AIPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"upgrade-cta\"");
    expect(mocks.getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: null,
    });
  });

  it("passes searchParams to KhipuWorkspace", async () => {
    const tree = await AIPage({
      searchParams: Promise.resolve({ action: "apu", unit: "m2" }),
    });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"khipu-workspace\"");
  });

  it("renders KhipuWorkspace when license only has khipu.agent", async () => {
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue({
      planSlug: "pro",
      planName: "Pro",
      role: "OWNER",
      availableFeatures: ["khipu.agent"],
    });
    mocks.hasFeatureAccess.mockImplementation(
      (_license: unknown, feature: string) => feature === "khipu.agent",
    );

    const tree = await AIPage({ searchParams: Promise.resolve({ mode: "agent" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"khipu-workspace\"");
    expect(markup).not.toContain("data-testid=\"upgrade-cta\"");
  });
});
