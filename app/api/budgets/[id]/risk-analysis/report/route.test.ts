import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  assertFeatureAccess: vi.fn().mockResolvedValue({
    availableFeatures: ["risk_analysis"],
    budgetLimit: null,
    budgetUsage: 0,
    isInGracePeriod: false,
    planName: "Pro",
    planSlug: "pro",
    projectLimit: null,
    projectUsage: 0,
  } as import("@/lib/billing/entitlements").EffectiveUserLicense),
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: vi.fn().mockResolvedValue({
    currencyDecimals: 2,
    defaultCurrency: "PEN",
    dateFormat: "DD_MMM_YYYY",
    defaultViewMode: "modern",
    excelShowFieldBorders: false,
    excelRowHeight: 40,
    defaultIgvRate: 0.18,
    defaultGeneralExpensesRate: 0.1,
    defaultUtilityRate: 0.08,
    defaultSubBudgetNames: [],
    aiProviderPreference: "auto",
    floatingKhipuProvider: "ollama",
    floatingKhipuWidth: 600,
    floatingKhipuHeight: 500,
    floatingKhipuFontSize: "normal",
    floatingKhipuPosition: "bottom-right",
    floatingKhipuTheme: "light",
  } as import("@/types/settings").UserSettingsRecord),
}));

vi.mock("@/lib/risk/data", () => ({
  getRiskAnalysisPayload: vi.fn(),
}));

vi.mock("@/lib/risk/pdf-report", () => ({
  createRiskAnalysisPdf: vi.fn(),
}));

import { GET } from "@/app/api/budgets/[id]/risk-analysis/report/route";
import { getAuthSession } from "@/lib/auth/session";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { createRiskAnalysisPdf } from "@/lib/risk/pdf-report";

describe("risk analysis report route", () => {
  it("exports the latest simulation as pdf", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getRiskAnalysisPayload).mockResolvedValue(createPayload());
    vi.mocked(createRiskAnalysisPdf).mockResolvedValue(Buffer.from("pdf"));

    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "budget-1" }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("riesgo-montecarlo-budget-1.pdf");
    expect(createRiskAnalysisPdf).toHaveBeenCalledWith(expect.objectContaining({ budget: expect.objectContaining({ id: "budget-1" }) }), 2);
  });

  it("rejects export when there is no current simulation", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getRiskAnalysisPayload).mockResolvedValue({ ...createPayload(), latestRun: null });

    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "budget-1" }) });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Ejecuta una simulacion vigente antes de exportar el PDF." });
  });
});

function createPayload() {
  return {
    budget: {
      id: "budget-1",
      projectId: "project-1",
      name: "Presupuesto General",
      kind: "GENERAL" as const,
      currency: "PEN",
      baseTotal: 1000,
    },
    items: [
      {
        itemId: "item-1",
        budgetId: "child-1",
        sourceBudgetName: "Estructuras",
        code: "01.01",
        description: "Excavacion",
        unit: "m3",
        baseQuantity: 10,
        unitPrice: 100,
        baseTotal: 1000,
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ],
    variables: [
      {
        id: "risk-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        variableType: "QUANTITY" as const,
        distributionType: "TRIANGULAR" as const,
        minimum: 8,
        mostLikely: 10,
        maximum: 12,
        enabled: true,
      },
    ],
    correlations: [],
    latestRun: {
      budgetId: "budget-1",
      iterations: 10000,
      baseTotal: 1000,
      mean: 1040,
      median: 1030,
      variance: 225,
      standardDeviation: 15,
      skewness: 0.2,
      kurtosis: -0.1,
      p10: 990,
      p50: 1030,
      p80: 1080,
      p90: 1100,
      p95: 1115,
      histogramBins: [{ min: 980, max: 1000, midpoint: 990, frequency: 1000, probability: 0.1 }],
      sCurvePoints: [{ cost: 1000, cumulativeProbability: 0.5 }],
      scheduleDuration: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    },
  };
}
