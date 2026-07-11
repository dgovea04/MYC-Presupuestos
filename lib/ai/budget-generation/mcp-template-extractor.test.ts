import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    storedProjectPackage: {
      findFirst: mocks.findFirst,
    },
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import {
  extractBudgetBlueprintFromStoredPackage,
  extractBudgetBlueprintFromMcpModules,
} from "./mcp-template-extractor";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeManifestJson() {
  return {
    format: "MC_PROJECT_PACKAGE",
    formatVersion: "1.0.0",
    schemaVersion: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    source: { app: "MC Presupuestos", appVersion: "0.1.0", environment: "production" },
    package: { fileExtension: ".mcp", compression: "zip-store", checksumAlgorithm: "sha256" },
    project: { slug: "test-project", name: "Vivienda Test", currency: "PEN" },
    modules: [],
    capabilities: { restoreAsNewProject: true, preview: true, merge: false },
    namespaces: ["core", "mc"],
    extensions: [],
    checksums: {},
  };
}

function makeProjectJson() {
  return {
    name: "Vivienda Test",
    clientName: "Cliente Demo",
    location: "Lima",
    projectType: "Vivienda",
    startDate: "2026-01-01",
    endDate: null,
    status: "PLANNING",
    currency: "PEN",
  };
}

function makeBudgetTreeJson(subBudgets: Array<{ id: string; name: string }> = [{ id: "budget-1", name: "Estructuras" }]) {
  const general = {
    id: "budget-general",
    parentBudgetId: null,
    kind: "GENERAL",
    name: "Presupuesto General",
    currency: "PEN",
    igvRate: 0.18,
    generalExpensesRate: 0.10,
    utilityRate: 0.08,
    totalDirectCost: "10000",
    totalGeneralExpenses: "1000",
    totalUtility: "800",
    totalTax: "2124",
    totalAmount: "13924",
  };

  const subs = subBudgets.map((sb, i) => ({
    id: sb.id,
    parentBudgetId: "budget-general",
    kind: "SUB_BUDGET",
    name: sb.name,
    currency: "PEN",
    igvRate: 0.18,
    generalExpensesRate: 0.10,
    utilityRate: 0.08,
    totalDirectCost: String(5000 * (i + 1)),
    totalGeneralExpenses: String(500 * (i + 1)),
    totalUtility: String(400 * (i + 1)),
    totalTax: String(1062 * (i + 1)),
    totalAmount: String(6962 * (i + 1)),
  }));

  return { budgets: [general, ...subs] };
}

function makeBudgetItemsJson(budgetId = "budget-1", levels: Array<Record<string, unknown>> = [], items: Array<Record<string, unknown>> = []) {
  return {
    budgets: [
      {
        budgetId,
        budgetName: "Estructuras",
        levels: levels.length > 0 ? levels : [
          { id: "level-1", parentId: null, type: "TITLE", code: "01", name: "Estructuras", sortOrder: 1 },
          { id: "level-2", parentId: "level-1", type: "SUBTITLE", code: "01.01", name: "Muros", sortOrder: 2 },
        ],
        items: items.length > 0 ? items : [
          { id: "item-1", levelId: "level-2", code: "01.01.01", description: "Muro de ladrillo", unit: "m2", quantity: "100", unitPrice: "50", partial: "5000", sortOrder: 1 },
          { id: "item-2", levelId: "level-2", code: "01.01.02", description: "Tarrajeo de muros", unit: "m2", quantity: "200", unitPrice: "25", partial: "5000", sortOrder: 2 },
        ],
      },
    ],
  };
}

