import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  budgetFormSpy: vi.fn(),
  getAuthSession: vi.fn(),
  getProjectsByUser: vi.fn(),
  getActiveWorkspaceId: vi.fn(),
  getUserSettings: vi.fn(),
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/budget/budget-form", () => ({
  BudgetForm: (props: {
    projects: Array<{ id: string; name: string }>;
    defaultProjectId?: string;
    defaultCurrency: string;
    defaultIgvRate: number;
    defaultGeneralExpensesRate: number;
    defaultUtilityRate: number;
  }) => {
    mocks.budgetFormSpy(props);

    return <div data-testid="budget-form" />;
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectsByUser: mocks.getProjectsByUser,
}));

vi.mock("@/lib/workspace/active-workspace", () => ({
  getActiveWorkspaceId: mocks.getActiveWorkspaceId,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

import NewBudgetPage from "@/app/budgets/new/page";

describe("NewBudgetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getActiveWorkspaceId.mockResolvedValue(null);
    mocks.getProjectsByUser.mockResolvedValue([
      { id: "project-1", name: "Proyecto Uno" },
      { id: "project-2", name: "Proyecto Dos" },
    ]);
    mocks.getUserSettings.mockResolvedValue({
      defaultCurrency: "USD",
      defaultIgvRate: 0.115,
      defaultGeneralExpensesRate: 0.125,
      defaultUtilityRate: 0.105,
    });
  });

  it("passes project and settings defaults through to BudgetForm", async () => {
    const tree = await NewBudgetPage({
      searchParams: Promise.resolve({ projectId: "project-2" }),
    });

    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain('data-testid="budget-form"');
    expect(mocks.getActiveWorkspaceId).toHaveBeenCalledWith("user-1");
    expect(mocks.getProjectsByUser).toHaveBeenCalledWith("user-1", null);
    expect(mocks.getUserSettings).toHaveBeenCalledWith("user-1");
    expect(mocks.budgetFormSpy).toHaveBeenCalledTimes(1);
    expect(mocks.budgetFormSpy).toHaveBeenCalledWith({
      projects: [
        { id: "project-1", name: "Proyecto Uno" },
        { id: "project-2", name: "Proyecto Dos" },
      ],
      defaultProjectId: "project-2",
      defaultCurrency: "USD",
      defaultIgvRate: 0.115,
      defaultGeneralExpensesRate: 0.125,
      defaultUtilityRate: 0.105,
    });
  });
});
