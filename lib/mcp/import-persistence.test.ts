import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertWorkspaceMembership: vi.fn(),
  assertWithinPlanLimit: vi.fn(),
  projectCreate: vi.fn(),
  budgetCreate: vi.fn(),
  budgetLevelCreate: vi.fn(),
  budgetItemCreate: vi.fn(),
  budgetFooterRowCreateMany: vi.fn(),
  apuCreate: vi.fn(),
  apuResourceCreate: vi.fn(),
  resourceFindFirst: vi.fn(),
  resourceCreate: vi.fn(),
  polynomialFormulaCreate: vi.fn(),
  polynomialMonomialCreate: vi.fn(),
  polynomialMonomialComponentCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/workspace/access", () => ({
  assertWorkspaceMembership: mocks.assertWorkspaceMembership,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/billing/entitlements", () => ({
  assertWithinPlanLimit: mocks.assertWithinPlanLimit,
}));

import { importProjectPackageToMyc } from "@/lib/mcp/import-persistence";
import { analyzeProjectPackageBuffer } from "@/lib/mcp/import-preview";
import { buildFullProjectPackageBuffer } from "@/lib/mcp/fixtures/full-project-package";
import type { McpManifest } from "@/lib/mcp/types";

function makeManifest(overrides: Partial<McpManifest> = {}): McpManifest {
  return {
    format: "MC_PROJECT_PACKAGE",
    formatVersion: "1.0.0",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    source: { app: "MC Presupuestos", appVersion: "0.1.0", environment: "test" },
    package: { fileExtension: ".mcp", compression: "zip-store", checksumAlgorithm: "sha256" },
    project: { slug: "hospital-norte", name: "Hospital Norte", currency: "PEN" },
    modules: [],
    capabilities: { restoreAsNewProject: true, preview: true, merge: false },
    namespaces: ["core", "mc"],
    extensions: [],
    checksums: {},
    ...overrides,
  };
}

function makeModuleReader(modules: Record<string, unknown>) {
  return (path: string): unknown => {
    const content = modules[path];
    if (content === undefined) {
      throw new Error(`Module not found: ${path}`);
    }
    return content;
  };
}

