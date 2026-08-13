import { describe, expect, it } from "vitest";

import { buildDashboardOnboardingSteps, shouldShowDashboardOnboarding } from "@/lib/dashboard/onboarding";
import type { DashboardPendingItem } from "@/lib/data/dashboard";

describe("buildDashboardOnboardingSteps", () => {
  it("marks only the company step as completed when the user has no projects or budgets", () => {
    const steps = buildDashboardOnboardingSteps({
      budgetsCount: 0,
      companiesCount: 1,
      pendingItems: [],
      projectsCount: 0,
    });

    expect(readCompletionMap(steps)).toEqual({
      Empresa: true,
      "Proyecto real": false,
      Presupuesto: false,
      Formula: false,
      Seguimiento: false,
    });
  });

  it("keeps formula and follow-up open while operational pending items exist", () => {
    const steps = buildDashboardOnboardingSteps({
      budgetsCount: 1,
      companiesCount: 1,
      pendingItems: [
        buildPendingItem("MISSING_POLYNOMIAL_FORMULA", "/budgets/budget-1/polynomial-formula"),
        buildPendingItem("MISSING_ADJUSTMENTS", "/budgets/budget-1/polynomial-formula?focus=adjustment"),
      ],
      projectsCount: 1,
    });

    expect(readCompletionMap(steps)).toEqual({
      Empresa: true,
      "Proyecto real": true,
      Presupuesto: true,
      Formula: false,
      Seguimiento: false,
    });
    expect(steps.find((step) => step.title === "Formula")?.href).toBe("/budgets/budget-1/polynomial-formula");
    expect(steps.find((step) => step.title === "Seguimiento")?.href).toBe("/budgets/budget-1/polynomial-formula?focus=adjustment");
  });

  it("marks the full base flow as completed once the project has budget, formula and follow-up", () => {
    const steps = buildDashboardOnboardingSteps({
      budgetsCount: 1,
      companiesCount: 1,
      pendingItems: [],
      projectsCount: 1,
    });

    expect(steps.every((step) => step.completed)).toBe(true);
  });
});

describe("shouldShowDashboardOnboarding", () => {
  it("shows onboarding for a new account with pending setup steps", () => {
    expect(
      shouldShowDashboardOnboarding({
        budgetsCount: 0,
        companiesCount: 0,
        pendingItems: [],
        projectsCount: 0,
      }),
    ).toBe(true);
  });

  it("shows onboarding for the first project while setup is incomplete", () => {
    expect(
      shouldShowDashboardOnboarding({
        budgetsCount: 0,
        companiesCount: 1,
        pendingItems: [],
        projectsCount: 1,
      }),
    ).toBe(true);
  });

  it("hides onboarding once the first project setup is complete", () => {
    expect(
      shouldShowDashboardOnboarding({
        budgetsCount: 1,
        companiesCount: 1,
        pendingItems: [],
        projectsCount: 1,
      }),
    ).toBe(false);
  });

  it("hides onboarding when the account already has more than one project", () => {
    expect(
      shouldShowDashboardOnboarding({
        budgetsCount: 1,
        companiesCount: 1,
        pendingItems: [buildPendingItem("MISSING_POLYNOMIAL_FORMULA")],
        projectsCount: 2,
      }),
    ).toBe(false);
  });
});

function readCompletionMap(steps: ReturnType<typeof buildDashboardOnboardingSteps>) {
  return Object.fromEntries(steps.map((step) => [step.title, step.completed]));
}

function buildPendingItem(type: DashboardPendingItem["type"], href = "/projects/project-1"): DashboardPendingItem {
  return {
    id: type,
    projectId: "project-1",
    projectName: "Proyecto demo",
    companyName: "Constructora demo",
    status: "PLANNING",
    observation: "Pendiente operativo",
    priority: "high",
    updatedAt: new Date("2026-05-01T00:00:00.000Z"),
    href,
    type,
  };
}
