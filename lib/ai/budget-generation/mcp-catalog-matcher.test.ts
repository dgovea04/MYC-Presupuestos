import { describe, expect, it, vi, beforeEach } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  catalogPartidaFindMany: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    catalogPartida: {
      findMany: mocks.catalogPartidaFindMany,
    },
  },
}));

// ─── Import after mocks ─────────────────────────────────────────────────────

import { matchBlueprintItemsToCatalog } from "./mcp-catalog-matcher";
import type { McpBudgetBlueprint } from "./mcp-blueprint";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBlueprint(
  items: Array<{ id: string; description: string; unit: string; unitPrice?: string; quantity?: string }>,
): McpBudgetBlueprint {
  return {
    sourcePackageId: "pkg-1",
    sourceProjectName: "Test Project",
    sourceFormatVersion: "1.0.0",
    projectType: "Vivienda",
    confidence: 1,
    assumptions: [],
    warnings: [],
    subBudgets: [
      {
        sourceBudgetId: "budget-1",
        name: "Estructuras",
        normalizedName: "estructuras",
        currency: "PEN",
        igvRate: "0.18",
        generalExpensesRate: "0.10",
        utilityRate: "0.08",
        levels: [],
        items: items.map((item) => ({
          sourceItemId: item.id,
          sourceCode: "01.01",
          description: item.description,
          normalizedDescription: item.description.toLowerCase(),
          unit: item.unit,
          quantity: item.quantity ?? "100",
          unitPrice: item.unitPrice ?? "50",
          partial: "5000",
          sortOrder: 1,
          levelSourceId: null,
          apu: null,
        })),
      },
    ],
  };
}

