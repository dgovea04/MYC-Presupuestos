import { describe, expect, it } from "vitest";
import { estimateQuantity } from "./quantity-estimator";

describe("estimateQuantity", () => {
  // ─── Exact matches ────────────────────────────────────────────────────────

  describe("exact matches", () => {
    it('parses "120m2" + unit="m2" → 120 (confidence: exact)', () => {
      const result = estimateQuantity("Losa de concreto de 120m2", "m2");
      expect(result.value).toBe(120);
      expect(result.confidence).toBe("exact");
      expect(result.source).toContain("120m2");
    });

    it('parses "15 m3" + unit="m3" → 15 (confidence: exact)', () => {
      const result = estimateQuantity("Excavación masiva de 15 m3", "m3");
      expect(result.value).toBe(15);
      expect(result.confidence).toBe("exact");
    });

    it('parses "50 ml" + unit="ml" → 50 (confidence: exact)', () => {
      const result = estimateQuantity("Sardinel de 50 ml", "ml");
      expect(result.value).toBe(50);
      expect(result.confidence).toBe("exact");
    });

    it('parses "3 km" + unit="km" → 3 (confidence: exact)', () => {
      const result = estimateQuantity("Carretera de 3 km", "km");
      expect(result.value).toBe(3);
      expect(result.confidence).toBe("exact");
    });

    it('parses "100 kg" + unit="kg" → 100 (confidence: exact)', () => {
      const result = estimateQuantity("Acero de refuerzo 100 kg", "kg");
      expect(result.value).toBe(100);
      expect(result.confidence).toBe("exact");
    });

    it('parses "500 und" + unit="und" → 500 (confidence: exact)', () => {
      const result = estimateQuantity("Ladrillos 500 und", "und");
      expect(result.value).toBe(500);
      expect(result.confidence).toBe("exact");
    });

    it('parses "20 p2" + unit="p2" → 20 (confidence: exact)', () => {
      const result = estimateQuantity("Encofrado de 20 p2", "p2");
      expect(result.value).toBe(20);
      expect(result.confidence).toBe("exact");
    });

    it('parses "10 glb" + unit="glb" → 10 (confidence: exact)', () => {
      const result = estimateQuantity("Limpieza general 10 glb", "glb");
      expect(result.value).toBe(10);
      expect(result.confidence).toBe("exact");
    });

    it('parses "3 ha" + unit="ha" → 3 (confidence: exact)', () => {
      const result = estimateQuantity("Terreno de 3 ha", "ha");
      expect(result.value).toBe(3);
      expect(result.confidence).toBe("exact");
    });

    it('parses "3 hectáreas" + unit="ha" → 3 (confidence: exact)', () => {
      const result = estimateQuantity("Movimiento de tierras en 3 hectáreas", "ha");
      expect(result.value).toBe(3);
      expect(result.confidence).toBe("exact");
    });

    it('parses "5 km" + unit="km" → 5 (confidence: exact)', () => {
      const result = estimateQuantity("Carretera de 5 km", "km");
      expect(result.value).toBe(5);
      expect(result.confidence).toBe("exact");
    });
  });

  // ─── Compatible units (inferred) ──────────────────────────────────────────

  describe("compatible units (inferred confidence)", () => {
    it('parses "120m2" with partida unit "m2" → exact even with space variant', () => {
      const result = estimateQuantity("Piso de cerámico 120 metros cuadrados", "m2");
      expect(result.value).toBe(120);
      expect(result.confidence).toBe("exact");
    });

    it('parses "15 metros cúbicos" with unit "m3" → 15 (exact, accents normalized)', () => {
      const result = estimateQuantity("Relleno compactado 15 metros cúbicos", "m3");
      expect(result.value).toBe(15);
      expect(result.confidence).toBe("exact");
    });
  });

  // ─── Floor multiplier ─────────────────────────────────────────────────────

  describe("floor multiplier", () => {
    it('estimates "casa de 2 pisos" + unit "m2" → inferred area', () => {
      const result = estimateQuantity("casa de 2 pisos, concreto armado", "m2");
      expect(result.value).toBeGreaterThan(0);
      expect(result.confidence).toBe("inferred");
      expect(result.source).toContain("pisos");
    });

    it('estimates "edificio 5 niveles" + unit "m2" → inferred area', () => {
      const result = estimateQuantity("edificio 5 niveles", "m2");
      expect(result.value).toBeGreaterThan(0);
      expect(result.confidence).toBe("inferred");
    });

    it('estimates "3 plantas" + unit "m2" → inferred area', () => {
      const result = estimateQuantity("vivienda de 3 plantas, 120m2 por planta", "m2");
      // The floor multiplier might be overridden by the exact 120m2 match
      expect(result.value).toBe(120);
      expect(result.confidence).toBe("exact");
    });
  });

  // ─── Generic number fallback ──────────────────────────────────────────────

  describe("generic number fallback", () => {
    it('detects a number from description for m2 unit', () => {
      const result = estimateQuantity("Construcción de 200", "m2");
      // 200 is detected as a generic number
      expect(result.value).toBe(200);
      expect(result.confidence).toBe("inferred");
    });

    it('detects a number from description for und unit', () => {
      const result = estimateQuantity("Instalación de 15 puntos", "und");
      expect(result.value).toBe(15);
      expect(result.confidence).toBe("inferred");
    });
  });

  // ─── Default fallback ─────────────────────────────────────────────────────

  describe("default fallback", () => {
    it("returns 1 with default confidence when no quantity is found", () => {
      const result = estimateQuantity("Tarrajeo de muros interiores", "m2");
      expect(result.value).toBe(1);
      expect(result.confidence).toBe("default");
    });

    it("returns 1 with default confidence for vague descriptions", () => {
      const result = estimateQuantity("Varios trabajos de acabado", "glb");
      expect(result.value).toBe(1);
      expect(result.confidence).toBe("default");
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("handles empty description gracefully", () => {
      const result = estimateQuantity("", "m2");
      expect(result.value).toBe(1);
    });

    it("handles very large numbers appropriately", () => {
      const result = estimateQuantity("Movimiento de tierras 50000 m3", "m3");
      expect(result.value).toBe(50000);
      expect(result.confidence).toBe("exact");
    });

    it("handles decimal quantities", () => {
      const result = estimateQuantity("Pintura de 2.5 m2", "m2");
      expect(result.value).toBe(2.5);
      expect(result.confidence).toBe("exact");
    });

    it("always returns a number for any valid unit", () => {
      const units = ["m2", "m3", "ml", "km", "kg", "und", "glb", "p2", "ha", "pza"];
      for (const unit of units) {
        const result = estimateQuantity("Trabajo de prueba", unit);
        expect(typeof result.value).toBe("number");
        expect(result.value).toBeGreaterThan(0);
        expect(["exact", "inferred", "default"]).toContain(result.confidence);
      }
    });
  });
});
