import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/script", () => ({
  default: ({
    children,
    dangerouslySetInnerHTML,
    ...props
  }: {
    children?: ReactNode;
    dangerouslySetInnerHTML?: { __html: string };
    id?: string;
  }) => {
    if (dangerouslySetInnerHTML) {
      return <script {...props} dangerouslySetInnerHTML={dangerouslySetInnerHTML} />;
    }

    return <script {...props}>{children}</script>;
  },
}));

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

  // ─── blocking script for panel width ──────────────────────────────────

  it("renders an inline next/script tag before the shell", async () => {
    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    const scriptIndex = markup.indexOf("<script");
    const scriptIdIndex = markup.indexOf("work-schedule-overview-width-bootstrap");
    const shellIndex = markup.indexOf('data-testid="shell"');
    expect(scriptIndex).toBeGreaterThan(-1);
    expect(scriptIdIndex).toBeGreaterThan(-1);
    expect(shellIndex).toBeGreaterThan(-1);
    expect(scriptIndex).toBeLessThan(shellIndex);
  });

  it("injects the budget-specific localStorage key in the script", async () => {
    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("work-schedule-overview-timeline-panel-width:budget-1");
  });

  it("injects a different budget id in the localStorage key", async () => {
    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-abc-123" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("work-schedule-overview-timeline-panel-width:budget-abc-123");
  });

  it("sets the CSS variable on document.documentElement in the script", async () => {
    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("document.documentElement.style.setProperty");
    expect(markup).toContain("'--work-schedule-timeline-panel-width'");
    expect(markup).toContain("w+'px'");
  });

  it("wraps the script logic in an IIFE", async () => {
    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("(function(){");
    expect(markup).toContain("})()");
  });

  it("reads from localStorage in the script", async () => {
    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("localStorage.getItem");
  });

  it("renders the inline script with the next/script id", async () => {
    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain("id=\"work-schedule-overview-width-bootstrap\"");
    expect(markup).not.toContain("<script src");
  });

  it("still renders the script when feature is unavailable", async () => {
    mocks.hasFeatureAccess.mockReturnValue(false);

    const tree = await WorkSchedulePage({ params: Promise.resolve({ id: "budget-1" }) });
    const markup = renderToStaticMarkup(tree);

    // Script should appear even when showing UpgradeCTA
    expect(markup).toContain("localStorage.getItem");
    expect(markup).toContain("work-schedule-overview-timeline-panel-width:budget-1");
  });
});