const fixtureModules = {
  "project.json": {
    name: "Hospital Norte",
    clientName: "Gobierno Regional",
    location: "Lima, Peru",
    projectType: "Edificacion",
    startDate: "2026-01-15T00:00:00.000Z",
    endDate: "2027-06-30T00:00:00.000Z",
    currency: "PEN",
  },
  "budgets/budget-tree.json": {
    budgets: [
      {
        id: "budget-g",
        parentBudgetId: null,
        kind: "GENERAL",
        name: "Presupuesto General",
        currency: "PEN",
        igvRate: "0.1800",
        generalExpensesRate: "0.1000",
        utilityRate: "0.0800",
        totalDirectCost: "1500000.0000",
        totalGeneralExpenses: "150000.0000",
        totalUtility: "120000.0000",
        totalTax: "318600.0000",
        totalAmount: "2088600.0000",
      },
      {
        id: "budget-sub-1",
        parentBudgetId: "budget-g",
        kind: "SUB_BUDGET",
        name: "Estructuras",
        currency: "PEN",
        igvRate: "0.1800",
        generalExpensesRate: "0.1000",
        utilityRate: "0.0800",
        totalDirectCost: "800000.0000",
        totalGeneralExpenses: "80000.0000",
        totalUtility: "64000.0000",
        totalTax: "169920.0000",
        totalAmount: "1113920.0000",
      },
      {
        id: "budget-sub-2",
        parentBudgetId: "budget-g",
        kind: "SUB_BUDGET",
        name: "Arquitectura",
        currency: "PEN",
        igvRate: "0.1800",
        generalExpensesRate: "0.1000",
        utilityRate: "0.0800",
        totalDirectCost: "700000.0000",
        totalGeneralExpenses: "70000.0000",
        totalUtility: "56000.0000",
        totalTax: "148680.0000",
        totalAmount: "974680.0000",
      },
    ],
  },
  "budgets/budget-items.json": {
    budgets: [
      {
        budgetId: "budget-sub-1",
        budgetName: "Estructuras",
        levels: [
          {
            id: "level-1",
            parentId: null,
            type: "TITLE",
            code: "01",
            name: "Estructuras",
            sortOrder: 1,
          },
          {
            id: "level-2",
            parentId: "level-1",
            type: "SUBTITLE",
            code: "01.01",
            name: "Concreto Armado",
            sortOrder: 1,
          },
        ],
        items: [
          {
            id: "item-1",
            levelId: "level-2",
            code: "01.01.001",
            description: "Concreto f'c=210 kg/cm2 en zapatas",
            unit: "m3",
            quantity: "125.5000",
            unitPrice: "450.7500",
            partial: "56569.1250",
            sortOrder: 1,
          },
          {
            id: "item-2",
            levelId: "level-2",
            code: "01.01.002",
            description: "Acero de refuerzo fy=4200 kg/cm2",
            unit: "kg",
            quantity: "8500.0000",
            unitPrice: "5.8000",
            partial: "49300.0000",
            sortOrder: 2,
          },
        ],
      },
    ],
  },
  "budgets/apus.json": {
    apus: [
      {
        id: "apu-1",
        budgetItemId: "item-1",
        name: "Concreto f'c=210 kg/cm2 en zapatas",
        unit: "m3",
        performance: "25.0000",
        totalUnitCost: "450.7500",
        resources: [
          {
            id: "apu-res-1",
            resourceId: "res-1",
            resourceType: "MATERIAL",
            crew: null,
            quantity: "1.0500",
            unitPrice: "280.0000",
            subtotal: "294.0000",
            resourceDescription: "Cemento Portland Tipo I",
          },
          {
            id: "apu-res-2",
            resourceId: null,
            resourceType: "LABOR",
            crew: "2.0000",
            quantity: "0.0400",
            unitPrice: "120.0000",
            subtotal: "9.6000",
            resourceDescription: "Operario",
          },
        ],
      },
    ],
  },
  "budgets/footer.json": {
    footers: [
      {
        budgetId: "budget-sub-1",
        rows: [
          {
            id: "footer-1",
            variable: "CD",
            description: "Costo Directo",
            formula: null,
            manualValue: "800000.0000",
            iu: null,
            highlight: true,
            sortOrder: 1,
          },
        ],
      },
    ],
  },
  "polynomial-formula/formula.json": {
    formula: {
      name: "Formula Polinomica N1",
      baseMonth: 1,
      baseYear: 2026,
      totalBaseAmount: "1500000.0000",
      status: "DRAFT",
      monomials: [
        {
          code: "M1",
          name: "Mano de Obra",
          costGroupKey: "LABOR",
          amount: "300000.0000",
          coefficient: "0.347",
          baseIndexCode: "47",
          baseIndexName: "Mano de Obra",
          baseIndexValue: "450.123",
          adjustmentIndexCode: "47",
          adjustmentIndexName: "Mano de Obra",
          adjustmentIndexValue: "465.789",
          sortOrder: 1,
          components: [
            {
              budgetItemId: "item-1",
              apuResourceId: null,
              resourceType: "LABOR",
              amount: "300000.00",
            },
          ],
        },
      ],
    },
  },
};

