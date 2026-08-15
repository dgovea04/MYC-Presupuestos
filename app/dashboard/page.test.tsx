import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { getDashboardStats } from "@/lib/data/dashboard";

type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

const mocks = vi.hoisted(() => ({
  getActiveWorkspaceId: vi.fn(),
  getAuthSession: vi.fn(),
  getDashboardStats: vi.fn(),
  getEffectiveWorkspaceLicense: vi.fn(),
  getGlobalOnboardingRecommendation: vi.fn(),
  getUserSettings: vi.fn(),
  hasFeatureAccess: vi.fn(),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/components/dashboard/dashboard-analytics-section", () => ({
  DashboardAnalyticsSection: () => <div data-testid="dashboard-analytics" />,
}));

vi.mock("@/components/dashboard/dashboard-analytics-section-skeleton", () => ({
  DashboardAnalyticsSectionSkeleton: () => <div data-testid="dashboard-analytics-skeleton" />,
}));

vi.mock("@/components/dashboard/khipu-quality-metrics", () => ({
  KhipuQualityMetrics: () => <div data-testid="khipu-quality-metrics" />,
}));

vi.mock("@/components/dashboard/khipu-quality-metrics-skeleton", () => ({
  KhipuQualityMetricsSkeleton: () => <div data-testid="khipu-quality-metrics-skeleton" />,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/dashboard", () => ({
  getDashboardStats: mocks.getDashboardStats,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

vi.mock("@/lib/data/global-aha-moment", () => ({
  getGlobalOnboardingRecommendation: mocks.getGlobalOnboardingRecommendation,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  getEffectiveWorkspaceLicense: mocks.getEffectiveWorkspaceLicense,
  hasFeatureAccess: mocks.hasFeatureAccess,
}));

import DashboardPage from "@/app/dashboard/page";

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1", email: "user@example.com", role: "USER" } });
    mocks.getActiveWorkspaceId.mockResolvedValue("workspace-1");
    mocks.getDashboardStats.mockResolvedValue(createDashboardStats());
    mocks.getUserSettings.mockResolvedValue({ currencyDecimals: 2, dateFormat: "DD/MM/YYYY" });
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue({ availableFeatures: [] });
    mocks.getGlobalOnboardingRecommendation.mockResolvedValue(null);
    mocks.hasFeatureAccess.mockReturnValue(false);
  });

  it("opens the demo and offers creating a project of the user's own in a demo-only workspace", async () => {
    const tree = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain('href="/projects/project-demo"');
    expect(markup).toContain("Abrir Edificio Multifamiliar - Demo");
    expect(markup).toContain('href="/projects/new"');
    expect(markup).toContain("Crear proyecto propio");
    expect(markup).not.toContain("Configura tu primer proyecto real");
  });

  it("shows real-project onboarding when a real project exists alongside the demo", async () => {
    mocks.getDashboardStats.mockResolvedValue(
      createDashboardStats({
        realProjectsCount: 1,
        realBudgetsCount: 0,
        projectsCount: 2,
      }),
    );

    const tree = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("Configura tu primer proyecto real");
    expect(markup).toContain("Proyecto real");
  });

  it("hides real-project onboarding after the first real project", async () => {
    mocks.getDashboardStats.mockResolvedValue(
      createDashboardStats({
        realProjectsCount: 2,
        realBudgetsCount: 1,
        projectsCount: 3,
      }),
    );

    const tree = await DashboardPage({ searchParams: Promise.resolve({}) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).not.toContain("Configura tu primer proyecto real");
  });
});

function createDashboardStats(overrides: Partial<DashboardStats> = {}): DashboardStats {
  return {
    companiesCount: 1,
    projectsCount: 1,
    realProjectsCount: 0,
    budgetsCount: 0,
    realBudgetsCount: 0,
    portfolioValue: 0,
    monthlyAdjustmentsCount: 0,
    pendingCount: 0,
    recentProject: {
      id: "project-demo",
      name: "Edificio Multifamiliar - Demo",
      isDemo: true,
      demoKey: "edificio-multifamiliar",
      companyName: "MYC Ingenieria",
      status: "IN_PROGRESS",
      updatedAt: new Date("2026-08-13T12:00:00.000Z"),
      generalBudget: null,
    },
    projects: [],
    budgets: [],
    pendingItems: [],
    templateSummary: {
      savedTemplatesCount: 0,
      templateBudgetApplicationCount: 0,
      templateMaintenanceEventCount: 0,
      totalTemplateItems: 0,
      averageItemsPerTemplate: 0,
      latestTemplate: null,
    },
    recentActivity: [],
    ...overrides,
  };
}
