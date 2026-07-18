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

vi.mock("@/lib/risk/scenarios", () => ({
  saveRiskScenario: vi.fn(),
}));

import { POST } from "@/app/api/budgets/[id]/risk-analysis/scenarios/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { saveRiskScenario } from "@/lib/risk/scenarios";

describe("risk scenarios route", () => {
  it("saves an approved scenario for authenticated users", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskScenario).mockResolvedValue({
      id: "scenario-1",
      budgetId: "budget-1",
      name: "Escenario Khipu",
      description: "Riesgos sugeridos",
      source: "AGENT",
      status: "APPROVED",
      createdByUserId: "user-1",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    });

    const body = {
      name: "Escenario Khipu",
      description: "Riesgos sugeridos",
      variables: [
        {
          id: "suggestion-1",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "PERT",
          minimum: 9.5,
          mostLikely: 10,
          maximum: 11,
          enabled: true,
          source: "HEURISTIC",
          confidence: 0.82,
          rationale: "Partida de alto impacto.",
        },
      ],
      correlations: [],
    };

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.id).toBe("scenario-1");
    expect(saveRiskScenario).toHaveBeenCalledWith("budget-1", "user-1", {
      ...body,
      description: "Riesgos sugeridos",
      source: "AGENT",
      status: "APPROVED",
    });
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ variables: [] }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("checks feature access before saving scenarios", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskScenario).mockResolvedValue({
      id: "scenario-1",
      budgetId: "budget-1",
      name: "Escenario",
      description: null,
      source: "AGENT",
      status: "APPROVED",
      createdByUserId: "user-1",
      createdAt: "2026-07-17T00:00:00.000Z",
      updatedAt: "2026-07-17T00:00:00.000Z",
    });

    await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "Escenario", variables: [], correlations: [] }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "risk_analysis" });
  });

  it("returns 400 for invalid scenario input", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ name: "", variables: [], correlations: [] }),
      }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBeTruthy();
  });
});
