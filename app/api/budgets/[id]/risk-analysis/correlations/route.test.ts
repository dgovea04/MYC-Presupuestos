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
  saveRiskCorrelations: vi.fn(),
}));

import { PUT } from "@/app/api/budgets/[id]/risk-analysis/correlations/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { saveRiskCorrelations } from "@/lib/risk/data";

describe("risk analysis correlations route", () => {
  it("saves correlations and returns payload for authenticated user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskCorrelations).mockResolvedValue({
      budget: { id: "budget-1", projectId: "project-1", name: "Test", kind: "SUB_BUDGET", currency: "PEN", baseTotal: 1000 },
      items: [],
      variables: [],
      correlations: [
        {
          id: "corr-1",
          budgetId: "budget-1",
          sourceVariableId: "risk-1",
          targetVariableId: "risk-2",
          coefficient: 0.65,
        },
      ],
      latestRun: null,
    });

    const body = {
      correlations: [
        {
          sourceVariableId: "risk-1",
          targetVariableId: "risk-2",
          coefficient: 0.65,
        },
      ],
    };

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.correlations).toHaveLength(1);
    expect(result.correlations[0].coefficient).toBe(0.65);
    expect(saveRiskCorrelations).toHaveBeenCalledWith("budget-1", "user-1", body);
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify({ correlations: [] }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    const result = await response.json();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("checks feature access before saving", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskCorrelations).mockResolvedValue({
      budget: { id: "budget-1", projectId: "project-1", name: "Test", kind: "SUB_BUDGET", currency: "PEN", baseTotal: 1000 },
      items: [],
      variables: [],
      correlations: [],
      latestRun: null,
    });

    const body = { correlations: [] };

    await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "risk_analysis" });
  });

  it("returns 400 when saveRiskCorrelations throws", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskCorrelations).mockRejectedValue(new Error("Variables fuera de alcance"));

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify({ correlations: [] }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toContain("Variables fuera de alcance");
  });

  it("propagates ZodError messages as 400", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const { ZodError } = await import("zod");
    const zodError = new ZodError([
      { code: "custom", message: "Una correlacion requiere dos variables distintas.", path: ["targetVariableId"] },
    ]);
    vi.mocked(saveRiskCorrelations).mockRejectedValue(zodError);

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify({ correlations: [] }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe("Una correlacion requiere dos variables distintas.");
  });
});
