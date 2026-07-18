import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  assertFeatureAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/billing/api", () => ({
  createBillingErrorResponse: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/risk/data", () => ({
  getRiskAnalysisPayload: vi.fn(),
}));

vi.mock("@/lib/risk/suggestions", () => ({
  suggestRiskVariables: vi.fn(),
}));

import { POST } from "@/app/api/budgets/[id]/risk-analysis/suggestions/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { getRiskAnalysisPayload } from "@/lib/risk/data";
import { suggestRiskVariables } from "@/lib/risk/suggestions";
import type { RiskAnalysisPayload } from "@/types/risk";

const riskPayload: RiskAnalysisPayload = {
  budget: {
    id: "budget-1",
    projectId: "project-1",
    name: "Obra",
    kind: "SUB_BUDGET",
    currency: "PEN",
    baseTotal: 1000,
  },
  items: [],
  variables: [],
  correlations: [],
  latestRun: null,
};

describe("risk suggestions route", () => {
  it("returns suggestions for authenticated users", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getRiskAnalysisPayload).mockResolvedValue(riskPayload);
    vi.mocked(suggestRiskVariables).mockReturnValue([
      {
        id: "suggestion-1",
        budgetId: "budget-1",
        budgetItemId: "item-1",
        variableType: "QUANTITY",
        distributionType: "PERT",
        minimum: 9.5,
        mostLikely: 10,
        maximum: 11,
        confidence: 0.82,
        reason: "Partida de alto impacto.",
        source: "HEURISTIC",
        impactScore: 1000,
      },
    ]);

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ strategy: "balanced", maxSuggestions: 12 }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.suggestions).toHaveLength(1);
    expect(getRiskAnalysisPayload).toHaveBeenCalledWith("budget-1", "user-1");
    expect(suggestRiskVariables).toHaveBeenCalledWith({
      payload: riskPayload,
      workScheduleSummary: null,
      strategy: "balanced",
      maxSuggestions: 12,
    });
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("checks feature access before building suggestions", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(getRiskAnalysisPayload).mockResolvedValue(riskPayload);
    vi.mocked(suggestRiskVariables).mockReturnValue([]);

    await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "risk_analysis" });
  });

  it("returns 400 for invalid suggestion options", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ strategy: "balanced", maxSuggestions: 0 }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBeTruthy();
  });
});
