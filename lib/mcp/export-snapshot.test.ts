import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { getProjectForPackageExport } from "@/lib/data/projects";
import { serializePolynomialFormula } from "./serializers/polynomial-formula";
import { serializeBudgetItems } from "./serializers/apus";
import { serializeBudgetTree, serializeProjectResources } from "./serializers/budgets";
import { serializeProject } from "./serializers/project";
import { serializeWorkSchedule } from "./serializers/work-schedule";
import { serializeRiskAnalysis } from "./serializers/risk";
import { createMcpManifest, buildMcpFileName, validateManifestVersion } from "./manifest";
import { createSha256Checksums, createSha256Hash, validateChecksums } from "./checksums";
import { buildProjectPackageSnapshot } from "./export-snapshot";
import type { McpManifest } from "./types";

vi.mock("@/lib/data/projects", () => ({
  getProjectForPackageExport: vi.fn(),
}));

const getProjectForPackageExportMock = vi.mocked(getProjectForPackageExport);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MCP serializers", () => {
  describe("serializePolynomialFormula", () => {
    it("serializes polynomial coefficients as strings with original precision", () => {
      const payload = serializePolynomialFormula({
        id: "formula-1",
        budgetId: "budget-1",
        name: "Formula N1",
        baseMonth: 1,
        baseYear: 2026,
        totalBaseAmount: "1500000.00",
        status: "DRAFT",
        monomials: [
          {
            id: "monomial-1",
            code: "M1",
            name: "Mano de Obra",
            costGroupKey: "LABOR",
            amount: "300000.00",
            coefficient: new Prisma.Decimal("0.347"),
            baseIndexCode: "47",
            baseIndexName: "Mano de Obra",
            baseIndexValue: "450.123",
            adjustmentIndexCode: "47",
            adjustmentIndexName: "Mano de Obra",
            adjustmentIndexValue: "465.789",
            sortOrder: 1,
            components: [],
          },
        ],
      });

      expect(payload.formula).not.toBeNull();
      expect(payload.formula!.monomials[0]?.coefficient).toBe("0.347");
    });

    it("returns null formula when input is null", () => {
      const result = serializePolynomialFormula(null);
      expect(result.formula).toBeNull();
    });
  });

  describe("serializeBudgetItems", () => {
    it("serializes budget item amounts as strings", () => {
      const payload = serializeBudgetItems([
        {
          id: "budget-1",
          name: "Estructuras",
          levels: [],
          items: [
            {
              id: "item-1",
              levelId: null,
              code: "01.01",
              description: "Concreto f'c=210",
              unit: "m3",
              quantity: new Prisma.Decimal("125.5000"),
              unitPrice: new Prisma.Decimal("89.3600"),
              partial: new Prisma.Decimal("11215.6800"),
              sortOrder: 1,
            },
          ],
        },
      ]);

      expect(payload.budgets[0]?.items[0]).toMatchObject({
        quantity: "125.5",
        unitPrice: "89.36",
        partial: "11215.68",
      });
    });
  });

  describe("serializeBudgetTree", () => {
    it("serializes budget tree with decimal-safe amounts", () => {
      const result = serializeBudgetTree([
        {
          id: "bg-1",
          parentBudgetId: null,
          kind: "GENERAL",
          name: "Presupuesto General",
          currency: "PEN",
          igvRate: "0.18",
          generalExpensesRate: "0.10",
          utilityRate: "0.08",
          totalDirectCost: "0",
          totalGeneralExpenses: "0",
          totalUtility: "0",
          totalTax: "0",
          totalAmount: "0",
        },
      ]);

      expect(result.budgets).toHaveLength(1);
      expect(result.budgets[0]?.igvRate).toBe("0.18");
    });
  });

  describe("serializeProjectResources", () => {
    it("serializes resource prices as strings", () => {
      const result = serializeProjectResources([
        {
          id: "res-1",
          code: "MAT-001",
          description: "Cemento Portland",
          category: "MATERIAL",
          unit: "BLS",
          currency: "PEN",
          unitPrice: new Prisma.Decimal("32.5000"),
          iu: "21",
          iuCurrent: "21",
        },
      ]);

      expect(result.resources[0]).toMatchObject({
        id: "res-1",
        code: "MAT-001",
        unitPrice: "32.5",
        iu: "21",
      });
    });
  });

  describe("serializeProject", () => {
    it("serializes project core data", () => {
      const result = serializeProject({
        id: "project-1",
        name: "Hospital Norte",
        clientName: null,
        location: "Lima",
        projectType: "Edificacion",
        startDate: "2026-01-15T00:00:00.000Z",
        endDate: null,
        status: "PLANNING",
        currency: "PEN",
      });

      expect(result.name).toBe("Hospital Norte");
      expect(result.currency).toBe("PEN");
      expect(result.status).toBe("PLANNING");
    });
  });

  describe("serializeWorkSchedule", () => {
    it("serializes work schedule items", () => {
      const result = serializeWorkSchedule({
        items: [
          {
            id: "ws-1",
            budgetItemId: "item-1",
            startDate: "2026-02-01",
            endDate: "2026-03-15",
            durationDays: 42,
            predecessor: null,
            crew: "1",
            distributions: [
              {
                id: "dist-1",
                year: 2026,
                month: 2,
                percentage: "0.5",
              },
            ],
          },
        ],
      });

      expect(result.schedule).not.toBeNull();
      expect(result.schedule!.items).toHaveLength(1);
      expect(result.schedule!.items[0]?.durationDays).toBe(42);
    });

    it("returns null schedule when input is null", () => {
      const result = serializeWorkSchedule(null);
      expect(result.schedule).toBeNull();
    });
  });

  describe("serializeRiskAnalysis", () => {
    it("serializes risk variables, correlations, and simulation runs", () => {
      const result = serializeRiskAnalysis({
        variables: [
          {
            id: "rv-1",
            budgetItemId: "item-1",
            variableType: "QUANTITY",
            distributionType: "TRIANGULAR",
            minimum: "100",
            mostLikely: "125",
            maximum: "150",
            enabled: true,
          },
        ],
        correlations: [],
        simulationRuns: [],
      });

      expect(result.variables).toHaveLength(1);
      expect(result.variables[0]?.minimum).toBe("100");
      expect(result.variables[0]?.enabled).toBe(true);
    });
  });
});

