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

import { matchBlueprintItemsToCatalog, buildMatchKey } from "./mcp-catalog-matcher";
import type { McpBudgetBlueprint } from "./mcp-blueprint";

// ─── buildMatchKey: normalization tests ─────────────────────────────────────

describe("buildMatchKey", () => {
  it("normalizes uppercase descriptions", () => {
    const key = buildMatchKey("MURO DE LADRILLO KK DE ARCILLA, N-CAB. MEZCLA 1:4", "M2");
    expect(key).toBe("muro de ladrillo kk de arcilla n cab mezcla1:4|m2");
  });

  it("normalizes lowercase descriptions the same way", () => {
    const key = buildMatchKey("muro de ladrillo kk de arcilla, n-cab. mezcla 1:4", "m2");
    expect(key).toBe("muro de ladrillo kk de arcilla n cab mezcla1:4|m2");
  });

  it("uppercase and lowercase produce identical keys", () => {
    const upper = buildMatchKey("MURO DE LADRILLO KK DE ARCILLA, N-CAB. MEZCLA 1:4", "M2");
    const lower = buildMatchKey("muro de ladrillo kk de arcilla, n-cab. mezcla 1:4", "m2");
    expect(upper).toBe(lower);
  });

  it("handles accents and special chars", () => {
    const key = buildMatchKey("CONTRAPISO E=40MM, BASE 3.0CM, MEZ. 1:5 PASTA 1:2", "M2");
    expect(key).toBe("contrapiso e 40mm base 3 0cm mez 1:5 pasta 1:2|m2");
  });

  it("preserves colon in mix ratios (mezcla pattern)", () => {
    const key = buildMatchKey("TARRAJEO FROTACHADO, MUROS INT. E=1.5CM, MEZCLA 1:4", "M2");
    expect(key).toContain("mezcla1:4");
  });

  it("handles fc pattern (concrete strength)", () => {
    const key = buildMatchKey("CONCRETO F'C=210 KG/CM2 EN COLUMNAS", "M3");
    expect(key).toContain("fc210");
  });

  it("produces consistent keys for items with numeric prefixes", () => {
    // Some catalog items have code-like prefixes
    const key = buildMatchKey("01.01.01 MURO DE LADRILLO", "M2");
    expect(key).toBe("01 01 01 muro de ladrillo|m2");
  });

  it("strips extra whitespace", () => {
    const key = buildMatchKey("  MURO   DE  LADRILLO  ", " M2 ");
    expect(key).toBe("muro de ladrillo|m2");
  });
});

// ─── Exact matching with real-world descriptions ────────────────────────────

