import { beforeEach, describe, expect, it, vi } from "vitest";

import { importPdfAiDraftToMyc } from "./import-persistence";
import type { PdfAiImportDraft } from "./types";

const mocks = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn(),
  },
  assertWithinPlanLimit: vi.fn(),
  assertWorkspaceMembership: vi.fn(),
  getUserSettings: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("@/lib/billing/entitlements", () => ({
  assertWithinPlanLimit: mocks.assertWithinPlanLimit,
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: mocks.assertWorkspaceMembership,
}));

vi.mock("@/lib/data/settings", () => ({
  getUserSettings: mocks.getUserSettings,
}));

describe("pdf import persistence", () => {
  beforeEach(() => {
    mocks.prisma.$transaction.mockReset();
    mocks.assertWithinPlanLimit.mockReset();
    mocks.assertWorkspaceMembership.mockReset();
    mocks.getUserSettings.mockReset();
    mocks.assertWithinPlanLimit.mockResolvedValue(undefined);
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.getUserSettings.mockResolvedValue({ defaultIgvRate: 0.18, defaultGeneralExpensesRate: 0.1, defaultUtilityRate: 0.08 });
  });

  it("blocks drafts with critical validations", async () => {
    const draft = createDraft();
    draft.validations.push({ id: "validation-1", severity: "error", code: "PRICE_MISMATCH", message: "Diferencia", entityId: "item-1" });

    await expect(importPdfAiDraftToMyc("user-1", draft, { companyId: "company-1" })).rejects.toThrow("errores criticos");
  });

  it("does not block critical validations that have human approval", async () => {
    const tx = createTransactionMock();
    mocks.prisma.$transaction.mockImplementation(async (handler: (client: typeof tx) => Promise<unknown>) => handler(tx));
    const draft = createDraft();
    draft.validations.push({ id: "validation-1", severity: "error", code: "PRICE_MISMATCH", message: "Diferencia", entityId: "item-1" });
    draft.reviewApprovals = [
      {
        id: "approval-1",
        validationCode: "PRICE_MISMATCH",
        entityId: "item-1",
        reason: "Diferencia aceptada por revision humana.",
      },
    ];

    await expect(importPdfAiDraftToMyc("user-1", draft, { companyId: "company-1" })).resolves.toMatchObject({ projectId: "project-1" });
  });

  it("persists a reviewed PDF draft in a transaction", async () => {
    const tx = createTransactionMock();
    mocks.prisma.$transaction.mockImplementation(async (handler: (client: typeof tx) => Promise<unknown>) => handler(tx));

    const result = await importPdfAiDraftToMyc("user-1", createDraft(), { companyId: "company-1" });

    expect(result).toMatchObject({ projectId: "project-1", generalBudgetId: "budget-1", itemCount: 1, apuCount: 1 });
    expect(tx.project.create).toHaveBeenCalled();
    expect(tx.budget.create).toHaveBeenCalled();
    expect(tx.budgetItem.createMany).toHaveBeenCalled();
    expect(tx.apu.create).toHaveBeenCalled();
    expect(tx.apuResource.createMany).toHaveBeenCalled();
  });

  it("persists subpartidas as catalog partidas and links APU rows to them", async () => {
    const tx = createTransactionMock();
    mocks.prisma.$transaction.mockImplementation(async (handler: (client: typeof tx) => Promise<unknown>) => handler(tx));
    const draft = createDraft();
    draft.apus[0]!.rows[0]!.description = "Preparacion de concreto fc 210";
    draft.apus[0]!.rows[0]!.unit = "m3";
    draft.apus[0]!.rows[0]!.resourceType = "SUBPARTIDA";
    draft.subpartidas.push({
      id: "subpartida-1",
      code: "SP-01",
      description: "Preparacion de concreto fc 210",
      unit: "m3",
      unitPrice: "120",
      performance: "1",
      rows: [
        {
          id: "sub-row-1",
          description: "Cemento portland",
          unit: "bol",
          resourceType: "MATERIAL",
          quantity: "8",
          unitPrice: "15",
          subtotal: "120",
          sortOrder: 1,
          evidence: draft.apus[0]!.evidence,
        },
      ],
      evidence: draft.apus[0]!.evidence,
    });
    draft.links.push({
      id: "link-sub-1",
      fromId: "row-1",
      toId: "subpartida-1",
      kind: "APU_SUBPARTIDA",
      status: "MATCHED",
      confidence: 0.9,
      reason: "ok",
    });

    await importPdfAiDraftToMyc("user-1", draft, { companyId: "company-1" });

    expect(tx.catalogPartida.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: "Preparacion de concreto fc 210",
          unit: "m3",
        }),
      }),
    );
    expect(tx.partidaApuRow.createMany).toHaveBeenCalled();
    expect(tx.apuResource.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          catalogPartidaId: "catalog-1",
          nestedApuRows: expect.any(Array),
        }),
      ],
    });
  });
});

function createTransactionMock() {
  return {
    project: { create: vi.fn().mockResolvedValue({ id: "project-1", name: "Proyecto PDF" }) },
    resource: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: "resource-1" }) },
    budget: { create: vi.fn().mockResolvedValue({ id: "budget-1" }) },
    budgetLevel: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    budgetItem: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    apu: { create: vi.fn().mockResolvedValue({ id: "apu-1" }) },
    apuResource: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    catalogPartida: { create: vi.fn().mockResolvedValue({ id: "catalog-1" }) },
    partidaApuRow: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
}

function createDraft(): PdfAiImportDraft {
  const evidence = { sourceFileName: "presupuesto.pdf", sourcePage: 1, rawText: "linea", confidence: 0.9 };
  return {
    source: "PDF_AI",
    project: { name: "Proyecto PDF", currency: "PEN" },
    sourceFiles: [{ id: "file-1", fileName: "presupuesto.pdf", role: "BUDGET", pageCount: 1, confidence: 0.9 }],
    budgets: [
      {
        id: "budget-draft",
        name: "Presupuesto importado",
        kind: "SUB_BUDGET",
        currency: "PEN",
        levels: [],
        items: [
          {
            id: "item-1",
            code: "01.01",
            description: "Trazo",
            unit: "m2",
            quantity: "10",
            unitPrice: "2.5",
            partial: "25",
            sortOrder: 1,
            evidence,
          },
        ],
      },
    ],
    apus: [
      {
        id: "apu-1",
        budgetItemCode: "01.01",
        name: "Trazo",
        unit: "m2",
        performance: "1",
        totalUnitCost: "2.5",
        rows: [
          {
            id: "row-1",
            description: "Mano de obra",
            unit: "hh",
            resourceType: "LABOR",
            quantity: "1",
            unitPrice: "2.5",
            subtotal: "2.5",
            sortOrder: 1,
            evidence,
          },
        ],
        evidence,
      },
    ],
    subpartidas: [],
    resources: [
      {
        id: "resource-1",
        code: "",
        description: "Mano de obra",
        category: "LABOR",
        unit: "hh",
        unitPrice: "2.5",
        currency: "PEN",
        evidence,
      },
    ],
    links: [{ id: "link-1", fromId: "item-1", toId: "apu-1", kind: "BUDGET_ITEM_APU", status: "MATCHED", confidence: 0.9, reason: "ok" }],
    validations: [],
    warnings: [],
  };
}
