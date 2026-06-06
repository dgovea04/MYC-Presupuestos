import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  importS10SnapshotToMyc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: mocks.getAuthSession,
}));

vi.mock("@/lib/s10/import-persistence", () => ({
  importS10SnapshotToMyc: mocks.importS10SnapshotToMyc,
}));

import { POST } from "@/app/api/imports/s10/import/route";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

const snapshot: S10ExportSnapshot = {
  presupuestos: [
    {
      CodPresupuesto: "0302044",
      Descripcion: "OBRA S10",
      Moneda: "S/.",
      CostoOferta1: 100,
    },
  ],
  subpresupuestos: [
    {
      CodPresupuesto: "0302044",
      CodSubpresupuesto: "001",
      Descripcion: "ESTRUCTURAS",
    },
  ],
  partidas: [],
  apuDetalles: [],
};

describe("S10 import route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.importS10SnapshotToMyc.mockResolvedValue({
      projectId: "project-1",
      projectName: "OBRA S10",
      generalBudgetId: "budget-1",
      subBudgetIds: ["budget-2"],
      resourceCount: 1,
      budgetCount: 2,
      itemCount: 1,
      apuCount: 1,
    });
  });

  it("rejects unauthenticated requests", async () => {
    mocks.getAuthSession.mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/imports/s10/import", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autorizado" });
  });

  it("imports a snapshot JSON body into MYC", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot, budgetCode: "0302044", companyId: "company-1" }),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.importS10SnapshotToMyc).toHaveBeenCalledWith("user-1", snapshot, {
      budgetCode: "0302044",
      companyId: "company-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/budgets");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/projects/project-1");
    await expect(response.json()).resolves.toMatchObject({
      projectId: "project-1",
      generalBudgetId: "budget-1",
    });
  });

  it("requires a company id", async () => {
    mocks.getAuthSession.mockResolvedValue({ user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost/api/imports/s10/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot, budgetCode: "0302044" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Selecciona la empresa donde se importara el proyecto S10." });
  });
});