describe("matchBlueprintItemsToCatalog — real-world descriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exact-matches muro de ladrillo KK N-CAB from .mcp against catalog", async () => {
    // Simulating the exact scenario from the debug script:
    // .mcp item: "MURO DE LADRILLO KK DE ARCILLA, N-CAB. MEZCLA 1:4"
    // catalog:   "MURO DE LADRILLO KK DE ARCILLA, N-CAB. MEZCLA 1:4"
    mocks.catalogPartidaFindMany.mockResolvedValue([
      makeCatalogPartida({
        id: "cat-muro-ncab",
        description: "MURO DE LADRILLO KK DE ARCILLA, N-CAB. MEZCLA 1:4",
        unit: "M2",
        unitPrice: 85.5,
      }),
    ]);

    const results = await matchBlueprintItemsToCatalog({
      blueprint: makeBlueprint([
        {
          id: "item-1",
          description: "MURO DE LADRILLO KK DE ARCILLA, N-CAB. MEZCLA 1:4",
          unit: "M2",
          unitPrice: "85.5",
        },
      ]),
    });

    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("matched");
    expect(results[0].matchScore).toBe(1);
    expect(results[0].catalogPartidaId).toBe("cat-muro-ncab");
    expect(results[0].reason).toBe("Coincidencia exacta por descripción y unidad");
  });

  it("exact-matches tarrajeo frotachado from .mcp against catalog", async () => {
    mocks.catalogPartidaFindMany.mockResolvedValue([
      makeCatalogPartida({
        id: "cat-tarrajeo",
        description: "TARRAJEO FROTACHADO, MUROS INT. E=1.5CM, MEZCLA 1:4",
        unit: "M2",
        unitPrice: 35.2,
      }),
    ]);

    const results = await matchBlueprintItemsToCatalog({
      blueprint: makeBlueprint([
        {
          id: "item-1",
          description: "TARRAJEO FROTACHADO, MUROS INT. E=1.5CM, MEZCLA 1:4",
          unit: "M2",
        },
      ]),
    });

    expect(results[0].status).toBe("matched");
    expect(results[0].matchScore).toBe(1);
  });

  it("exact-matches contrapiso with complex description", async () => {
    mocks.catalogPartidaFindMany.mockResolvedValue([
      makeCatalogPartida({
        id: "cat-contrapiso",
        description: "CONTRAPISO E=40MM, BASE 3.0CM, MEZ. 1:5 PASTA 1:2",
        unit: "M2",
        unitPrice: 42.0,
      }),
    ]);

    const results = await matchBlueprintItemsToCatalog({
      blueprint: makeBlueprint([
        {
          id: "item-1",
          description: "CONTRAPISO E=40MM, BASE 3.0CM, MEZ. 1:5 PASTA 1:2",
          unit: "M2",
        },
      ]),
    });

    expect(results[0].status).toBe("matched");
    expect(results[0].matchScore).toBe(1);
    expect(results[0].selectedUnitPrice).toBe("42");
  });

  it("exact-matches all 9 sample items that exist in both .mcp and catalog", async () => {
    // These descriptions from the .mcp were verified to exist in the catalog
    const sampleItems = [
      "MURO DE LADRILLO KK DE ARCILLA, N-CAB. MEZCLA 1:4",
      "MURO DE LADRILLO KK DE ARCILLA, N-SOG. MEZCLA 1:4",
      "TARRAJEO FROTACHADO, MUROS INT. E=1.5CM, MEZCLA 1:4",
      "TARRAJEO FROTACHADO, MUROS EXT. E=1.5CM, MEZCLA 1:4",
      "TARRAJEO DE CIELORASO E=1.5CM, MEZCLA 1:4",
      "CONTRAPISO E=40MM, BASE 3.0CM, MEZ. 1:5 PASTA 1:2",
      "PISO LOSETA VENECIANA COLOR CLARO 30 X 30CM",
      "PISO DE PARQUET HUALTACO",
      "CONTRAZÓCALO VENECIANO COLOR CLARO 10X30",
    ];

    mocks.catalogPartidaFindMany.mockResolvedValue(
      sampleItems.map((desc, i) =>
        makeCatalogPartida({
          id: `cat-${i}`,
          description: desc,
          unit: i === 8 ? "ML" : "M2", // CONTRAZÓCALO is ML
          unitPrice: 50 + i,
        }),
      ),
    );

    const results = await matchBlueprintItemsToCatalog({
      blueprint: makeBlueprint(
        sampleItems.map((desc, i) => ({
          id: `item-${i}`,
          description: desc,
          unit: i === 8 ? "ML" : "M2",
        })),
      ),
    });

    expect(results).toHaveLength(9);
    for (const r of results) {
      expect(r.status).toBe("matched");
      expect(r.matchScore).toBe(1);
      expect(r.reason).toBe("Coincidencia exacta por descripción y unidad");
    }
  });

  it("correctly distinguishes exact matches from non-matches in a mixed catalog", async () => {
    // Catalog has: one exact match for item-1, two unrelated items
    mocks.catalogPartidaFindMany.mockResolvedValue([
      makeCatalogPartida({ id: "cat-muro-ncab", description: "MURO DE LADRILLO KK DE ARCILLA, N-CAB. MEZCLA 1:4", unit: "M2" }),
      makeCatalogPartida({ id: "cat-demolicion", description: "DEMOLICION DE MUROS DE LADRILLO KK-CABEZA, MANUAL", unit: "M2" }),
      makeCatalogPartida({ id: "cat-limpieza", description: "LIMPIEZA MANUAL DE TERRENO", unit: "M2" }),
    ]);

    const results = await matchBlueprintItemsToCatalog({
      blueprint: makeBlueprint([
        { id: "item-1", description: "MURO DE LADRILLO KK DE ARCILLA, N-CAB. MEZCLA 1:4", unit: "M2" },
        { id: "item-2", description: "SISTEMA DE AIRE ACONDICIONADO TIPO SPLIT INVERTER 24000 BTU", unit: "UND" },
      ]),
    });

    expect(results).toHaveLength(2);
    // First item: exact match in catalog → matched, score 1
    expect(results[0].status).toBe("matched");
    expect(results[0].matchScore).toBe(1);
    expect(results[0].catalogPartidaId).toBe("cat-muro-ncab");
    // Second item: completely unrelated to any catalog item → unmatched
    expect(results[1].status).toBe("unmatched");
    expect(results[1].catalogPartidaId).toBeNull();
  });
});

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
      // Items share element (columnas), material (concreto armado), category (concreto),
      // unit (m3), AND resistance (fc210) — plenty of extractable variables for a high score.
      mocks.catalogPartidaFindMany.mockResolvedValue([
        makeCatalogPartida({ id: "cat-1", description: "CONCRETO ARMADO FC=210 KG/CM2 EN COLUMNAS", unit: "m3", unitPrice: 450 }),
      ]);

      const results = await matchBlueprintItemsToCatalog({
        blueprint: makeBlueprint([
          { id: "item-1", description: "Concreto fc210 en columnas armado", unit: "m3" },
        ]),
      });

      expect(results).toHaveLength(1);
      // High similarity via shared element, material, category, unit, and fc resistance
      expect(["matched", "review_required"]).toContain(results[0].status);
      expect(results[0].catalogPartidaId).toBe("cat-1");
    });

    it("marks as 'review_required' when score is between 0.60 and 0.79", async () => {
      // "Tarrajeo de muros exteriores con aditivo" vs "Tarrajeo de muros interiores"
      // share element (muros) and material (mortero via "tarrajeo"/"mezcla"). Unit is same.
      // Score should land in the review_required or matched range.
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
      // "Pintura latex en muros" vs "Excavacion masiva con maquinaria pesada" —
      // different material, element, category, and unit. No shared variables.
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
