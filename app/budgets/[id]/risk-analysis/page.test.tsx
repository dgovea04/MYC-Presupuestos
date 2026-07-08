import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  getEffectiveWorkspaceLicense: vi.fn(),
  hasFeatureAccess: vi.fn(),
  getUserSettings: vi.fn(),
  getBudgetHeaderById: vi.fn(),
  getRiskAnalysisPayload: vi.fn(),
  getWorkScheduleSection: vi.fn(),
  buildFallbackRiskAnalysisPayload: vi.fn(),
  buildRiskWorkScheduleSummary: vi.fn(),
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => mocks.AppShell(props),
}));

vi.mock("@/components/billing/upgrade-cta", () => ({
  UpgradeCTA: ({ title }: { title: string }) => <div data-testid="upgrade-cta">{title}</div>,
}));

vi.mock("@/components/risk/risk-analysis-dashboard", () => ({
  RiskAnalysisDashboard: () => <div data-testid="risk-analysis-dashboard" />,
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

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

vi.mock("@/lib/data/work-schedule", () => ({
  getWorkScheduleSection: mocks.getWorkScheduleSection,
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetHeaderById: mocks.getBudgetHeaderById,
}));

vi.mock("@/lib/risk/data", () => ({
  getRiskAnalysisPayload: mocks.getRiskAnalysisPayload,
}));

vi.mock("@/lib/risk/fallback", () => ({
  buildFallbackRiskAnalysisPayload: mocks.buildFallbackRiskAnalysisPayload,
  buildRiskWorkScheduleSummary: mocks.buildRiskWorkScheduleSummary,
}));

import BudgetRiskAnalysisPage from "@/app/budgets/[id]/risk-analysis/page";

describe("BudgetRiskAnalysisPage", () => {
  const defaultPayload = {
    budget: {
      id: "budget-1",
      name: "Mi Presupuesto",
      kind: "GENERAL",
      currency: "PEN",
    },
    items: [],
    summary: { directCost: 100000 },
  };

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
      availableFeatures: ["risk_analysis", "work_schedule.intelligent", "exports.advanced"],
    });
    mocks.hasFeatureAccess.mockImplementation(
      (_license: unknown, feature: string) =>
        feature === "risk_analysis" || feature === "work_schedule.intelligent",
    );
    mocks.getUserSettings.mockResolvedValue({
      currencyDecimals: 2,
      defaultCurrency: "PEN",
    });
    mocks.getBudgetHeaderById.mockResolvedValue({
      id: "budget-1",
      name: "Mi Presupuesto",
      kind: "GENERAL",
      currency: "PEN",
      projectId: "project-1",
    });
    mocks.getRiskAnalysisPayload.mockResolvedValue(defaultPayload);
    mocks.getWorkScheduleSection.mockRejectedValue(new Error("no section"));
  });

  it("calls notFound when no session", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    await expect(
      BudgetRiskAnalysisPage({ params: Promise.resolve({ id: "budget-1" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders UpgradeCTA when license lacks risk_analysis", async () => {
    mocks.hasFeatureAccess.mockImplementation(() => false);

    const tree = await BudgetRiskAnalysisPage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"upgrade-cta\"");
    expect(markup).toContain("Analisis de riesgo disponible en Pro");
    expect(markup).not.toContain("data-testid=\"risk-analysis-dashboard\"");
  });

  it("renders RiskAnalysisDashboard when feature is available and budget found", async () => {
    const tree = await BudgetRiskAnalysisPage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"risk-analysis-dashboard\"");
    expect(markup).not.toContain("data-testid=\"upgrade-cta\"");
  });

  it("calls getActiveWorkspaceId and getEffectiveWorkspaceLicense", async () => {
    await BudgetRiskAnalysisPage({ params: Promise.resolve({ id: "budget-1" }) });

    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith("user-1");
    expect(mocks.getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "ws-1",
    });
    expect(mocks.hasFeatureAccess).toHaveBeenCalledWith(
      expect.objectContaining({ planSlug: "pro" }),
      "risk_analysis",
    );
  });

  it("calls notFound when budget header is not found", async () => {
    mocks.getBudgetHeaderById.mockResolvedValue(null);

    await expect(
      BudgetRiskAnalysisPage({ params: Promise.resolve({ id: "budget-1" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("renders UpgradeCTA when workspace is null", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue(null);
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue(null);
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await BudgetRiskAnalysisPage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"upgrade-cta\"");
  });
});
