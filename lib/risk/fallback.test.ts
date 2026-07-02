/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { buildFallbackRiskAnalysisPayload, buildRiskWorkScheduleSummary } from "@/lib/risk/fallback";

vi.mock("@/lib/data/budgets", () => ({
  getBudgetById: vi.fn() as any,
  getProjectSubBudgetDetails: vi.fn() as any,
}));

vi.mock("@/lib/risk/data", () => ({
  getRiskAnalysisFallbackData: vi.fn() as any,
}));

import { getBudgetById, getProjectSubBudgetDetails } from "@/lib/data/budgets";
import { getRiskAnalysisFallbackData } from "@/lib/risk/data";

function createBudgetItem(overrides: Partial<{
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
}> = {}) {
  return {
    id: overrides.id ?? "item-1",
    budgetId: "sub-budget-1",
    levelId: undefined,
    code: overrides.code ?? "01.01",
    description: overrides.description ?? "Excavacion",
    unit: overrides.unit ?? "m3",
    quantity: overrides.quantity ?? 10,
    unitPrice: overrides.unitPrice ?? 25,
    partial: overrides.partial ?? 250,
    sortOrder: 0,
    apu: null,
  };
}

function createSubBudget(overrides: Partial<{
  id: string;
  name: string;
  items: ReturnType<typeof createBudgetItem>[];
}> = {}) {
  return {
    id: overrides.id ?? "sub-budget-1",
    projectId: "project-1",
    parentBudgetId: "general-budget",
    kind: "SUB_BUDGET" as const,
    name: overrides.name ?? "Estructuras",
    currency: "PEN",
    igvRate: 0.18,
    generalExpensesRate: 0.1,
    utilityRate: 0.08,
    totalDirectCost: 1000,
    totalGeneralExpenses: 100,
    totalUtility: 80,
    totalTax: 212.4,
    totalAmount: 1392.4,
    levels: [],
    items: overrides.items ?? [createBudgetItem()],
  };
}

const emptyRiskData = {
  variables: [],
  correlations: [],
  latestRun: null,
};