describe("MCP project package export", () => {
  it("includes project resources for every module declared in the manifest", async () => {
    const sharedResource = {
      id: "res-1",
      companyId: "company-1",
      code: "MAT-001",
      description: "Cemento Portland",
      category: "MATERIAL" as const,
      iu: "21",
      iuCurrent: "21",
      iuCurrentReviewStatus: null,
      subcategory: null,
      unit: "BLS",
      unitPrice: new Prisma.Decimal("32.5000"),
      currency: "PEN",
      source: "CATALOG",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };

    getProjectForPackageExportMock.mockResolvedValue({
      id: "project-1",
      companyId: "company-1",
      name: "Hospital Norte",
      clientName: "Cliente",
      location: "Lima",
      projectType: "Edificacion",
      startDate: null,
      endDate: null,
      status: "PLANNING",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      budgets: [
        {
          id: "budget-general",
          projectId: "project-1",
          parentBudgetId: null,
          kind: "GENERAL",
          name: "Presupuesto General",
          currency: "PEN",
          igvRate: new Prisma.Decimal("0.18"),
          generalExpensesRate: new Prisma.Decimal("0.10"),
          utilityRate: new Prisma.Decimal("0.08"),
          totalDirectCost: new Prisma.Decimal("0"),
          totalGeneralExpenses: new Prisma.Decimal("0"),
          totalUtility: new Prisma.Decimal("0"),
          totalTax: new Prisma.Decimal("0"),
          totalAmount: new Prisma.Decimal("0"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          levels: [],
          items: [],
          generalExpenses: [],
          generalExpenseGroups: [],
          footerRows: [],
        },
        {
          id: "budget-sub",
          projectId: "project-1",
          parentBudgetId: "budget-general",
          kind: "SUB_BUDGET",
          name: "Estructuras",
          currency: "PEN",
          igvRate: new Prisma.Decimal("0.18"),
          generalExpensesRate: new Prisma.Decimal("0.10"),
          utilityRate: new Prisma.Decimal("0.08"),
          totalDirectCost: new Prisma.Decimal("65"),
          totalGeneralExpenses: new Prisma.Decimal("0"),
          totalUtility: new Prisma.Decimal("0"),
          totalTax: new Prisma.Decimal("0"),
          totalAmount: new Prisma.Decimal("65"),
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          levels: [],
          items: [
            {
              id: "item-1",
              budgetId: "budget-sub",
              levelId: null,
              code: "01.01",
              description: "Concreto",
              unit: "m3",
              quantity: new Prisma.Decimal("1"),
              unitPrice: new Prisma.Decimal("65"),
              partial: new Prisma.Decimal("65"),
              sortOrder: 1,
              createdAt: new Date("2026-01-01T00:00:00.000Z"),
              updatedAt: new Date("2026-01-01T00:00:00.000Z"),
              apu: {
                id: "apu-1",
                budgetItemId: "item-1",
                name: "Concreto",
                unit: "m3",
                performance: new Prisma.Decimal("10"),
                totalUnitCost: new Prisma.Decimal("65"),
                createdAt: new Date("2026-01-01T00:00:00.000Z"),
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                resources: [
                  {
                    id: "apu-resource-1",
                    apuId: "apu-1",
                    resourceId: "res-1",
                    resourceType: "MATERIAL",
                    crew: null,
                    quantity: new Prisma.Decimal("2"),
                    unitPrice: new Prisma.Decimal("32.5"),
                    subtotal: new Prisma.Decimal("65"),
                    createdAt: new Date("2026-01-01T00:00:00.000Z"),
                    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                    resource: sharedResource,
                  },
                  {
                    id: "apu-resource-2",
                    apuId: "apu-1",
                    resourceId: "res-1",
                    resourceType: "MATERIAL",
                    crew: null,
                    quantity: new Prisma.Decimal("1"),
                    unitPrice: new Prisma.Decimal("32.5"),
                    subtotal: new Prisma.Decimal("32.5"),
                    createdAt: new Date("2026-01-01T00:00:00.000Z"),
                    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                    resource: sharedResource,
                  },
                ],
              },
            },
          ],
          generalExpenses: [],
          generalExpenseGroups: [],
          footerRows: [],
        },
      ],
      polynomialFormulas: [],
    });

    const snapshot = await buildProjectPackageSnapshot("project-1", "user-1");
    const fileNames = new Set(snapshot.files.map((file) => file.fileName));

    for (const manifestModule of snapshot.manifest.modules) {
      expect(fileNames.has(manifestModule.path)).toBe(true);
    }

    expect(snapshot.manifest.checksums["budgets/project-resources.json"]).toBeTruthy();

    const projectResourcesFile = snapshot.files.find((file) => file.fileName === "budgets/project-resources.json");
    expect(projectResourcesFile).toBeTruthy();

    const projectResources = JSON.parse(String(projectResourcesFile?.content)) as {
      resources: Array<{ id: string; code: string; unitPrice: string }>;
    };

    expect(projectResources.resources).toEqual([
      {
        id: "res-1",
        code: "MAT-001",
        description: "Cemento Portland",
        category: "MATERIAL",
        unit: "BLS",
        currency: "PEN",
        unitPrice: "32.5",
        iu: "21",
        iuCurrent: "21",
      },
    ]);
  });
});

describe("MCP manifest", () => {
  it("builds a manifest for a full project package", () => {
    const manifest = createMcpManifest({
      projectId: "project-1",
      projectName: "Hospital Norte",
      appVersion: "0.1.0",
      currency: "PEN",
      modules: [{ id: "project", path: "project.json", required: true }],
      checksums: { "project.json": "abc123" },
    });

    expect(manifest.format).toBe("MC_PROJECT_PACKAGE");
    expect(manifest.package.fileExtension).toBe(".mcp");
    expect(manifest.modules[0]?.path).toBe("project.json");
    expect(manifest.capabilities.restoreAsNewProject).toBe(true);
  });

  it("generates a valid file name slug ending in .mcp", () => {
    const fileName = buildMcpFileName("Hospital Norte");
    expect(fileName.endsWith(".mcp")).toBe(true);
    expect(fileName).toBe("hospital-norte.mcp");
  });

  it("validates supported format version", () => {
    const manifest: McpManifest = {
      format: "MC_PROJECT_PACKAGE",
      formatVersion: "1.0.0",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: { app: "MC Presupuestos", appVersion: "0.1.0", environment: "test" },
      package: { fileExtension: ".mcp", compression: "zip-store", checksumAlgorithm: "sha256" },
      project: { slug: "test", name: "Test", currency: "PEN" },
      modules: [],
      capabilities: { restoreAsNewProject: true, preview: true, merge: false },
      namespaces: ["core", "mc"],
      extensions: [],
      checksums: {},
    };

    expect(() => validateManifestVersion(manifest)).not.toThrow();
  });

  it("rejects unsupported format version", () => {
    const manifest: McpManifest = {
      format: "MC_PROJECT_PACKAGE",
      formatVersion: "2.0.0",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: { app: "MC Presupuestos", appVersion: "0.1.0", environment: "test" },
      package: { fileExtension: ".mcp", compression: "zip-store", checksumAlgorithm: "sha256" },
      project: { slug: "test", name: "Test", currency: "PEN" },
      modules: [],
      capabilities: { restoreAsNewProject: true, preview: true, merge: false },
      namespaces: ["core", "mc"],
      extensions: [],
      checksums: {},
    };

    expect(() => validateManifestVersion(manifest)).toThrow("2.0.0");
  });
});

describe("MCP checksums", () => {
  it("creates SHA-256 checksums for files", () => {
    const files = [
      { path: "project.json", content: '{"name":"Test"}' },
      { path: "manifest.json", content: '{"format":"MC_PROJECT_PACKAGE"}' },
    ];

    const checksums = createSha256Checksums(files);

    expect(Object.keys(checksums)).toHaveLength(2);
    expect(checksums["project.json"]).toBeTruthy();
    expect(checksums["manifest.json"]).toBeTruthy();
  });

  it("validates checksums successfully", () => {
    const content = '{"name":"Test"}';
    const hash = createSha256Hash(content);

    const manifest: McpManifest = {
      format: "MC_PROJECT_PACKAGE",
      formatVersion: "1.0.0",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: { app: "MC Presupuestos", appVersion: "0.1.0", environment: "test" },
      package: { fileExtension: ".mcp", compression: "zip-store", checksumAlgorithm: "sha256" },
      project: { slug: "test", name: "Test", currency: "PEN" },
      modules: [{ id: "project", path: "project.json", required: true }],
      capabilities: { restoreAsNewProject: true, preview: true, merge: false },
      namespaces: ["core", "mc"],
      extensions: [],
      checksums: { "project.json": hash },
    };

    const fileContents = new Map([["project.json", content as string]]);
    expect(() => validateChecksums(manifest, fileContents)).not.toThrow();
  });

  it("rejects mismatched checksums", () => {
    const manifest: McpManifest = {
      format: "MC_PROJECT_PACKAGE",
      formatVersion: "1.0.0",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: { app: "MC Presupuestos", appVersion: "0.1.0", environment: "test" },
      package: { fileExtension: ".mcp", compression: "zip-store", checksumAlgorithm: "sha256" },
      project: { slug: "test", name: "Test", currency: "PEN" },
      modules: [{ id: "project", path: "project.json", required: true }],
      capabilities: { restoreAsNewProject: true, preview: true, merge: false },
      namespaces: ["core", "mc"],
      extensions: [],
      checksums: { "project.json": "0000000000000000000000000000000000000000000000000000000000000000" },
    };

    const fileContents = new Map([["project.json", '{"name":"Test"}' as string]]);
    expect(() => validateChecksums(manifest, fileContents)).toThrow("checksum");
  });

  it("skips validation for absent optional modules", () => {
    const manifest: McpManifest = {
      format: "MC_PROJECT_PACKAGE",
      formatVersion: "1.0.0",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      source: { app: "MC Presupuestos", appVersion: "0.1.0", environment: "test" },
      package: { fileExtension: ".mcp", compression: "zip-store", checksumAlgorithm: "sha256" },
      project: { slug: "test", name: "Test", currency: "PEN" },
      modules: [{ id: "takeoffs", path: "takeoffs/sheets.json", required: false }],
      capabilities: { restoreAsNewProject: true, preview: true, merge: false },
      namespaces: ["core", "mc"],
      extensions: [],
      checksums: { "takeoffs/sheets.json": "abc" },
    };

    const fileContents = new Map<string, string>();
    expect(() => validateChecksums(manifest, fileContents)).not.toThrow();
  });
});
