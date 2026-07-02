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
  saveRiskSimulationRun: vi.fn(),
}));

import { POST } from "@/app/api/budgets/[id]/risk-analysis/runs/route";
import { getAuthSession } from "@/lib/auth/session";
import { assertFeatureAccess } from "@/lib/billing/entitlements";
import { saveRiskSimulationRun } from "@/lib/risk/data";
import { MONTE_CARLO_ITERATIONS } from "@/types/risk";

describe("risk analysis runs route", () => {
  it("saves simulation run and returns summary with 201 for authenticated user", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskSimulationRun).mockResolvedValue({
      id: "run-1",
      budgetId: "budget-1",
      iterations: MONTE_CARLO_ITERATIONS,
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
      histogramBins: [],
      sCurvePoints: [],
      scheduleDuration: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    });

    const body = { iterations: MONTE_CARLO_ITERATIONS };

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result.id).toBe("run-1");
    expect(result.mean).toBe(1040);
    expect(saveRiskSimulationRun).toHaveBeenCalledWith("budget-1", "user-1", body);
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ iterations: MONTE_CARLO_ITERATIONS }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(401);
    const result = await response.json();
    expect(result).toEqual({ error: "Unauthorized" });
  });

  it("checks feature access before saving", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskSimulationRun).mockResolvedValue({
      id: "run-1",
      budgetId: "budget-1",
      iterations: MONTE_CARLO_ITERATIONS,
      baseTotal: 1000,
      mean: 1000,
      median: 1000,
      variance: 0,
      standardDeviation: 0,
      skewness: 0,
      kurtosis: 0,
      p10: 1000,
      p50: 1000,
      p80: 1000,
      p90: 1000,
      p95: 1000,
      histogramBins: [],
      sCurvePoints: [],
      scheduleDuration: null,
    });

    const body = { iterations: MONTE_CARLO_ITERATIONS };

    await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(assertFeatureAccess).toHaveBeenCalledWith({ userId: "user-1", feature: "risk_analysis" });
  });

  it("returns 400 when saveRiskSimulationRun throws generic error", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    vi.mocked(saveRiskSimulationRun).mockRejectedValue(new Error("No tienes permisos para guardar esta simulacion."));

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ iterations: MONTE_CARLO_ITERATIONS }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toContain("No tienes permisos");
  });

  it("returns 400 with ZodError message for invalid input", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const { ZodError } = await import("zod");
    const zodError = new ZodError([
      { code: "custom", message: "Los datos de la simulacion no son validos", path: ["iterations"] },
    ]);
    vi.mocked(saveRiskSimulationRun).mockRejectedValue(zodError);

    const response = await POST(
      new Request("http://localhost", { method: "POST", body: JSON.stringify({ iterations: 999 }) }),
      { params: Promise.resolve({ id: "budget-1" }) },
    );

    expect(response.status).toBe(400);
    const result = await response.json();
    expect(result.error).toBe("Los datos de la simulacion no son validos");
  });
});