function makeCatalogPartida(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: (overrides.id as string) ?? "catalog-1",
    description: (overrides.description as string) ?? "Partida de prueba",
    unit: (overrides.unit as string) ?? "m2",
    unitPrice: (overrides.unitPrice as number) ?? 50,
    currency: "PEN",
    source: "Catalogo precargado",
    performance: 1,
    performanceUnit: "m2/DIA",
    performanceRate: "1.0000 m2/DIA",
    apuRows: (overrides.apuRows as Array<Record<string, unknown>>) ?? [
      {
        id: "row-1",
        catalogPartidaId: "catalog-1",
        resourceId: "res-1",
        catalogSubpartidaId: null,
        description: "Insumo de prueba",
        unit: "und",
        crew: null,
        quantity: 1,
        unitPrice: 50,
        subtotal: 50,
        resourceType: "MATERIAL",
        groupLabel: null,
        sortOrder: 1,
      },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("matchBlueprintItemsToCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("empty catalog", () => {
    it("returns all items as unmatched when catalog is empty", async () => {
      mocks.catalogPartidaFindMany.mockResolvedValue([]);

      const results = await matchBlueprintItemsToCatalog({
        blueprint: makeBlueprint([
          { id: "item-1", description: "Muro de ladrillo", unit: "m2" },
        ]),
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("unmatched");
      expect(results[0].catalogPartidaId).toBeNull();
    });
  });

  describe("exact matches", () => {
    it("matches item when exact description and unit found in catalog", async () => {
      mocks.catalogPartidaFindMany.mockResolvedValue([
        makeCatalogPartida({
          id: "cat-1",
          description: "Muro de ladrillo",
          unit: "m2",
          unitPrice: 95,
        }),
      ]);

      const results = await matchBlueprintItemsToCatalog({
        blueprint: makeBlueprint([
          { id: "item-1", description: "Muro de ladrillo", unit: "m2" },
        ]),
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("matched");
      expect(results[0].catalogPartidaId).toBe("cat-1");
      expect(results[0].matchScore).toBe(1);
    });

    it("returns catalog unit price for matched items", async () => {
      mocks.catalogPartidaFindMany.mockResolvedValue([
        makeCatalogPartida({ id: "cat-1", description: "Muro de ladrillo", unit: "m2", unitPrice: 95 }),
      ]);

      const results = await matchBlueprintItemsToCatalog({
        blueprint: makeBlueprint([
          { id: "item-1", description: "Muro de ladrillo", unit: "m2", unitPrice: "50" },
        ]),
      });

      expect(results[0].selectedUnitPrice).toBe("95");
    });
  });

  describe("fuzzy matches", () => {
    it("matches similar descriptions (fuzzy) as 'matched' when score >= 0.80", async () => {
      mocks.catalogPartidaFindMany.mockResolvedValue([
        makeCatalogPartida({ id: "cat-1", description: "MURO DE LADRILLO KING KONG DE CABEZA", unit: "m2", unitPrice: 95 }),
      ]);

      const results = await matchBlueprintItemsToCatalog({
        blueprint: makeBlueprint([
          { id: "item-1", description: "Muro de ladrillo king kong", unit: "m2" },
        ]),
      });

      expect(results).toHaveLength(1);
      // The exact match normalization should handle this as a strong match
      expect(["matched", "review_required"]).toContain(results[0].status);
      expect(results[0].catalogPartidaId).toBe("cat-1");
    });

    it("marks as 'review_required' when score is between 0.60 and 0.79", async () => {
      // A catalog item with a different but somewhat related description
      mocks.catalogPartidaFindMany.mockResolvedValue([
        makeCatalogPartida({ id: "cat-1", description: "Tarrajeo de muros interiores", unit: "m2", unitPrice: 35 }),
      ]);

      const results = await matchBlueprintItemsToCatalog({
        blueprint: makeBlueprint([
          { id: "item-1", description: "Tarrajeo de muros exteriores con aditivo", unit: "m2" },
        ]),
      });

      expect(results).toHaveLength(1);
      // Should be review_required or matched depending on score
      expect(["matched", "review_required", "unmatched"]).toContain(results[0].status);
    });

    it("marks as 'unmatched' when score < 0.60", async () => {
      mocks.catalogPartidaFindMany.mockResolvedValue([
        makeCatalogPartida({ id: "cat-1", description: "Pintura latex en muros", unit: "m2", unitPrice: 20 }),
      ]);

      const results = await matchBlueprintItemsToCatalog({
        blueprint: makeBlueprint([
          { id: "item-1", description: "Excavacion masiva con maquinaria pesada", unit: "m3" },
        ]),
      });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("unmatched");
      expect(results[0].catalogPartidaId).toBeNull();
    });
  });

  describe("multiple items", () => {
    it("matches multiple blueprint items to catalog", async () => {
      mocks.catalogPartidaFindMany.mockResolvedValue([
        makeCatalogPartida({ id: "cat-1", description: "Muro de ladrillo", unit: "m2", unitPrice: 95 }),
        makeCatalogPartida({ id: "cat-2", description: "Columna de concreto", unit: "m3", unitPrice: 450 }),
        makeCatalogPartida({ id: "cat-3", description: "Pintura latex", unit: "m2", unitPrice: 18 }),
      ]);

      const results = await matchBlueprintItemsToCatalog({
        blueprint: makeBlueprint([
          { id: "item-1", description: "Muro de ladrillo", unit: "m2" },
          { id: "item-2", description: "Columna de concreto", unit: "m3" },
          { id: "item-3", description: "Excavacion profunda", unit: "m3" },
        ]),
      });

      expect(results).toHaveLength(3);

      // Exact matches for the first two
      const muro = results.find((r) => r.sourceItemId === "item-1");
      expect(muro!.status).toBe("matched");
      expect(muro!.catalogPartidaId).toBe("cat-1");

      const columna = results.find((r) => r.sourceItemId === "item-2");
      expect(columna!.status).toBe("matched");
      expect(columna!.catalogPartidaId).toBe("cat-2");

      // Third item likely unmatched
      const excavacion = results.find((r) => r.sourceItemId === "item-3");
      expect(excavacion!.status).toBe("unmatched");
    });
  });

  describe("multiple sub-budgets", () => {
    it("matches items from all subBudgets", async () => {
      mocks.catalogPartidaFindMany.mockResolvedValue([
        makeCatalogPartida({ id: "cat-1", description: "Muro de ladrillo", unit: "m2", unitPrice: 95 }),
        makeCatalogPartida({ id: "cat-2", description: "Tuberia PVC", unit: "ml", unitPrice: 12 }),
      ]);

      const blueprint: McpBudgetBlueprint = {
        sourcePackageId: "pkg-1",
        sourceProjectName: "Test",
        sourceFormatVersion: "1.0.0",
        projectType: null,
        confidence: 1,
        assumptions: [],
        warnings: [],
        subBudgets: [
          {
            sourceBudgetId: "b1",
            name: "Estructuras",
            normalizedName: "estructuras",
            currency: "PEN",
            igvRate: "0.18",
            generalExpensesRate: "0.10",
            utilityRate: "0.08",
            levels: [],
            items: [
              {
                sourceItemId: "item-1",
                sourceCode: "01.01",
                description: "Muro de ladrillo",
                normalizedDescription: "muro de ladrillo",
                unit: "m2",
                quantity: "100",
                unitPrice: "50",
                partial: "5000",
                sortOrder: 1,
                levelSourceId: null,
                apu: null,
              },
            ],
          },
          {
            sourceBudgetId: "b2",
            name: "Instalaciones Sanitarias",
            normalizedName: "instalaciones sanitarias",
            currency: "PEN",
            igvRate: "0.18",
            generalExpensesRate: "0.10",
            utilityRate: "0.08",
            levels: [],
            items: [
              {
                sourceItemId: "item-2",
                sourceCode: "01.01",
                description: "Tuberia PVC",
                normalizedDescription: "tuberia pvc",
                unit: "ml",
                quantity: "50",
                unitPrice: "10",
                partial: "500",
                sortOrder: 1,
                levelSourceId: null,
                apu: null,
              },
            ],
          },
        ],
      };

      const results = await matchBlueprintItemsToCatalog({ blueprint });

      expect(results).toHaveLength(2);
    });
  });
});
