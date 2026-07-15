import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getGeneralBudgetSectionContext: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  getEffectiveWorkspaceLicense: vi.fn(),
  hasFeatureAccess: vi.fn(),
  getWorkScheduleOverviewSection: vi.fn(),
  shellSpy: vi.fn(),
}));

vi.mock("@/app/budgets/[id]/section-context", () => ({
  getGeneralBudgetSectionContext: mocks.getGeneralBudgetSectionContext,
}));

vi.mock("@/components/billing/upgrade-cta", () => ({
  UpgradeCTA: ({ title }: { title: string }) => <div data-testid="upgrade-cta">{title}</div>,
}));

vi.mock("@/components/budget/general-budget-section-shell", () => ({
  GeneralBudgetSectionShell: (props: { children: ReactNode; title: string; description: string; currentUser: unknown; settings: unknown }) => {
    mocks.shellSpy(props);

    return <div data-testid="shell">{props.children}</div>;
  },
}));

vi.mock("@/components/budget/work-schedule-page-content", () => ({
  WorkSchedulePageContent: () => <div data-testid="work-schedule-content" />,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

vi.mock("@/lib/workspace/entitlements", () => ({
  getEffectiveWorkspaceLicense: mocks.getEffectiveWorkspaceLicense,
  hasFeatureAccess: mocks.hasFeatureAccess,
}));

vi.mock("@/lib/data/work-schedule", () => ({
  getWorkScheduleOverviewSection: mocks.getWorkScheduleOverviewSection,
}));

import WorkSchedulePage from "@/app/budgets/[id]/work-schedule/page";

describe("WorkSchedulePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getGeneralBudgetSectionContext.mockResolvedValue({
      budget: { id: "budget-1", name: "Mi Presupuesto" },
      currentUser: { id: "user-1", name: "Test User" },
      project: { id: "project-1", name: "Proyecto Uno" },
      session: { user: { id: "user-1" } },
      settings: { defaultCurrency: "PEN" },
    });
    mocks.getActiveWorkspaceId.mockResolvedValue("ws-1");
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue({
      planSlug: "pro",
      planName: "Pro",
      role: "OWNER",
      availableFeatures: ["work_schedule.intelligent", "exports.advanced"],
    });
    mocks.hasFeatureAccess.mockImplementation(
      (_license: unknown, feature: string) => feature === "work_schedule.intelligent",
    );
    mocks.getWorkScheduleOverviewSection.mockResolvedValue({
      summary: {
        totalBudget: 100000,
        totalDuration: 120,
      },
      items: [],
    });
  });

  it("renders WorkSchedulePageContent when feature is available", async () => {
    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"work-schedule-content\"");
    expect(markup).not.toContain("data-testid=\"upgrade-cta\"");
  });

  it("renders UpgradeCTA when license lacks work_schedule.intelligent", async () => {
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"upgrade-cta\"");
    expect(markup).toContain("Cronograma inteligente disponible en Pro");
    expect(markup).not.toContain("data-testid=\"work-schedule-content\"");
  });

  it("calls getActiveWorkspaceId and getEffectiveWorkspaceLicense", async () => {
    await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });

    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith("user-1");
    expect(mocks.getEffectiveWorkspaceLicense).toHaveBeenCalledWith({
      userId: "user-1",
      companyId: "ws-1",
    });
    expect(mocks.hasFeatureAccess).toHaveBeenCalledWith(
      expect.objectContaining({ planSlug: "pro" }),
      "work_schedule.intelligent",
    );
  });

  it("skips fetching work schedule section when feature is unavailable", async () => {
    mocks.hasFeatureAccess.mockReturnValue(false);

    await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });

    expect(mocks.getWorkScheduleOverviewSection).not.toHaveBeenCalled();
  });

  it("renders UpgradeCTA when workspace is null", async () => {
    mocks.getActiveWorkspaceId.mockResolvedValue(null);
    mocks.getEffectiveWorkspaceLicense.mockResolvedValue(null);
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("data-testid=\"upgrade-cta\"");
  });
});
