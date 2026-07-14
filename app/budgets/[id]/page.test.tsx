import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  budgetFlowSpy: vi.fn(),
  decimalToNumber: vi.fn((value: number) => value),
  getAuthSession: vi.fn(),
  getBudgetById: vi.fn(),
  getBudgetTemplateCreationTraceability: vi.fn(),
  getCatalogPartidas: vi.fn(),
  getProjectById: vi.fn(),
  getProjectBudgetOverviewById: vi.fn(),
  getProjectSubBudgetDetails: vi.fn(),
  getProjectSubBudgetSummaries: vi.fn(),
  getResourcesByUser: vi.fn(),
  getUserSettings: vi.fn(),
  notFound: vi.fn(),
}));

// Mock next/dynamic to bypass ssr:false and render the loaded component synchronously in tests
vi.mock("next/dynamic", () => ({
  default: (loader: () => Promise<{ default: React.ComponentType<unknown> }>) => {
    let Component: React.ComponentType<unknown> | null = null;
    const promise = loader().then((mod) => {
      Component = mod.default;
    });
    return (props: Record<string, unknown>) => {
      if (!Component) throw promise;
      return createElement(Component, props);
    };
  },
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
    templateTraceability?: { title: string; detail: string } | null;
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

vi.mock("@/components/budget/sub-budget-delete-button", () => ({
  SubBudgetDeleteButton: ({ subBudgetName }: { subBudgetName: string }) => <button type="button">Eliminar {subBudgetName}</button>,
}));

vi.mock("@/components/budget/sub-budget-create-sheet", () => ({
  SubBudgetCreateSheet: ({ parentBudgetName }: { parentBudgetName: string }) => <button type="button">Nuevo Sub Presupuesto {parentBudgetName}</button>,
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

vi.mock("@/lib/data/activity-events", () => ({
  getBudgetTemplateCreationTraceability: mocks.getBudgetTemplateCreationTraceability,
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
  getProjectBudgetOverviewById: mocks.getProjectBudgetOverviewById,
}));

vi.mock("@/lib/data/resources", () => ({
  getResourcesByUser: mocks.getResourcesByUser,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

vi.mock("@/lib/db/serializers", () => ({
  decimalToNumber: mocks.decimalToNumber,
  stripBudgetProjectForClient: <T extends { project?: unknown }>(budget: T) => {
    const { project: _stripped, ...rest } = budget;
    return rest;
  },
}));

vi.mock("@/lib/utils", () => ({
  cn: vi.fn((...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ")),
  ensureDate: vi.fn((value: Date | string) => value instanceof Date ? value : new Date(value)),
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
    mocks.getUserSettings.mockResolvedValue({ defaultCurrency: "PEN", currencyDecimals: 2 });
    mocks.getProjectById.mockResolvedValue({
      id: "project-1",
      name: "Proyecto Demo",
      budgets: [],
    });
    mocks.getProjectBudgetOverviewById.mockResolvedValue({
      id: "project-1",
      companyId: "company-1",
      name: "Proyecto Demo",
      clientName: "Cliente Demo",
      updatedAt: new Date("2026-05-11T00:00:00.000Z"),
      budgets: [],
    });
    mocks.getProjectSubBudgetSummaries.mockResolvedValue([]);
    mocks.getProjectSubBudgetDetails.mockResolvedValue([]);
    mocks.getBudgetTemplateCreationTraceability.mockResolvedValue(null);
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
        templateTraceability: null,
        partidasCatalog: [],
        resourcesCatalog: [],
      }),
    );
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("strips the raw `project` field (Prisma Decimals) from the budget before forwarding to the Client Component", async () => {
    // BUGFIX: getBudgetById() returns `{ ...BudgetRecord, project: Project }`
    // where `project` is the raw Prisma row with Decimal columns. Next.js 16
    // rejects Prisma Decimal objects across the Server→Client boundary
    // ("Only plain objects can be passed to Client Components"). The page
    // must strip `project` before forwarding `budget` to BudgetFlowWrapper
    // so the Client Component only sees a serializable BudgetRecord.
    //
    // A class instance is used (not a plain object) because the RSC
    // serialization layer detects non-plain objects by prototype, and a
    // `{}` literal would pass the check — defeating the regression test.
    class FakeDecimal {
      toString() { return "1500.5"; }
      toFixed() { return "1500.50"; }
    }
    const fakeBuiltArea = new FakeDecimal();

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
      // Raw Prisma project row with Decimal columns — the source of the
      // original "Decimal objects are not supported" error.
      project: {
        id: "project-1",
        companyId: "company-1",
        name: "Proyecto Demo",
        clientName: "Cliente Demo",
        location: null,
        projectType: null,
        projectCategory: null,
        buildingSubtype: null,
        contractType: null,
        builtArea: fakeBuiltArea,
        landArea: fakeBuiltArea,
        floors: null,
        basements: null,
        buildingHeight: fakeBuiltArea,
        contractAmount: fakeBuiltArea,
        referenceBudget: fakeBuiltArea,
        region: null,
        province: null,
        district: null,
        executiveSummary: null,
        projectManager: null,
        ownerEntity: null,
        supervisor: null,
        startDate: null,
        endDate: null,
        status: "PLANNING",
        createdAt: new Date("2026-05-11T00:00:00.000Z"),
        updatedAt: new Date("2026-05-11T00:00:00.000Z"),
      },
    });

    const tree = await BudgetDetailPage({
      params: Promise.resolve({ id: "budget-1" }),
    });

    // If the page forwarded the raw `project` field, renderToStaticMarkup
    // would throw the "Decimal objects are not supported" error.
    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain('data-testid="budget-flow"');
    expect(mocks.budgetFlowSpy).toHaveBeenCalledTimes(1);
    const forwardedProps = mocks.budgetFlowSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    const forwardedBudget = forwardedProps.budget as Record<string, unknown>;
    // The raw `project` field must NOT be present in the budget prop
    // forwarded to the Client Component.
    expect("project" in forwardedBudget).toBe(false);
    // The serialized fields must still be present.
    expect(forwardedBudget.id).toBe("budget-1");
    expect(forwardedBudget.name).toBe("Sub Presupuesto Demo");
  });

  it("loads the project overview without recreating missing default sub budgets or blocking on editor catalogs", async () => {
    await BudgetDetailPage({
      params: Promise.resolve({ id: "budget-1" }),
    });

    expect(mocks.getProjectBudgetOverviewById).toHaveBeenCalledWith("project-1", "user-1");
    expect(mocks.getResourcesByUser).not.toHaveBeenCalled();
    expect(mocks.getCatalogPartidas).not.toHaveBeenCalled();
    expect(mocks.getProjectById).not.toHaveBeenCalled();
  });

  it("defers template traceability in the sub-budget branch", async () => {
    mocks.getBudgetTemplateCreationTraceability.mockResolvedValue({
      title: "Presupuesto creado desde plantilla",
      detail: "Arquitectura desde Base tecnica",
      href: "/budgets/budget-1",
      createdAt: new Date("2026-05-29T22:30:00.000Z"),
    });

    const tree = await BudgetDetailPage({
      params: Promise.resolve({ id: "budget-1" }),
    });

    renderToStaticMarkup(tree);

    expect(mocks.budgetFlowSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        templateTraceability: null,
      }),
    );
    expect(mocks.getBudgetTemplateCreationTraceability).not.toHaveBeenCalled();
  });

  it("uses project overview budgets for the general budget summaries", async () => {
    mocks.getBudgetById.mockResolvedValue({
      id: "general-1",
      projectId: "project-1",
      parentBudgetId: null,
      kind: "GENERAL",
      name: "Presupuesto General",
      currency: "PEN",
      igvRate: 0.18,
      generalExpensesRate: 0.1,
      utilityRate: 0.08,
      totalDirectCost: 100,
      totalGeneralExpenses: 10,
      totalUtility: 8,
      totalTax: 21.24,
      totalAmount: 139.24,
      levels: [],
      items: [],
    });
    mocks.getProjectBudgetOverviewById.mockResolvedValue({
      id: "project-1",
      companyId: "company-1",
      name: "Proyecto Demo",
      clientName: "Cliente Demo",
      updatedAt: new Date("2026-05-11T00:00:00.000Z"),
      budgets: [
        {
          id: "sub-1",
          projectId: "project-1",
          parentBudgetId: "general-1",
          kind: "SUB_BUDGET",
          name: "Estructuras",
          currency: "PEN",
          totalDirectCost: 100,
          totalGeneralExpenses: 10,
          totalUtility: 8,
          totalTax: 21.24,
          totalAmount: 139.24,
          updatedAt: new Date("2026-05-11T00:00:00.000Z"),
          _count: { levels: 2, items: 3 },
        },
      ],
    });

    const tree = await BudgetDetailPage({
      params: Promise.resolve({ id: "general-1" }),
    });

    const markup = renderToStaticMarkup(tree);

    expect(markup).toContain('data-testid="general-budget-overview"');
    expect(mocks.getBudgetTemplateCreationTraceability).toHaveBeenCalledWith({ userId: "user-1", budgetId: "general-1" });
    expect(mocks.getProjectSubBudgetSummaries).not.toHaveBeenCalled();
    expect(mocks.getProjectSubBudgetDetails).not.toHaveBeenCalled();
  });
});