describe("buildFallbackRiskAnalysisPayload", () => {
  it("builds items from sub-budgets for GENERAL kind", async () => {
    vi.mocked(getProjectSubBudgetDetails).mockResolvedValueOnce([
      createSubBudget({ id: "sub-1", name: "Estructuras", items: [createBudgetItem({ id: "item-a", partial: 300 })] }),
      createSubBudget({ id: "sub-2", name: "Arquitectura", items: [createBudgetItem({ id: "item-b", partial: 200 })] }),
    ] as any);
    vi.mocked(getRiskAnalysisFallbackData).mockResolvedValueOnce(emptyRiskData);

    const result = await buildFallbackRiskAnalysisPayload({
      budgetId: "general-1",
      budgetKind: "GENERAL",
      budgetName: "Presupuesto General",
      currency: "PEN",
      projectId: "project-1",
      userId: "user-1",
    });

    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0]).toMatchObject({
      itemId: "item-a",
      budgetId: "sub-1",
      sourceBudgetName: "Estructuras",
      baseTotal: 300,
    });
    expect(result!.items[1]).toMatchObject({
      itemId: "item-b",
      budgetId: "sub-2",
      sourceBudgetName: "Arquitectura",
      baseTotal: 200,
    });
    expect(result!.budget.baseTotal).toBe(500);
  });

  it("builds items from getBudgetById for SUB_BUDGET kind", async () => {
    vi.mocked(getBudgetById).mockResolvedValueOnce({
      items: [
        createBudgetItem({ id: "item-1", partial: 500 }),
        createBudgetItem({ id: "item-2", partial: 350 }),
      ],
    } as any);
    vi.mocked(getRiskAnalysisFallbackData).mockResolvedValueOnce(emptyRiskData);

    const result = await buildFallbackRiskAnalysisPayload({
      budgetId: "sub-budget-1",
      budgetKind: "SUB_BUDGET",
      budgetName: "Estructuras",
      currency: "PEN",
      projectId: "project-1",
      userId: "user-1",
    });

    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0]).toMatchObject({
      itemId: "item-1",
      budgetId: "sub-budget-1",
      sourceBudgetName: "Estructuras",
      baseTotal: 500,
    });
    expect(result!.budget.baseTotal).toBe(850);
    expect(result!.budget.kind).toBe("SUB_BUDGET");
    expect(result!.budget.name).toBe("Estructuras");
  });

  it("returns null when getBudgetById returns null for SUB_BUDGET", async () => {
    vi.mocked(getBudgetById).mockResolvedValueOnce(null);
    // getRiskAnalysisFallbackData won't be called — the early return null fires first

    const result = await buildFallbackRiskAnalysisPayload({
      budgetId: "missing-budget",
      budgetKind: "SUB_BUDGET",
      budgetName: "No existe",
      currency: "PEN",
      projectId: "project-1",
      userId: "user-1",
    });

    expect(result).toBeNull();
  });

  it("returns an empty payload when GENERAL kind has no sub-budget items", async () => {
    vi.mocked(getProjectSubBudgetDetails).mockResolvedValueOnce([]);
    // No getRiskAnalysisFallbackData mock needed since it won't be called
    // Actually it will still be called - let me add it
    vi.mocked(getRiskAnalysisFallbackData).mockResolvedValueOnce(emptyRiskData);

    const result = await buildFallbackRiskAnalysisPayload({
      budgetId: "empty-general",
      budgetKind: "GENERAL",
      budgetName: "Vacio",
      currency: "PEN",
      projectId: "project-1",
      userId: "user-1",
    });

    // With empty items, baseTotal is 0 but the payload is still returned
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(0);
    expect(result!.budget.baseTotal).toBe(0);
  });

  it("calls getRiskAnalysisFallbackData with correct item IDs scoped to items", async () => {
    vi.mocked(getProjectSubBudgetDetails).mockResolvedValueOnce([
      createSubBudget({
        items: [
          createBudgetItem({ id: "item-a" }),
          createBudgetItem({ id: "item-b" }),
        ],
      }),
    ] as any);
    vi.mocked(getRiskAnalysisFallbackData).mockResolvedValueOnce(emptyRiskData);

    await buildFallbackRiskAnalysisPayload({
      budgetId: "general-1",
      budgetKind: "GENERAL",
      budgetName: "General",
      currency: "PEN",
      projectId: "project-1",
      userId: "user-1",
    });

    expect(getRiskAnalysisFallbackData).toHaveBeenCalledWith(
      "general-1",
      ["item-a", "item-b"],
    );
  });

  it("merges risk data from getRiskAnalysisFallbackData into the payload", async () => {
    vi.mocked(getProjectSubBudgetDetails).mockResolvedValueOnce([
      createSubBudget({ items: [createBudgetItem({ id: "item-1" })] }),
    ] as any);
    vi.mocked(getRiskAnalysisFallbackData).mockResolvedValueOnce({
      variables: [
        {
          id: "risk-1",
          budgetId: "general-1",
          budgetItemId: "item-1",
          variableType: "QUANTITY" as const,
          distributionType: "TRIANGULAR" as const,
          minimum: 8,
          mostLikely: 10,
          maximum: 12,
          enabled: true,
        },
      ],
      correlations: [
        {
          id: "corr-1",
          budgetId: "general-1",
          sourceVariableId: "risk-1",
          targetVariableId: "risk-2",
          coefficient: 0.65,
        },
      ],
      latestRun: {
        id: "run-1",
        budgetId: "general-1",
        iterations: 10000,
        baseTotal: 250,
        mean: 260,
        median: 258,
        variance: 400,
        standardDeviation: 20,
        skewness: 0.1,
        kurtosis: 2.9,
        p10: 230,
        p50: 258,
        p80: 275,
        p90: 285,
        p95: 295,
        histogramBins: [],
        sCurvePoints: [],
        scheduleDuration: null,
      },
    });

    const result = await buildFallbackRiskAnalysisPayload({
      budgetId: "general-1",
      budgetKind: "GENERAL",
      budgetName: "General",
      currency: "PEN",
      projectId: "project-1",
      userId: "user-1",
    });

    expect(result!.variables).toHaveLength(1);
    expect(result!.variables[0]).toMatchObject({ id: "risk-1" });
    expect(result!.correlations).toHaveLength(1);
    expect(result!.correlations[0]).toMatchObject({ id: "corr-1" });
    expect(result!.latestRun).not.toBeNull();
    expect(result!.latestRun!.id).toBe("run-1");
  });

  it("survives getRiskAnalysisFallbackData throwing by falling back to empty risk data", async () => {
    vi.mocked(getProjectSubBudgetDetails).mockResolvedValueOnce([
      createSubBudget({ items: [createBudgetItem({ id: "item-1", partial: 100 })] }),
    ] as any);
    vi.mocked(getRiskAnalysisFallbackData).mockRejectedValueOnce(new Error("DB connection lost"));

    const result = await buildFallbackRiskAnalysisPayload({
      budgetId: "general-1",
      budgetKind: "GENERAL",
      budgetName: "General",
      currency: "PEN",
      projectId: "project-1",
      userId: "user-1",
    });

    // Should still return a valid payload with empty risk data
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
    expect(result!.variables).toEqual([]);
    expect(result!.correlations).toEqual([]);
    expect(result!.latestRun).toBeNull();
  });

  it("sets correct budget metadata in the payload", async () => {
    vi.mocked(getBudgetById).mockResolvedValueOnce({
      items: [createBudgetItem({ id: "item-1", partial: 1000 })],
    } as any);
    vi.mocked(getRiskAnalysisFallbackData).mockResolvedValueOnce(emptyRiskData);

    const result = await buildFallbackRiskAnalysisPayload({
      budgetId: "budget-xyz",
      budgetKind: "SUB_BUDGET",
      budgetName: "Sanitarias",
      currency: "USD",
      projectId: "project-abc",
      userId: "user-1",
    });

    expect(result!.budget).toMatchObject({
      id: "budget-xyz",
      projectId: "project-abc",
      name: "Sanitarias",
      kind: "SUB_BUDGET",
      currency: "USD",
    });
  });

  it("sets baseTotal as sum of all item baseTotals", async () => {
    vi.mocked(getProjectSubBudgetDetails).mockResolvedValueOnce([
      createSubBudget({
        items: [
          createBudgetItem({ id: "a", partial: 100 }),
          createBudgetItem({ id: "b", partial: 200 }),
          createBudgetItem({ id: "c", partial: 50 }),
        ],
      }),
    ] as any);
    vi.mocked(getRiskAnalysisFallbackData).mockResolvedValueOnce(emptyRiskData);

    const result = await buildFallbackRiskAnalysisPayload({
      budgetId: "general-1",
      budgetKind: "GENERAL",
      budgetName: "General",
      currency: "PEN",
      projectId: "project-1",
      userId: "user-1",
    });

    expect(result!.budget.baseTotal).toBe(350);
  });
});

