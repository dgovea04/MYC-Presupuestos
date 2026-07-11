import { estimateQuantity } from "./quantity-estimator";
import type { McpBudgetBlueprint } from "./mcp-blueprint";

// ─── Types ──────────────────────────────────────────────────────────────────

export type QuantityScaleResult = {
  sourceItemId: string;
  quantity: string;
  confidence: "exact" | "scaled" | "inferred" | "template" | "default";
  reason: string;
};

// ─── Main function ──────────────────────────────────────────────────────────

export function scaleBlueprintQuantities(input: {
  blueprint: McpBudgetBlueprint;
  description: string;
  targetAreaM2?: number | null;
  targetFloors?: number | null;
}): QuantityScaleResult[] {
  const { description, targetAreaM2, targetFloors } = input;

  // Try to extract source area from the blueprint's assumptions or description
  const sourceAreaM2 = extractAreaFromDescription(
    input.blueprint.sourceProjectName + " " + input.blueprint.projectType,
  );

  // Parse target description for area, floors, and explicit quantities
  const targetArea = targetAreaM2 ?? extractAreaFromDescription(description);
  const targetFloorsParsed = targetFloors ?? extractFloorsFromDescription(description);
  const explicitQuantities = extractExplicitQuantities(description);

  const results: QuantityScaleResult[] = [];

  for (const sb of input.blueprint.subBudgets) {
    for (const item of sb.items) {
      const sourceQty = parseDecimalString(item.quantity);

      // 1. Check for explicit user-specified quantity matching this item
      const explicitQty = explicitQuantities.find((eq) => {
        const itemDesc = item.normalizedDescription;
        const eqDesc = eq.keywords;
        return eqDesc.some((kw) => itemDesc.includes(kw));
      });

      if (explicitQty) {
        results.push({
          sourceItemId: item.sourceItemId,
          quantity: String(explicitQty.value),
          confidence: "exact",
          reason: `Cantidad explícita del usuario: ${explicitQty.value} (detectado "${explicitQty.raw}")`,
        });
        continue;
      }

      // 2. Scale by area ratio if both source and target area available
      if (sourceAreaM2 && targetArea && sourceAreaM2 > 0) {
        const ratio = targetArea / sourceAreaM2;
        if (ratio > 0.1 && ratio < 20) {
          // Only scale within reasonable bounds
          const scaledQty = sourceQty * ratio;
          results.push({
            sourceItemId: item.sourceItemId,
            quantity: String(Math.round(scaledQty * 10000) / 10000),
            confidence: "scaled",
            reason: `Escalado por área: ${sourceQty} × (${targetArea}m² / ${sourceAreaM2}m²) = ~${scaledQty.toFixed(2)}`,
          });
          continue;
        }
      }

      // 3. Scale by floors factor
      if (targetFloorsParsed && isPerFloorItem(item)) {
        const scaledQty = sourceQty * targetFloorsParsed;
        results.push({
          sourceItemId: item.sourceItemId,
          quantity: String(Math.round(scaledQty * 10000) / 10000),
          confidence: "scaled",
          reason: `Escalado por pisos: ${sourceQty} × ${targetFloorsParsed} pisos = ${scaledQty.toFixed(2)}`,
        });
        continue;
      }

      // 4. Use quantity estimator
      const estimated = estimateQuantity(description, item.unit);
      if (estimated.confidence === "exact" || estimated.confidence === "inferred") {
        results.push({
          sourceItemId: item.sourceItemId,
          quantity: String(estimated.value),
          confidence: estimated.confidence,
          reason: `${estimated.source}`,
        });
        continue;
      }

      // 5. Keep template quantity
      results.push({
        sourceItemId: item.sourceItemId,
        quantity: item.quantity,
        confidence: "template",
        reason: "Cantidad conservada de la plantilla (sin datos para escalar)",
      });
    }
  }

  return results;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseDecimalString(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function extractAreaFromDescription(description: string): number | null {
  const match = description.match(
    /(\d+(?:\.\d+)?)\s*(?:m2|m²|metros?\s*cuadrados?)/i,
  );
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function extractFloorsFromDescription(description: string): number | null {
  const match = description.match(/(\d+)\s*(?:pisos?|niveles?|plantas?)/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return value > 0 && value <= 100 ? value : null;
}

function extractExplicitQuantities(
  description: string,
): Array<{ raw: string; value: number; unit: string; keywords: string[] }> {
  // Match patterns like "10 m2 de muro", "500 kg de acero", "3 und de puerta"
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(m2|m²|metros?\s*cuadrados?)\s+(?:de\s+)?(\w[\w\s]{2,40})/gi,
    /(\d+(?:\.\d+)?)\s*(m3|m³|metros?\s*cubicos?)\s+(?:de\s+)?(\w[\w\s]{2,40})/gi,
    /(\d+(?:\.\d+)?)\s*(kg|kilos?)\s+(?:de\s+)?(\w[\w\s]{2,40})/gi,
    /(\d+(?:\.\d+)?)\s*(ml|metros?\s*lineales?)\s+(?:de\s+)?(\w[\w\s]{2,40})/gi,
    /(\d+(?:\.\d+)?)\s*(und\.?|unidades?)\s+(?:de\s+)?(\w[\w\s]{2,40})/gi,
  ];

  const results: Array<{
    raw: string;
    value: number;
    unit: string;
    keywords: string[];
  }> = [];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(description)) !== null) {
      const raw = match[0];
      const value = Number.parseFloat(match[1]);
      let unit = match[2].toLowerCase();
      const context = match[3] || "";

      // Normalize unit
      if (unit.includes("m2") || unit.includes("m²") || unit.includes("cuadrado")) unit = "m2";
      else if (unit.includes("m3") || unit.includes("m³") || unit.includes("cubic")) unit = "m3";
      else if (unit.includes("kg") || unit.includes("kilo")) unit = "kg";
      else if (unit.includes("ml") || unit.includes("lineal")) unit = "ml";
      else if (unit.includes("und") || unit.includes("unidad")) unit = "und";
      else unit = "und";

      if (Number.isFinite(value) && value > 0) {
        const keywords = context
          .split(/\s+/)
          .filter((w) => w.length > 2)
          .map((w) => w.toLowerCase());

        results.push({ raw: raw.trim(), value, unit, keywords });
      }
    }
  }

  return results;
}

function isPerFloorItem(item: { unit: string; description: string }): boolean {
  const desc = item.description.toLowerCase();
  const perFloorKeywords = [
    "columna", "viga", "losa", "muro", "escalera",
    "luminaria", "interruptor", "tomacorriente", "tablero",
    "montante", "bajante", "ventilacion",
  ];
  return perFloorKeywords.some((kw) => desc.includes(kw));
}
