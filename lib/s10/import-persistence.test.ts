import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertWithinPlanLimit: vi.fn(),
  companyFindFirst: vi.fn(),
  projectCreate: vi.fn(),
  resourceFindMany: vi.fn(),
  resourceCreate: vi.fn(),
  budgetCreate: vi.fn(),
  budgetLevelCreateMany: vi.fn(),
  budgetItemCreateMany: vi.fn(),
  budgetFooterRowCreateMany: vi.fn(),
  apuCreate: vi.fn(),
  apuResourceCreateMany: vi.fn(),
  transaction: vi.fn(),
  getUserSettings: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    company: {
      findFirst: mocks.companyFindFirst,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/billing/entitlements", () => ({
  assertWithinPlanLimit: mocks.assertWithinPlanLimit,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

import { importS10SnapshotToMyc } from "@/lib/s10/import-persistence";
import type { S10ExportSnapshot } from "@/lib/s10/import-mapper";

const snapshot: S10ExportSnapshot = {
  presupuestos: [
    {
      CodPresupuesto: "0302044",
      Descripcion: "I.E. MARIANO MELGAR - CONSOLIDADO",
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
  partidas: [
    {
      CodPresupuesto: "0302044",
      CodSubpresupuesto: "001",
      CodPartida: "900302120202",
      Descripcion: "CERCO PROVISIONAL",
      CodUnidad: "201",
      Precio1: 68.25,
    },
  ],
  subpresupuestoDetalles: [
    {
      CodPresupuesto: "0302044",
      CodSubpresupuesto: "001",
      Item: "01.01",
      Orden: "01.01",
      Secuencial: 1,
      CodPartida: "900302120202",
      CodPresupuestoPartida: "0302044",
      PropioPartida: "01",
      Descripcion: "CERCO PROVISIONAL",
      Unidad: "m",
      Metrado: 1,
      Precio1: 68.25,
      Parcial1: 68.25,
    },
  ],
  apuDetalles: [
    {
      CodPresupuesto: "0302044",
      CodSubpresupuesto: "001",
      CodPartida: "900302120202",
      CodPresupuestoPartida: "0302044",
      PropioPartida: "01",
      CodInsumo: "0147010100",
      Descripcion: "CAPATAZ",
      CodUnidad: "906",
      CodIndiceUnificado: "47",
      Cantidad: 1,
      Precio1: 68.25,
      Parcial1: 68.25,
      Tipo: "MO",
    },
  ],
  pieSubpresupuestos: [
    {
      CodPresupuesto: "0302044",
      CodSubpresupuesto: "001",
      Linea: "01",
      Descripcion: "COSTO DIRECTO",
      Variable: "NDIRECTO",
      Formula: "NDIRECTO",
    },
    {
      CodPresupuesto: "0302044",
      CodSubpresupuesto: "001",
      Linea: "02",
      Descripcion: "GASTOS GENERALES (12.5%)",
      Variable: "GG",
      Formula: "nDirecto*0.125",
    },
  ],
  resultadoPieSubpresupuestos: [
    {
      CodPresupuesto: "0302044",
      CodSubpresupuesto: "001",
      Linea: "01",
      Descripcion: "COSTO DIRECTO",
      Valor1: 68.25,
    },
    {
      CodPresupuesto: "0302044",
      CodSubpresupuesto: "001",
      Linea: "02",
      Descripcion: "GASTOS GENERALES (12.5%)",
      Valor1: 8.53,
    },
  ],
};

describe("importS10SnapshotToMyc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.companyFindFirst.mockResolvedValue({ id: "company-1" });
    mocks.assertWithinPlanLimit.mockResolvedValue(undefined);
    mocks.getUserSettings.mockResolvedValue({
      defaultIgvRate: 0.18,
      defaultGeneralExpensesRate: 0.1,
      defaultUtilityRate: 0.08,
    });
    mocks.projectCreate.mockResolvedValue({ id: "project-created", name: "I.E. MARIANO MELGAR - CONSOLIDADO" });
    mocks.resourceFindMany.mockResolvedValue([]);
    mocks.resourceCreate.mockResolvedValue({
      id: "resource-created",
      code: "0147010100",
      description: "CAPATAZ",
      category: "LABOR",
      unit: "hh",
      iu: "47",
      source: "S10",
      currency: "PEN",
    });
    mocks.budgetCreate
      .mockResolvedValueOnce({ id: "budget-general", kind: "GENERAL" })
      .mockResolvedValueOnce({ id: "budget-sub", kind: "SUB_BUDGET" });
    mocks.budgetLevelCreateMany.mockResolvedValue({ count: 1 });
    mocks.budgetItemCreateMany.mockResolvedValue({ count: 1 });
    mocks.budgetFooterRowCreateMany.mockResolvedValue({ count: 2 });
    mocks.apuCreate.mockResolvedValue({ id: "apu-created" });
    mocks.apuResourceCreateMany.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        project: { create: mocks.projectCreate },
        resource: { findMany: mocks.resourceFindMany, create: mocks.resourceCreate },
        budget: { create: mocks.budgetCreate },
        budgetLevel: { createMany: mocks.budgetLevelCreateMany },
        budgetItem: { createMany: mocks.budgetItemCreateMany },
        budgetFooterRow: { createMany: mocks.budgetFooterRowCreateMany },
        apu: { create: mocks.apuCreate },
        apuResource: { createMany: mocks.apuResourceCreateMany },
      }),
    );
  });

  it("persists an S10 snapshot as a new MYC project with budgets, resources and APUs", async () => {
    const result = await importS10SnapshotToMyc("user-1", snapshot, {
      budgetCode: "0302044",
      companyId: "company-1",
    });

    expect(mocks.companyFindFirst).toHaveBeenCalledWith({
      where: { id: "company-1", userId: "user-1" },
      select: { id: true },
    });
    expect(mocks.assertWithinPlanLimit).toHaveBeenCalledWith({ userId: "user-1", resource: "projects" });
    expect(mocks.assertWithinPlanLimit).toHaveBeenCalledWith({ userId: "user-1", resource: "budgets" });
    expect(mocks.projectCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        name: "I.E. MARIANO MELGAR - CONSOLIDADO",
        projectType: "Importado S10",
      }),
    });
    expect(mocks.resourceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        code: "0147010100",
        description: "CAPATAZ",
        category: "LABOR",
        unit: "hh",
        source: "S10",
      }),
    });
    expect(mocks.budgetCreate).toHaveBeenCalledTimes(2);
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          generalExpensesRate: expect.closeTo(0.125, 4),
          utilityRate: 0.08,
        }),
      }),
    );
    expect(mocks.budgetFooterRowCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          budgetId: "budget-sub",
          variable: "GG",
          description: "GASTOS GENERALES (12.5%)",
          formula: null,
          manualValue: 8.53,
        }),
      ]),
    });
    expect(mocks.budgetItemCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          budgetId: "budget-sub",
          code: "01.01",
          description: "CERCO PROVISIONAL",
          unitPrice: 68.25,
        }),
      ],
    });
    expect(mocks.apuCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        budgetItemId: expect.any(String),
        name: "CERCO PROVISIONAL",
        totalUnitCost: 68.25,
      }),
    });
    expect(mocks.apuResourceCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          apuId: "apu-created",
          resourceId: "resource-created",
          resourceType: "LABOR",
          unitPrice: 68.25,
          subtotal: 68.25,
        }),
      ],
    });
    expect(result).toEqual({
      projectId: "project-created",
      projectName: "I.E. MARIANO MELGAR - CONSOLIDADO",
      generalBudgetId: "budget-general",
      subBudgetIds: ["budget-sub"],
      resourceCount: 1,
      budgetCount: 2,
      itemCount: 1,
      apuCount: 1,
    });
  });

  it("rejects imports for companies the user does not own", async () => {
    mocks.companyFindFirst.mockResolvedValue(null);

    await expect(
      importS10SnapshotToMyc("user-1", snapshot, {
        companyId: "company-2",
      }),
    ).rejects.toThrow("No puedes importar S10 en una empresa que no te pertenece");
  });
});
