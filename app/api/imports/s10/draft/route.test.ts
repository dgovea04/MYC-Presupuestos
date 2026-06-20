import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/session", () => ({
  getAuthSession: vi.fn(),
}));

import { POST } from "@/app/api/imports/s10/draft/route";
import { getAuthSession } from "@/lib/auth/session";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

const snapshot: S10ExportSnapshot = {
  presupuestos: [
    {
      CodPresupuesto: "0201003",
      Descripcion: "OBRA S10",
      Moneda: "S/.",
      CostoOferta1: 100,
    },
  ],
  subpresupuestos: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      Descripcion: "ESTRUCTURAS",
    },
  ],
  partidas: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      CodPartida: "01",
      Descripcion: "EXCAVACION",
      CodUnidad: "601",
      Precio1: 12,
      RendimientoMO: 1,
      RendimientoEQ: 1,
    },
  ],
  apuDetalles: [
    {
      CodPresupuesto: "0201003",
      CodSubpresupuesto: "001",
      CodPartida: "01",
      CodInsumo: "0147010001",
      Descripcion: "PEON",
      CodUnidad: "906",
      CodIndiceUnificado: "47",
      Cantidad: 1,
      Precio1: 12,
      Parcial1: 12,
      Tipo: "MO",
    },
  ],
};

describe("S10 draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthenticated requests", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const response = await POST(new Request("http://localhost/api/imports/s10/draft", { method: "POST" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "No autorizado" });
  });

  it("returns a compact import preview for JSON request bodies", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost/api/imports/s10/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot, budgetCode: "0201003" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      source: "S10",
      sourceBudgetCode: "0201003",
      projectName: "OBRA S10",
      resourceCount: 1,
      budgets: [
        { kind: "GENERAL", itemCount: 1 },
        { kind: "SUB_BUDGET", itemCount: 1 },
      ],
      sampleItems: [{ code: "01", unit: "m3" }],
    });
  });

  it("returns a compact import preview for uploaded JSON snapshots", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });
    const formData = new FormData();
    formData.set("file", new File([`\uFEFF${JSON.stringify(snapshot)}`], "s10-export.json", { type: "application/json" }));
    formData.set("budgetCode", "0201003");

    const response = await POST(
      new Request("http://localhost/api/imports/s10/draft", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      projectName: "OBRA S10",
      resourcesByCategory: { LABOR: 1 },
    });
  });

  it("rejects invalid snapshot payloads", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ expires: new Date().toISOString(), user: { id: "user-1" } });

    const response = await POST(
      new Request("http://localhost/api/imports/s10/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshot: { presupuestos: [] } }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "El JSON no tiene la estructura esperada de un snapshot S10." });
  });
});
