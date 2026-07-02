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
  saveRiskVariables: vi.fn(),
}));

import { PUT } from "@/app/api/budgets/[id]/risk-analysis/variables/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { saveRiskVariables } from "@/lib/risk/data";

describe("risk analysis variables route", () => {
  it("saves variables and returns payload for authenticated user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskVariables).mockResolvedValue({
      budget: { id: "budget-1", projectId: "project-1", name: "Test", kind: "SUB_BUDGET", currency: "PEN", baseTotal: 1000 },
      items: [],
      variables: [
        {
          id: "risk-1",
          budgetId: "budget-1",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 8,
          mostLikely: 10,
          maximum: 12,
          enabled: true,
        },
      ],
      correlations: [],
      latestRun: null,
    });

    const body = {
      variables: [
        {
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 8,
          mostLikely: 10,
          maximum: 12,
          enabled: true,
        },
      ],
    };

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.variables).toHaveLength(1);
    expect(result.variables[0].minimum).toBe(8);
    expect(saveRiskVariables).toHaveBeenCalledWith("budget-1", "user-1", body);
  });

  it("saves delete flag to remove a variable", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskVariables).mockResolvedValue({
      budget: { id: "budget-1", projectId: "project-1", name: "Test", kind: "SUB_BUDGET", currency: "PEN", baseTotal: 1000 },
      items: [],
      variables: [],
      correlations: [],
      latestRun: null,
    });

    const body = {
      variables: [
        {
          id: "risk-to-delete",
          budgetItemId: "item-1",
          variableType: "QUANTITY",
          distributionType: "TRIANGULAR",
          minimum: 8,
          mostLikely: 10,
          maximum: 12,
          enabled: true,
          delete: true,
        },
      ],
    };

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(200);
    expect(saveRiskVariables).toHaveBeenCalledWith("budget-1", "user-1", body);
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify({ variables: [] }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    const result = await response.json();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("checks feature access before saving", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskVariables).mockResolvedValue({
      budget: { id: "budget-1", projectId: "project-1", name: "Test", kind: "SUB_BUDGET", currency: "PEN", baseTotal: 1000 },
      items: [],
      variables: [],
      correlations: [],
      latestRun: null,
    });

    const body = { variables: [] };

    await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "risk_analysis" });
  });

  it("returns 400 when saveRiskVariables throws generic error", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskVariables).mockRejectedValue(new Error("La partida no pertenece al alcance"));

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify({ variables: [] }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toContain("La partida no pertenece al alcance");
  });

  it("returns 400 with ZodError message for invalid variables", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const { ZodError } = await import("zod");
    const zodError = new ZodError([
      { code: "custom", message: "El minimo no puede ser mayor que el valor probable.", path: ["minimum"] },
    ]);
    vi.mocked(saveRiskVariables).mockRejectedValue(zodError);

    const response = await PUT(
      new Request("http://localhost", { method: "PUT", body: JSON.stringify({ variables: [] }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe("El minimo no puede ser mayor que el valor probable.");
  });
});
