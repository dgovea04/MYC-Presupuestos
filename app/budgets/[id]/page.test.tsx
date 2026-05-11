import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  budgetFlowSpy: vi.fn(),
  decimalToNumber: vi.fn((value: number) => value),
  getAuthSession: vi.fn(),
  getBudgetById: vi.fn(),
  getCatalogPartidas: vi.fn(),
  getProjectById: vi.fn(),
  getProjectSubBudgetDetails: vi.fn(),
  getProjectSubBudgetSummaries: vi.fn(),
  getResourcesByUser: vi.fn(),
  getUserSettings: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

vi.mock("@/components/layout/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/components/budget/budget-flow", () => ({
  BudgetFlow: (props: {
    budget: { id: string };
    projectName?: string;
    resourcesCatalog: Array<{ id: string; unitPrice: number }>;
    partidasCatalog: unknown[];
  }) => {
    mocks.budgetFlowSpy(props);

    return (
      <div
        data-budget-id={props.budget.id}
        data-project-name={props.projectName ?? ""}
        data-resource-count={String(props.resourcesCatalog.length)}
        data-testid="budget-flow"
      />
    );
  },
}));

vi.mock("@/components/budget/general-budget-overview", () => ({
  GeneralBudgetOverview: () => <div data-testid="general-budget-overview" />,
}));

vi.mock("@/components/ui/action-button", () => ({
  ActionButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/data/budgets", () => ({
  getBudgetById: mocks.getBudgetById,
  getProjectSubBudgetDetails: mocks.getProjectSubBudgetDetails,
  getProjectSubBudgetSummaries: mocks.getProjectSubBudgetSummaries,
}));

vi.mock("@/lib/data/partidas", () => ({
  getCatalogPartidas: mocks.getCatalogPartidas,
}));

vi.mock("@/lib/data/projects", () => ({
  getProjectById: mocks.getProjectById,
}));

vi.mock("@/lib/data/resources", () => ({
  getResourcesByUser: mocks.getResourcesByUser,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

vi.mock("@/lib/db/serializers", () => ({
  decimalToNumber: mocks.decimalToNumber,
}));

vi.mock("@/lib/utils", () => ({
  formatCurrency: vi.fn(() => "S/ 0.00"),
  formatDate: vi.fn(() => "2026-05-11"),
}));

import BudgetDetailPage from "@/app/budgets/[id]/page";

describe("BudgetDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.getBudgetById.mockResolvedValue({
      id: "budget-1",
      projectId: "project-1",
      parentBudgetId: null,
      kind: "SUB_BUDGET",
      name: "Sub Presupuesto Demo",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      totalDirectCost: 0,
      totalGeneralExpenses: 0,
      totalUtility: 0,
      totalTax: 0,
      totalAmount: 0,
      levels: [],
      items: [],
    });
    mocks.getResourcesByUser.mockResolvedValue([
      {
        id: "resource-1",
        companyId: "company-1",
        code: "MO-01",
        description: "Operario",
        category: "LABOR",
        iu: null,
        subcategory: null,
        unit: "HH",
        unitPrice: 19.23,
        currency: "PEN",
        source: null,
      },
    ]);
    mocks.getCatalogPartidas.mockResolvedValue([]);
    mocks.getUserSettings.mockResolvedValue({ currencyDecimals: 2 });
    mocks.getProjectById.mockResolvedValue({
      id: "project-1",
      name: "Proyecto Demo",
      budgets: [],
    });
    mocks.getProjectSubBudgetSummaries.mockResolvedValue([]);
    mocks.getProjectSubBudgetDetails.mockResolvedValue([]);
  });

  it("routes the sub-budget branch through BudgetFlow", async () => {
    const tree = await BudgetDetailPage({
      params: Promise.resolve({ id: "budget-1" }),
    });

    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain('data-testid="budget-flow"');
    expect(markup).toContain('data-budget-id="budget-1"');
    expect(markup).toContain('data-project-name="Proyecto Demo"');
    expect(mocks.budgetFlowSpy).toHaveBeenCalledTimes(1);
    expect(mocks.budgetFlowSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        budget: expect.objectContaining({ id: "budget-1" }),
        projectName: "Proyecto Demo",
        partidasCatalog: [],
        resourcesCatalog: [
          expect.objectContaining({
            id: "resource-1",
            unitPrice: 19.23,
          }),
        ],
      }),
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