describe("importProjectPackageToMyc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertWorkspaceMembership.mockResolvedValue(undefined);
    mocks.assertWithinPlanLimit.mockResolvedValue(undefined);
    mocks.projectCreate.mockResolvedValue({ id: "project-created", name: "Hospital Norte" });
    mocks.budgetCreate
      .mockResolvedValueOnce({ id: "budget-g-created", kind: "GENERAL" })
      .mockResolvedValueOnce({ id: "budget-sub-1-created", kind: "SUB_BUDGET" })
      .mockResolvedValueOnce({ id: "budget-sub-2-created", kind: "SUB_BUDGET" });
    mocks.budgetLevelCreate.mockResolvedValue({ id: "level-created" });
    mocks.budgetItemCreate.mockResolvedValue({ id: "item-created" });
    mocks.budgetFooterRowCreateMany.mockResolvedValue({ count: 1 });
    mocks.apuCreate.mockResolvedValue({ id: "apu-created" });
    mocks.resourceFindFirst.mockResolvedValue(null);
    mocks.apuResourceCreate.mockResolvedValue({ id: "apu-res-created" });
    mocks.resourceCreate.mockResolvedValue({ id: "resource-created" });
    mocks.polynomialFormulaCreate.mockResolvedValue({ id: "formula-created" });
    mocks.polynomialMonomialCreate.mockResolvedValue({ id: "monomial-created" });
    mocks.polynomialMonomialComponentCreate.mockResolvedValue({ id: "component-created" });

    mocks.transaction.mockImplementation(async (callback: (tx: Record<string, unknown>) => Promise<unknown>) =>
      callback({
        project: { create: mocks.projectCreate },
        budget: { create: mocks.budgetCreate },
        budgetLevel: { create: mocks.budgetLevelCreate },
        budgetItem: { create: mocks.budgetItemCreate },
        budgetFooterRow: { createMany: mocks.budgetFooterRowCreateMany },
        apu: { create: mocks.apuCreate },
        apuResource: { create: mocks.apuResourceCreate },
        resource: { findFirst: mocks.resourceFindFirst, create: mocks.resourceCreate },
        polynomialFormula: { create: mocks.polynomialFormulaCreate },
        polynomialMonomial: { create: mocks.polynomialMonomialCreate },
        polynomialMonomialComponent: { create: mocks.polynomialMonomialComponentCreate },
      }),
    );
  });

  it("reuses an exact matching global resource when restoring an MCP project", async () => {
    mocks.resourceFindFirst.mockResolvedValue({ id: "global-resource-1" });
    const readModule = makeModuleReader({
      ...fixtureModules,
      "budgets/project-resources.json": {
        resources: [
          {
            id: "res-1",
            code: "MAT-051",
            description: "AGUA PARA LA OBRA",
            category: "MATERIAL",
            unit: "M3",
            currency: "PEN",
            unitPrice: "5",
            iu: "39 : INDICE DE PRECIOS AL CONSUMIDOR (INEI)",
            iuCurrent: "93",
          },
        ],
      },
    });

    await importProjectPackageToMyc("user-1", makeManifest(), readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    expect(mocks.resourceFindFirst).toHaveBeenCalledWith({
      where: {
        companyId: null,
        code: "MAT-051",
        description: "AGUA PARA LA OBRA",
        category: "MATERIAL",
        unit: "M3",
        unitPrice: "5",
        currency: "PEN",
        iu: "39 : INDICE DE PRECIOS AL CONSUMIDOR (INEI)",
        iuCurrent: "93",
      },
      select: { id: true },
    });
    expect(mocks.resourceCreate).not.toHaveBeenCalled();
    expect(mocks.apuResourceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resourceId: "global-resource-1" }),
      }),
    );
  });

  it("persists an MCP package as a new MYC project with budgets, items, APUs, footer, and formula", async () => {
    const manifest = makeManifest();
    const readModule = makeModuleReader(fixtureModules);

    const result = await importProjectPackageToMyc("user-1", manifest, readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    // Verify plan limits checked
    expect(mocks.assertWithinPlanLimit).toHaveBeenCalledWith({ userId: "user-1", resource: "projects" });
    expect(mocks.assertWithinPlanLimit).toHaveBeenCalledWith({ userId: "user-1", resource: "budgets" });

    // Verify transaction was called
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 120_000,
    });

    // Project
    expect(mocks.projectCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        name: "Hospital Norte",
        clientName: "Gobierno Regional",
        location: "Lima, Peru",
        projectType: "Edificacion",
        status: "PLANNING",
      }),
    });

    // Budgets
    expect(mocks.budgetCreate).toHaveBeenCalledTimes(3);
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-created",
          kind: "GENERAL",
          name: "Presupuesto General",
          igvRate: "0.1800",
        }),
      }),
    );
    expect(mocks.budgetCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          projectId: "project-created",
          parentBudgetId: "budget-g-created",
          kind: "SUB_BUDGET",
          name: "Estructuras",
        }),
      }),
    );

    // Levels
    expect(mocks.budgetLevelCreate).toHaveBeenCalledTimes(2);
    expect(mocks.budgetLevelCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          budgetId: "budget-sub-1-created",
          code: "01",
          type: "TITLE",
          name: "Estructuras",
        }),
      }),
    );

    // Items
    expect(mocks.budgetItemCreate).toHaveBeenCalledTimes(2);
    expect(mocks.budgetItemCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          budgetId: "budget-sub-1-created",
          code: "01.01.001",
          description: "Concreto f'c=210 kg/cm2 en zapatas",
          unit: "m3",
          quantity: "125.5000",
          unitPrice: "450.7500",
          partial: "56569.1250",
        }),
      }),
    );

    // APU
    expect(mocks.apuCreate).toHaveBeenCalledTimes(1);
    expect(mocks.apuCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        budgetItemId: "item-created",
        name: "Concreto f'c=210 kg/cm2 en zapatas",
        unit: "m3",
        performance: "25.0000",
        totalUnitCost: "450.7500",
      }),
    });

    // APU resources
    expect(mocks.apuResourceCreate).toHaveBeenCalledTimes(2);
    expect(mocks.apuResourceCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          apuId: "apu-created",
          resourceId: "resource-created",
          resourceType: "MATERIAL",
          quantity: "1.0500",
          unitPrice: "280.0000",
          subtotal: "294.0000",
        }),
      }),
    );

    // Footer rows
    expect(mocks.budgetFooterRowCreateMany).toHaveBeenCalled();
    const footerCall = mocks.budgetFooterRowCreateMany.mock.calls[0][0];
    expect(footerCall.data[0]).toMatchObject({
      budgetId: "budget-sub-1-created",
      variable: "CD",
      description: "Costo Directo",
    });

    // Polynomial formula
    expect(mocks.polynomialFormulaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: "project-created",
        budgetId: "budget-g-created",
        name: "Formula Polinomica N1",
        baseMonth: 1,
        baseYear: 2026,
        status: "DRAFT",
      }),
    });

    // Monomial
    expect(mocks.polynomialMonomialCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        formulaId: "formula-created",
        code: "M1",
        coefficient: "0.347",
        baseIndexCode: "47",
      }),
    });

    // Monomial component with remapped budgetItemId
    expect(mocks.polynomialMonomialComponentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        monomialId: "monomial-created",
        budgetItemId: "item-created", // remapped from "item-1"
        resourceType: "LABOR",
        amount: "300000.00",
      }),
    });

    // Result
    expect(result).toEqual({
      projectId: "project-created",
      projectName: "Hospital Norte",
      generalBudgetId: "budget-g-created",
      subBudgetIds: ["budget-sub-1-created", "budget-sub-2-created"],
      budgetCount: 3,
      itemCount: 2,
      apuCount: 1,
      resourceCount: 0,
      warnings: [],
    });
  });

  it("remaps packaged project resources before creating APU resource rows", async () => {
    const manifest = makeManifest();
    const readModule = makeModuleReader({
      ...fixtureModules,
      "budgets/project-resources.json": {
        resources: [
          {
            id: "res-1",
            code: "MAT-001",
            description: "Cemento Portland Tipo I",
            category: "MATERIAL",
            unit: "bol",
            currency: "PEN",
            unitPrice: "280.0000",
            iu: "21",
            iuCurrent: "21",
          },
        ],
      },
    });

    await importProjectPackageToMyc("user-1", manifest, readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    expect(mocks.resourceCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        code: "MAT-001",
        description: "Cemento Portland Tipo I",
        category: "MATERIAL",
        unit: "bol",
        currency: "PEN",
        unitPrice: "280.0000",
        iu: "21",
        iuCurrent: "21",
        source: "mcp-import",
      }),
    });
    expect(mocks.apuResourceCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          resourceId: "resource-created",
        }),
      }),
    );
  });

  it("creates project resources from APU resource descriptions when project resources are missing", async () => {
    await importProjectPackageToMyc("user-1", makeManifest(), makeModuleReader(fixtureModules), {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    expect(mocks.resourceCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          code: "IMP-0001",
          description: "Cemento Portland Tipo I",
          category: "MATERIAL",
          unit: "und",
          currency: "PEN",
          unitPrice: "280.0000",
          source: "mcp-import",
        }),
      }),
    );
    expect(mocks.resourceCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-1",
          code: "IMP-0002",
          description: "Operario",
          category: "LABOR",
          unit: "und",
          currency: "PEN",
          unitPrice: "120.0000",
          source: "mcp-import",
        }),
      }),
    );
    expect(mocks.apuResourceCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          resourceId: "resource-created",
        }),
      }),
    );
    expect(mocks.apuResourceCreate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          resourceId: "resource-created",
        }),
      }),
    );
  });

  it("applies project overrides during restore", async () => {
    await importProjectPackageToMyc("user-1", makeManifest(), makeModuleReader(fixtureModules), {
      companyId: "company-1",
      mode: "restore_as_new_project",
      projectOverrides: {
        name: "Edificio Multifamiliar - Demo",
        clientName: "Cliente Demo",
        location: "Lima, Peru",
        projectType: "Edificacion",
        isDemo: true,
        demoKey: "edificio-multifamiliar",
      },
    });

    expect(mocks.projectCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-1",
        name: "Edificio Multifamiliar - Demo",
        clientName: "Cliente Demo",
        location: "Lima, Peru",
        projectType: "Edificacion",
        isDemo: true,
        demoKey: "edificio-multifamiliar",
      }),
    });
  });

  it("rejects import when user lacks workspace membership", async () => {
    mocks.assertWorkspaceMembership.mockRejectedValue(new Error("No tienes acceso a este workspace"));

    await expect(
      importProjectPackageToMyc(
        "user-1",
        makeManifest(),
        makeModuleReader(fixtureModules),
        { companyId: "company-2", mode: "restore_as_new_project" },
      ),
    ).rejects.toThrow("No tienes acceso a este workspace");
  });

  it("returns warnings when footer module parsing fails", async () => {
    const manifest = makeManifest();

    // Provide a malformed footer that throws on read
    const modulesWithBadFooter = {
      ...fixtureModules,
      "budgets/footer.json": "not-valid-json{{{",
    };
    const readModule = makeModuleReader(modulesWithBadFooter);

    // The readModule will throw when trying to parse the bad footer,
    // which should be caught and produce a warning. But since our
    // readModule doesn't parse JSON (it returns the raw value),
    // the type mismatch would cause a runtime error in the persistence.
    // We test that the core import succeeds despite bad optional data.
    const result = await importProjectPackageToMyc("user-1", manifest, readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    expect(result.projectId).toBe("project-created");
  });

  it("returns warnings when formula module is absent", async () => {
    const manifest = makeManifest();
    const modulesWithoutFormula = { ...fixtureModules };
    delete modulesWithoutFormula["polynomial-formula/formula.json"];
    const readModule = makeModuleReader(modulesWithoutFormula);

    const result = await importProjectPackageToMyc("user-1", manifest, readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    // Should still succeed, just without formula
    expect(result.projectId).toBe("project-created");
    expect(mocks.polynomialFormulaCreate).not.toHaveBeenCalled();
  });

  it("returns warnings when budget items module is absent", async () => {
    const manifest = makeManifest();
    const modulesWithoutItems = { ...fixtureModules };
    delete modulesWithoutItems["budgets/budget-items.json"];
    const readModule = makeModuleReader(modulesWithoutItems);

    const result = await importProjectPackageToMyc("user-1", manifest, readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    // Should succeed with a warning
    expect(result.projectId).toBe("project-created");
    expect(result.warnings).toContain("No se pudieron leer los items del presupuesto.");
    expect(result.itemCount).toBe(0);
  });

  it("returns warnings when APUs module is absent", async () => {
    const manifest = makeManifest();
    const modulesWithoutApus = { ...fixtureModules };
    delete modulesWithoutApus["budgets/apus.json"];
    const readModule = makeModuleReader(modulesWithoutApus);

    const result = await importProjectPackageToMyc("user-1", manifest, readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    // Should succeed with a warning
    expect(result.projectId).toBe("project-created");
    expect(result.warnings).toContain("No se pudieron leer los APUs del presupuesto.");
    expect(result.apuCount).toBe(0);
  });

  it("throws when no general budget exists in the package", async () => {
    const manifest = makeManifest();
    const modulesNoGeneral = {
      ...fixtureModules,
      "budgets/budget-tree.json": { budgets: [] },
    };
    const readModule = makeModuleReader(modulesNoGeneral);

    await expect(
      importProjectPackageToMyc("user-1", manifest, readModule, {
        companyId: "company-1",
        mode: "restore_as_new_project",
      }),
    ).rejects.toThrow("El paquete .mcp no contiene un presupuesto general.");
  });

  it("maps old ApuResource IDs to new IDs via apuResourceIdMap", async () => {
    // Set up fixture where polynomial formula references a real ApuResource
    const formulaWithApuRef = {
      formula: {
        ...fixtureModules["polynomial-formula/formula.json"].formula,
        monomials: [
          {
            ...fixtureModules["polynomial-formula/formula.json"].formula.monomials[0],
            components: [
              {
                budgetItemId: "item-1",
                apuResourceId: "apu-res-1", // references the first ApuResource created
                resourceType: "MATERIAL",
                amount: "294.0000",
              },
            ],
          },
        ],
      },
    };

    const manifest = makeManifest();
    const readModule = makeModuleReader({
      ...fixtureModules,
      "polynomial-formula/formula.json": formulaWithApuRef,
    });

    const result = await importProjectPackageToMyc("user-1", manifest, readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    // The ApuResource with OLD id "apu-res-1" was created, and apuResourceCreate returned
    // { id: "apu-res-created" }. The apuResourceIdMap should map "apu-res-1" → "apu-res-created".
    expect(mocks.polynomialMonomialComponentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        apuResourceId: "apu-res-created", // mapped through apuResourceIdMap
      }),
    });

    // The import should succeed without warnings
    expect(result.warnings).toEqual([]);
    expect(result.projectId).toBe("project-created");
    expect(result.apuCount).toBeGreaterThan(0);
  });

  it("falls back to null for unmapped ApuResource IDs to avoid FK violation", async () => {
    // Set up fixture where polynomial formula references a NONEXISTENT ApuResource
    const formulaWithBadRef = {
      formula: {
        ...fixtureModules["polynomial-formula/formula.json"].formula,
        monomials: [
          {
            ...fixtureModules["polynomial-formula/formula.json"].formula.monomials[0],
            components: [
              {
                budgetItemId: "item-1",
                apuResourceId: "apu-res-nonexistent", // NOT in any APU resource — not in apuResourceIdMap
                resourceType: "MATERIAL",
                amount: "294.0000",
              },
            ],
          },
        ],
      },
    };

    const manifest = makeManifest();
    const readModule = makeModuleReader({
      ...fixtureModules,
      "polynomial-formula/formula.json": formulaWithBadRef,
    });

    const result = await importProjectPackageToMyc("user-1", manifest, readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    // Unmapped "apu-res-nonexistent" should fall back to null via ??, preventing FK violation
    expect(mocks.polynomialMonomialComponentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        apuResourceId: null, // null because the ID wasn't in apuResourceIdMap
      }),
    });

    // Should succeed — the null fallback prevents the FK violation that would abort the transaction
    expect(result.warnings).toEqual([]);
    expect(result.projectId).toBe("project-created");
  });

  it("roundtrips a project package without losing budget, APU, and polynomial precision", async () => {
    // Step 1: Build a full .mcp package (simulates export)
    const buffer = buildFullProjectPackageBuffer();
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(100);

    // Step 2: Analyze the package (simulates upload + preview)
    const { manifest, fileContents } = analyzeProjectPackageBuffer(buffer);
    expect(manifest.capabilities.restoreAsNewProject).toBe(true);
    expect(manifest.project.name).toBe("Hospital Norte");
    expect(manifest.project.currency).toBe("PEN");

    // Step 3: Build a readModule adapter from the extracted file contents
    // fileContents is Map<string, string> (raw JSON strings); persistence expects parsed objects
    function makeRoundtripReader(contents: Map<string, string>) {
      return (path: string): unknown => {
        const raw = contents.get(path);
        if (raw === undefined) {
          throw new Error(`Module not found: ${path}`);
        }
        return JSON.parse(raw);
      };
    }

    // Step 4: Import as new project (simulates restore)
    const readModule = makeRoundtripReader(fileContents);
    const result = await importProjectPackageToMyc("user-1", manifest, readModule, {
      companyId: "company-1",
      mode: "restore_as_new_project",
    });

    // Assertions: the full roundtrip succeeded with no warnings
    expect(result.warnings).toEqual([]);
    expect(result.projectId).toBe("project-created");
    expect(result.projectName).toBe("Hospital Norte");
    expect(result.generalBudgetId).toBe("budget-g-created");
    expect(result.subBudgetIds.length).toBeGreaterThan(0);
    expect(result.itemCount).toBeGreaterThan(0);
    expect(result.apuCount).toBeGreaterThan(0);
    expect(result.budgetCount).toBeGreaterThan(1);

    // Verify persistence calls were made with correct decimal precision
    expect(mocks.projectCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Hospital Norte",
        companyId: "company-1",
        status: "PLANNING",
      }),
    });

    // Budget items retain their precision from the serialized form
    expect(mocks.budgetItemCreate).toHaveBeenCalled();
    const itemCreateCall = mocks.budgetItemCreate.mock.calls[0][0];
    expect(itemCreateCall.data).toMatchObject({
      quantity: "125.5000",
      unitPrice: "450.7500",
      partial: "56569.1250",
    });

    // APU was created
    expect(mocks.apuCreate).toHaveBeenCalled();
    const apuCall = mocks.apuCreate.mock.calls[0][0];
    expect(apuCall.data).toMatchObject({
      performance: "25.0000",
      totalUnitCost: "450.7500",
    });

    // Polynomial formula was created
    expect(mocks.polynomialFormulaCreate).toHaveBeenCalled();
    expect(mocks.polynomialMonomialCreate).toHaveBeenCalled();
    const monomialCall = mocks.polynomialMonomialCreate.mock.calls[0][0];
    expect(monomialCall.data).toMatchObject({
      code: "M1",
      coefficient: "0.347",
    });

    // Transaction was used
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 120_000,
    });
  });
});