describe("buildRiskWorkScheduleSummary", () => {
  function createLine(overrides: Partial<{
    budgetItemId: string;
    itemCode: string;
    description: string;
    subBudgetName: string;
    partial: number;
    durationDays: number | null;
    startDate: string | null;
    endDate: string | null;
    predecessor: string | null;
    isCritical: boolean;
  }> = {}) {
    const isCritical = overrides.isCritical ?? false;
    return {
      scheduleItemId: `schedule-${overrides.budgetItemId ?? "item-1"}`,
      budgetItemId: overrides.budgetItemId ?? "item-1",
      levelId: null,
      sortOrder: 0,
      itemCode: overrides.itemCode ?? "01.01",
      description: overrides.description ?? "Excavacion",
      unit: "m3",
      quantity: 10,
      unitPrice: 25,
      partial: overrides.partial ?? 250,
      subBudgetId: "sub-1",
      subBudgetName: overrides.subBudgetName ?? "Estructuras",
      startDate: overrides.startDate ?? null,
      endDate: overrides.endDate ?? null,
      durationDays: overrides.durationDays ?? null,
      predecessor: overrides.predecessor ?? null,
      crew: null,
      performance: null,
      performanceLabel: null,
      monthlyDistributions: [],
      resources: [],
      criticalPath: isCritical
        ? {
            earlyStartDay: 0,
            earlyFinishDay: 10,
            lateStartDay: 0,
            lateFinishDay: 10,
            totalSlackDays: 0,
            isCritical: true,
          }
        : null,
    };
  }

  function createSection(overrides: Partial<{
    budgetId: string;
    budgetName: string;
    currency: string;
    startDate: string | null;
    endDate: string | null;
    criticalPath: { status: "calculated" | "cycle"; projectDurationDays: number; scheduledItemCount: number; criticalItemCount: number; issues: string[] } | null;
    generationSummary: { generatedCount: number; pendingCount: number; issues: { budgetItemId: string; itemCode: string; reason: string }[] } | null;
    lines: ReturnType<typeof createLine>[];
  }> = {}) {
    const lines = overrides.lines ?? [createLine()];
    return {
      budgetId: overrides.budgetId ?? "budget-1",
      budgetName: overrides.budgetName ?? "Presupuesto General",
      projectName: "Proyecto A",
      currency: overrides.currency ?? "PEN",
      groups: [
        {
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          totalAmount: lines.reduce((sum, line) => sum + line.partial, 0),
          lines,
          rows: lines.map((line) => ({ kind: "line" as const, rowId: line.budgetItemId, line })),
        },
      ],
      valuationCalendar: { periods: [], rows: [] },
      resourceCalendar: { periods: [], rows: [] },
      curveSeries: [],
      timeline: {
        startDate: overrides.startDate ?? "2026-01-01",
        endDate: overrides.endDate ?? "2026-06-30",
      },
      criticalPath: overrides.criticalPath ?? null,
      generationSummary: overrides.generationSummary ?? null,
    };
  }

  it("maps budget metadata correctly", () => {
    const section = createSection({
      budgetId: "budget-xyz",
      budgetName: "Presupuesto Test",
      currency: "USD",
      startDate: "2026-03-01",
      endDate: "2026-12-31",
    });

    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.budgetId).toBe("budget-xyz");
    expect(result.budgetName).toBe("Presupuesto Test");
    expect(result.currency).toBe("USD");
    expect(result.timeline).toEqual({ startDate: "2026-03-01", endDate: "2026-12-31" });
  });

  it("maps timeline with null dates", () => {
    const section = createSection();
    section.timeline = { startDate: null, endDate: null };
    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.timeline).toEqual({ startDate: null, endDate: null });
  });

  it("maps critical path when present", () => {
    const section = createSection({
      criticalPath: {
        status: "calculated",
        projectDurationDays: 90,
        scheduledItemCount: 15,
        criticalItemCount: 5,
        issues: [],
      },
    });

    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.criticalPath).toEqual({
      status: "calculated",
      projectDurationDays: 90,
      scheduledItemCount: 15,
      criticalItemCount: 5,
      issues: [],
    });
  });

  it("maps critical path with null fallback", () => {
    const section = createSection({ criticalPath: undefined });
    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.criticalPath).toBeNull();
  });

  it("maps critical path with cycle status", () => {
    const section = createSection({
      criticalPath: {
        status: "cycle",
        projectDurationDays: 0,
        scheduledItemCount: 5,
        criticalItemCount: 0,
        issues: ["Ciclo detectado entre items A y B"],
      },
    });

    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.criticalPath).toMatchObject({
      status: "cycle",
      issues: ["Ciclo detectado entre items A y B"],
    });
  });

  it("maps generation summary when present", () => {
    const section = createSection({
      generationSummary: {
        generatedCount: 42,
        pendingCount: 8,
        issues: [],
      },
    });

    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.generationSummary).toEqual({
      generatedCount: 42,
      pendingCount: 8,
    });
  });

  it("maps generation summary null when absent", () => {
    const section = createSection({ generationSummary: null });
    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.generationSummary).toBeNull();
  });

  it("extracts critical items from lines with isCritical flag", () => {
    const section = createSection({
      lines: [
        createLine({ budgetItemId: "item-1", itemCode: "01.01", description: "Critica A", isCritical: true, partial: 500, durationDays: 15, startDate: "2026-03-01", endDate: "2026-03-15" }),
        createLine({ budgetItemId: "item-2", itemCode: "01.02", description: "No critica", isCritical: false, partial: 200 }),
        createLine({ budgetItemId: "item-3", itemCode: "02.01", description: "Critica B", isCritical: true, partial: 300, durationDays: 20, startDate: "2026-03-16", endDate: "2026-04-05" }),
      ],
    });

    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.criticalItems).toHaveLength(2);
    expect(result.criticalItems[0]).toMatchObject({
      budgetItemId: "item-1",
      itemCode: "01.01",
      description: "Critica A",
      partial: 500,
      durationDays: 15,
      startDate: "2026-03-01",
      endDate: "2026-03-15",
    });
    expect(result.criticalItems[1]).toMatchObject({
      budgetItemId: "item-3",
      itemCode: "02.01",
      description: "Critica B",
      partial: 300,
      durationDays: 20,
      startDate: "2026-03-16",
      endDate: "2026-04-05",
    });
  });

  it("returns empty critical items array when no critical lines exist", () => {
    const section = createSection({
      lines: [
        createLine({ budgetItemId: "item-1", isCritical: false }),
        createLine({ budgetItemId: "item-2", isCritical: false }),
      ],
    });

    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.criticalItems).toHaveLength(0);
  });

  it("extracts simulation lines with positive duration only", () => {
    const section = createSection({
      lines: [
        createLine({ budgetItemId: "item-1", itemCode: "01.01", durationDays: 10, predecessor: null }),
        createLine({ budgetItemId: "item-2", itemCode: "01.02", durationDays: 0 }),
        createLine({ budgetItemId: "item-3", itemCode: "02.01", durationDays: 15, predecessor: "item-1" }),
        createLine({ budgetItemId: "item-4", itemCode: "02.02", durationDays: null }),
      ],
    });

    const result = buildRiskWorkScheduleSummary(section as any);

    expect(result.simulationLines).toHaveLength(2);
    expect(result.simulationLines[0]).toMatchObject({
      budgetItemId: "item-1",
      itemCode: "01.01",
      durationDays: 10,
      predecessor: null,
      subBudgetName: "Estructuras",
    });
    expect(result.simulationLines[1]).toMatchObject({
      budgetItemId: "item-3",
      itemCode: "02.01",
      durationDays: 15,
      predecessor: "item-1",
    });
  });

  it("flattens simulation lines across multiple groups", () => {
    const section = createSection({ lines: [] });
    const sectionWithTwoGroups = {
      ...section,
      groups: [
        {
          subBudgetId: "sub-1",
          subBudgetName: "Estructuras",
          totalAmount: 250,
          lines: [
            createLine({ budgetItemId: "item-a", durationDays: 5, subBudgetName: "Estructuras" }),
          ],
          rows: [],
        },
        {
          subBudgetId: "sub-2",
          subBudgetName: "Arquitectura",
          totalAmount: 300,
          lines: [
            createLine({ budgetItemId: "item-b", durationDays: 8, subBudgetName: "Arquitectura" }),
            createLine({ budgetItemId: "item-c", durationDays: 0, subBudgetName: "Arquitectura" }),
          ],
          rows: [],
        },
      ],
    };

    const result = buildRiskWorkScheduleSummary(sectionWithTwoGroups as any);

    expect(result.simulationLines).toHaveLength(2);
    expect(result.simulationLines[0].budgetItemId).toBe("item-a");
    expect(result.simulationLines[1].budgetItemId).toBe("item-b");
  });

  it("propagates subBudgetName from the group into critical items", () => {
    const section = createSection({ lines: [] });
    const sectionWithNamedGroup = {
      ...section,
      groups: [
        {
          subBudgetId: "sub-1",
          subBudgetName: "Instalaciones Sanitarias",
          totalAmount: 500,
          lines: [
            createLine({ budgetItemId: "item-s", isCritical: true, subBudgetName: "Instalaciones Sanitarias", partial: 500 }),
          ],
          rows: [],
        },
      ],
    };

    const result = buildRiskWorkScheduleSummary(sectionWithNamedGroup as any);

    expect(result.criticalItems[0].subBudgetName).toBe("Instalaciones Sanitarias");
  });
});
