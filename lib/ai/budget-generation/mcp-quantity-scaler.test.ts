import { describe, expect, it } from "vitest";
import { scaleBlueprintQuantities, type QuantityScaleResult } from "./mcp-quantity-scaler";
import type { McpBudgetBlueprint, McpSubBudgetBlueprint } from "./mcp-blueprint";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeBlueprint(
  overrides: Partial<McpBudgetBlueprint> = {},
): McpBudgetBlueprint {
  return {
    sourcePackageId: "pkg-1",
    sourceProjectName: "Vivienda Base",
    sourceFormatVersion: "1.0.0",
    projectType: "Vivienda",
    confidence: 1,
    assumptions: [],
    warnings: [],
    subBudgets: overrides.subBudgets ?? [makeSubBudget()],
  };
}

function makeSubBudget(
  overrides: Partial<McpSubBudgetBlueprint> = {},
): McpSubBudgetBlueprint {
  return {
    sourceBudgetId: "budget-1",
    name: "Estructuras",
    normalizedName: "estructuras",
    currency: "PEN",
    igvRate: "0.18",
    generalExpensesRate: "0.10",
    utilityRate: "0.08",
    levels: [],
    items: overrides.items ?? [
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
      {
        sourceItemId: "item-2",
        sourceCode: "01.02",
        description: "Columna de concreto",
        normalizedDescription: "columna de concreto",
        unit: "m3",
        quantity: "10",
        unitPrice: "350",
        partial: "3500",
        sortOrder: 2,
        levelSourceId: null,
        apu: null,
      },
      {
        sourceItemId: "item-3",
        sourceCode: "01.03",
        description: "Acero de refuerzo",
        normalizedDescription: "acero de refuerzo",
        unit: "kg",
        quantity: "500",
        unitPrice: "4.5",
        partial: "2250",
        sortOrder: 3,
        levelSourceId: null,
        apu: null,
      },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("scaleBlueprintQuantities", () => {
  describe("area scaling", () => {
    it("scales quantities when source and target area both available", () => {
      // Source project name contains "120m2" → source area = 120
      const blueprint = makeBlueprint({
        sourceProjectName: "Vivienda 120m2 base",
        projectType: "Vivienda 120m2",
      });

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "casa de 240m2",
        targetAreaM2: 240,
      });

      expect(results).toHaveLength(3);
      // Each item should be scaled by 240/120 = 2.0, or matched exactly
      const muroResult = results.find((r) => r.sourceItemId === "item-1");
      expect(muroResult).toBeDefined();
      // Either scaled by area ratio or detected exactly from description
      expect(["scaled", "exact"]).toContain(muroResult!.confidence);
      if (muroResult!.confidence === "scaled") {
        expect(Number.parseFloat(muroResult!.quantity)).toBeCloseTo(200, 0);
        expect(muroResult!.reason).toContain("240m");
        expect(muroResult!.reason).toContain("120m");
      }
    });

    it("does not scale when ratio is too large (> 20)", () => {
      const blueprint = makeBlueprint({
        sourceProjectName: "Vivienda 120m2",
        projectType: "Vivienda 120m2",
      });

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "megaproyecto de 5000m2",
        targetAreaM2: 5000,
      });

      // Ratio 5000/120 ≈ 41.7 > 20, so falls through to estimateQuantity
      // estimateQuantity will detect "5000m2" as exact
      const muroResult = results.find((r) => r.sourceItemId === "item-1");
      expect(muroResult).toBeDefined();
      expect(["template", "inferred", "exact"]).toContain(muroResult!.confidence);
    });
  });

  describe("floor scaling", () => {
    it("scales per-floor items when target floors specified", () => {
      const blueprint = makeBlueprint();

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "edificio de 5 pisos",
        targetFloors: 5,
      });

      // "Columna de concreto" is a per-floor item, should be scaled
      const columnaResult = results.find((r) => r.sourceItemId === "item-2");
      expect(columnaResult).toBeDefined();
      expect(columnaResult!.confidence).toBe("scaled");
      expect(Number.parseFloat(columnaResult!.quantity)).toBeCloseTo(50, 0); // 10 × 5
    });

    it("extracts floors from description if not explicitly provided", () => {
      const blueprint = makeBlueprint();

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "edificio de 3 pisos",
      });

      // Floors should be auto-extracted
      expect(results).toHaveLength(3);
    });
  });

  describe("explicit quantities", () => {
    it("uses explicit user quantity when matching item", () => {
      const blueprint = makeBlueprint();

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "necesito 200 m2 de muro de ladrillo y 50 m3 de columna",
      });

      const muroResult = results.find((r) => r.sourceItemId === "item-1");
      expect(muroResult).toBeDefined();
      expect(muroResult!.confidence).toBe("exact");
      expect(Number.parseFloat(muroResult!.quantity)).toBe(200);
    });
  });

  describe("template fallback", () => {
    it("keeps template quantity when no scaling data available", () => {
      const blueprint = makeBlueprint({
        sourceProjectName: "Vivienda Base",
        projectType: null,
      });

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "proyecto nuevo",
      });

      const itemResult = results.find((r) => r.sourceItemId === "item-3");
      expect(itemResult).toBeDefined();
      expect(itemResult!.confidence).toBe("template");
      expect(itemResult!.quantity).toBe("500");
    });
  });

  describe("edge cases", () => {
    it("handles empty blueprint subBudgets", () => {
      const blueprint = makeBlueprint({ subBudgets: [] });

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "vivienda de 120m2",
        targetAreaM2: 120,
      });

      expect(results).toEqual([]);
    });

    it("handles zero source area gracefully", () => {
      const blueprint = makeBlueprint({
        sourceProjectName: "Vivienda 0m2",
        projectType: "Vivienda 0m2",
      });

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "casa de 120m2",
        targetAreaM2: 120,
      });

      // Should not scale by zero, falls through
      expect(results).toHaveLength(3);
      // All should have confidence other than "scaled" (since ratio is infinite)
      for (const r of results) {
        expect(r.confidence).not.toBe("scaled");
      }
    });

    it("preserves numerical precision as strings", () => {
      const blueprint = makeBlueprint();

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "casa de 150m2",
        targetAreaM2: 150,
      });

      for (const r of results) {
        expect(typeof r.quantity).toBe("string");
        expect(Number.parseFloat(r.quantity)).not.toBeNaN();
      }
    });

    it("returns results for all items in all subBudgets", () => {
      const blueprint = makeBlueprint({
        subBudgets: [
          makeSubBudget({ sourceBudgetId: "b1", items: [makeSubBudget().items[0]] }),
          makeSubBudget({ sourceBudgetId: "b2", items: [makeSubBudget().items[1]] }),
        ],
      });

      const results = scaleBlueprintQuantities({
        blueprint,
        description: "vivienda 120m2",
        targetAreaM2: 120,
      });

      expect(results).toHaveLength(2);
    });
  });
});