function makeApusJson() {
  return {
    apus: [
      {
        id: "apu-1",
        budgetItemId: "item-1",
        name: "APU Muro de ladrillo",
        unit: "m2",
        performance: 10,
        totalUnitCost: 50,
        resources: [
          {
            id: "apr-1",
            resourceId: "res-1",
            resourceType: "MATERIAL",
            crew: null,
            quantity: 65,
            unitPrice: 0.5,
            subtotal: 32.5,
            resourceDescription: "Ladrillo king kong",
          },
          {
            id: "apr-2",
            resourceId: "res-2",
            resourceType: "LABOR",
            crew: 1,
            quantity: 0.8,
            unitPrice: 21.88,
            subtotal: 17.5,
            resourceDescription: "Operario",
          },
        ],
      },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("extractBudgetBlueprintFromMcpModules", () => {
  function createReadModule(files: Record<string, unknown>) {
    return (path: string) => {
      const content = files[path];
      if (!content) throw new Error(`Módulo no encontrado: "${path}"`);
      return typeof content === "string" ? JSON.parse(content) : content;
    };
  }

  describe("basic extraction", () => {
    it("extracts blueprint with subBudgets, levels, and items", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson(),
        "budgets/apus.json": makeApusJson(),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      expect(blueprint.sourcePackageId).toBe("pkg-1");
      expect(blueprint.sourceProjectName).toBe("Vivienda Test");
      expect(blueprint.sourceFormatVersion).toBe("1.0.0");
      expect(blueprint.projectType).toBe("Vivienda");
      expect(blueprint.subBudgets).toHaveLength(1);
    });

    it("extracts sub-budget metadata", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson(),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      const sb = blueprint.subBudgets[0];
      expect(sb.name).toBe("Estructuras");
      expect(sb.currency).toBe("PEN");
      expect(sb.igvRate).toBe("0.18");
      expect(sb.generalExpensesRate).toBe("0.1");
    });

    it("extracts levels with hierarchy", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson(),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      const levels = blueprint.subBudgets[0].levels;
      expect(levels).toHaveLength(2);

      const title = levels.find((l) => l.sourceLevelId === "level-1");
      expect(title).toBeDefined();
      expect(title!.type).toBe("TITLE");
      expect(title!.parentSourceLevelId).toBeNull();

      const subtitle = levels.find((l) => l.sourceLevelId === "level-2");
      expect(subtitle).toBeDefined();
      expect(subtitle!.type).toBe("SUBTITLE");
      expect(subtitle!.parentSourceLevelId).toBe("level-1");
    });

    it("extracts items with correct fields", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson(),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      const items = blueprint.subBudgets[0].items;
      expect(items).toHaveLength(2);

      const firstItem = items[0];
      expect(firstItem.sourceItemId).toBe("item-1");
      expect(firstItem.sourceCode).toBe("01.01.01");
      expect(firstItem.description).toBe("Muro de ladrillo");
      expect(firstItem.unit).toBe("m2");
      expect(firstItem.quantity).toBe("100");
      expect(firstItem.unitPrice).toBe("50");
      expect(firstItem.partial).toBe("5000");
      expect(firstItem.levelSourceId).toBe("level-2");
    });

    it("preserves monetary values as strings", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson(),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      const item = blueprint.subBudgets[0].items[0];
      expect(typeof item.quantity).toBe("string");
      expect(typeof item.unitPrice).toBe("string");
      expect(typeof item.partial).toBe("string");
    });
  });

  describe("APU extraction", () => {
    it("extracts APUs when apus.json is present", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson(),
        "budgets/apus.json": makeApusJson(),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      const itemWithApu = blueprint.subBudgets[0].items.find((i) => i.sourceItemId === "item-1");
      expect(itemWithApu).toBeDefined();
      expect(itemWithApu!.apu).not.toBeNull();
      expect(itemWithApu!.apu!.name).toBe("APU Muro de ladrillo");
      expect(itemWithApu!.apu!.unit).toBe("m2");
      expect(itemWithApu!.apu!.performance).toBe("10");
      expect(itemWithApu!.apu!.totalUnitCost).toBe("50");
      expect(itemWithApu!.apu!.resources).toHaveLength(2);
    });

    it("item without APU has apu: null", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson(),
        "budgets/apus.json": makeApusJson(),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      const itemWithoutApu = blueprint.subBudgets[0].items.find((i) => i.sourceItemId === "item-2");
      expect(itemWithoutApu).toBeDefined();
      expect(itemWithoutApu!.apu).toBeNull();
    });
  });

  describe("multiple sub-budgets", () => {
    it("extracts all sub-budgets from a project with multiple", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson([
          { id: "budget-1", name: "Estructuras" },
          { id: "budget-2", name: "Arquitectura" },
          { id: "budget-3", name: "Instalaciones Sanitarias" },
        ]),
        "budgets/budget-items.json": {
          budgets: [
            { ...makeBudgetItemsJson("budget-1").budgets[0], budgetName: "Estructuras" },
            { ...makeBudgetItemsJson("budget-2").budgets[0], budgetName: "Arquitectura" },
          ],
        },
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      expect(blueprint.subBudgets).toHaveLength(3);

      const names = blueprint.subBudgets.map((sb) => sb.name);
      expect(names).toContain("Estructuras");
      expect(names).toContain("Arquitectura");
      expect(names).toContain("Instalaciones Sanitarias");
    });
  });

  describe("normalization", () => {
    it("normalizes sub-budget names for deduplication", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson([{ id: "budget-1", name: "Estructuras" }]),
        "budgets/budget-items.json": makeBudgetItemsJson(),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      const sb = blueprint.subBudgets[0];
      expect(sb.normalizedName).toBeDefined();
      expect(sb.normalizedName.length).toBeGreaterThan(0);
    });

    it("normalizes item descriptions", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson(),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      const item = blueprint.subBudgets[0].items[0];
      expect(item.normalizedDescription).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("throws when general budget is missing", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": {
          budgets: [
            { id: "b1", parentBudgetId: null, kind: "SUB_BUDGET", name: "Estructuras", currency: "PEN", igvRate: 0.18, generalExpensesRate: 0.10, utilityRate: 0.08 },
          ],
        },
      });

      expect(() =>
        extractBudgetBlueprintFromMcpModules({
          packageId: "pkg-1",
          readModule,
        }),
      ).toThrow("no contiene un presupuesto general");
    });

    it("throws when no sub-budgets exist", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": {
          budgets: [
            { id: "bg", parentBudgetId: null, kind: "GENERAL", name: "General", currency: "PEN", igvRate: 0.18, generalExpensesRate: 0.10, utilityRate: 0.08 },
          ],
        },
        "budgets/budget-items.json": { budgets: [] },
      });

      expect(() =>
        extractBudgetBlueprintFromMcpModules({
          packageId: "pkg-1",
          readModule,
        }),
      ).toThrow("no contiene sub-presupuestos");
    });

    it("handles missing apus.json gracefully", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson(),
        // No apus.json
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      // Should succeed without APUs
      expect(blueprint.subBudgets).toHaveLength(1);
      expect(blueprint.warnings.some((w) => w.includes("No se encontraron APUs"))).toBe(true);
    });

    it("throws when missing manifest.json", () => {
      const readModule = createReadModule({
        // No manifest.json
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
      });

      expect(() =>
        extractBudgetBlueprintFromMcpModules({
          packageId: "pkg-1",
          readModule,
        }),
      ).toThrow("manifest");
    });
  });

  describe("level type normalization", () => {
    it("normalizes all BudgetLevelType variants", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson("budget-1", [
          { id: "l1", parentId: null, type: "TITLE", code: "01", name: "Title", sortOrder: 1 },
          { id: "l2", parentId: "l1", type: "SUBTITLE", code: "01.01", name: "Sub", sortOrder: 2 },
          { id: "l3", parentId: "l2", type: "ITEM_GROUP", code: "01.01.01", name: "Group", sortOrder: 3 },
          { id: "l4", parentId: "l3", type: "SUBITEM", code: "01.01.01.01", name: "Item", sortOrder: 4 },
        ]),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      const types = blueprint.subBudgets[0].levels.map((l) => l.type);
      expect(types).toContain("TITLE");
      expect(types).toContain("SUBTITLE");
      expect(types).toContain("ITEM_GROUP");
      expect(types).toContain("SUBITEM");
    });

    it("defaults unknown level types to TITLE", () => {
      const readModule = createReadModule({
        "manifest.json": makeManifestJson(),
        "project.json": makeProjectJson(),
        "budgets/budget-tree.json": makeBudgetTreeJson(),
        "budgets/budget-items.json": makeBudgetItemsJson("budget-1", [
          { id: "l1", parentId: null, type: "UNKNOWN_TYPE", code: "01", name: "Test", sortOrder: 1 },
        ]),
      });

      const blueprint = extractBudgetBlueprintFromMcpModules({
        packageId: "pkg-1",
        readModule,
      });

      expect(blueprint.subBudgets[0].levels[0].type).toBe("TITLE");
    });
  });
});
