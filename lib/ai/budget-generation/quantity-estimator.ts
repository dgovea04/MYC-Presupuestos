import { normalizePartidaText } from "@/lib/partida-generation/text";

// ─── Types ──────────────────────────────────────────────────────────────────

export type QuantityEstimate = {
  value: number;
  confidence: "exact" | "inferred" | "default";
  source: string;
};

// ─── Patterns ───────────────────────────────────────────────────────────────

const QUANTITY_PATTERNS: Array<{
  regex: RegExp;
  unit: string | null;
  group: number;
}> = [
  // "120m2", "120 m2", "120m²", "120 metros cuadrados"
  { regex: /(\d+(?:\.\d+)?)\s*(?:m2|m²|metros?\s*cuadrados?)/i, unit: "m2", group: 1 },
  // "15m3", "15 m3", "15 metros cúbicos"
  { regex: /(\d+(?:\.\d+)?)\s*(?:m3|m³|metros?\s*cubicos?)/i, unit: "m3", group: 1 },
  // "50ml", "50 ml", "50 metros lineales"
  { regex: /(\d+(?:\.\d+)?)\s*(?:ml|metros?\s*lineales?)/i, unit: "ml", group: 1 },
  // "3km", "3 km", "3 kilómetros"
  { regex: /(\d+(?:\.\d+)?)\s*(?:km|kilometros?)/i, unit: "km", group: 1 },
  // "100kg", "100 kg"
  { regex: /(\d+(?:\.\d+)?)\s*(?:kg|kilos?)/i, unit: "kg", group: 1 },
  // "500 und", "500 und.", "500 unidades"
  { regex: /(\d+(?:\.\d+)?)\s*(?:und\.?|unidades?)/i, unit: "und", group: 1 },
  // "20 p2", "20 pies2"
  { regex: /(\d+(?:\.\d+)?)\s*(?:p2|pies?2|pies?\s*cuadrados?)/i, unit: "p2", group: 1 },
  // "10 glb", "10 global"
  { regex: /(\d+(?:\.\d+)?)\s*(?:glb|global)/i, unit: "glb", group: 1 },
  // "3 ha", "3 hectáreas"
  { regex: /(\d+(?:\.\d+)?)\s*(?:ha|hectareas?)/i, unit: "ha", group: 1 },
];

const FLOOR_MULTIPLIER_PATTERN = /(\d+)\s*(?:pisos?|niveles?|plantas?)/i;
const UNIT_AREA_ESTIMATES: Record<string, number> = {
  vivienda: 80,
  departamento: 75,
  oficina: 100,
  aula: 60,
  habitacion: 15,
};

// ─── Main function ──────────────────────────────────────────────────────────

export function estimateQuantity(
  description: string,
  partidaUnit: string,
): QuantityEstimate {
  const normalizedUnit = normalizePartidaUnit(partidaUnit);

  // Pre-process: preserve decimal numbers before normalization by replacing
  // dots in numbers with a placeholder, then normalize, then restore.
  const preserved = description.replace(/(\d)\.(\d)/g, "$1DOT$2");
  const normalizedDesc = normalizePartidaText(preserved).replace(/dot/g, ".");

  // 1. Try exact match: find a quantity with matching unit in the description
  for (const pattern of QUANTITY_PATTERNS) {
    const match = normalizedDesc.match(pattern.regex);
    if (match) {
      const value = Number.parseFloat(match[1]);
      if (!Number.isNaN(value) && value > 0) {
        // If the pattern has a specific unit, check if it matches the partida unit
        if (pattern.unit) {
          const patternUnitNormalized = normalizePartidaUnit(pattern.unit);
          if (patternUnitNormalized === normalizedUnit) {
            return { value, confidence: "exact", source: `"${match[0]}" en descripción` };
          }
          // Compatible units (e.g., m2 → m2 compatibles)
          if (areUnitsCompatible(patternUnitNormalized, normalizedUnit)) {
            return { value, confidence: "inferred", source: `"${match[0]}" en descripción (unidad compatible)` };
          }
        } else if (normalizedUnit === "und" || normalizedUnit === "glb") {
          return { value, confidence: "inferred", source: `"${match[0]}" en descripción` };
        }
      }
    }
  }

  // 2. Look for area-related estimates
  const areaMatch = normalizedDesc.match(QUANTITY_PATTERNS.find((p) => p.unit === "m2")!.regex);
  const areaValue = areaMatch ? Number.parseFloat(areaMatch[1]) : null;

  if (areaValue && normalizedUnit === "m2") {
    return { value: areaValue, confidence: "exact", source: `"${areaMatch![0]}" en descripción` };
  }

  // 3. Floor multiplier: "2 pisos" × estimated area per floor
  const floorMatch = normalizedDesc.match(FLOOR_MULTIPLIER_PATTERN);
  if (floorMatch && normalizedUnit === "m2") {
    const floors = Number.parseInt(floorMatch[1], 10);
    if (floors > 0 && floors <= 50) {
      // Try to find per-floor area estimate
      const estimatedAreaPerFloor = estimateAreaPerFloor(normalizedDesc);
      const totalArea = estimatedAreaPerFloor * floors;
      return {
        value: totalArea,
        confidence: "inferred",
        source: `${floors} pisos × ~${estimatedAreaPerFloor}m²/piso`,
      };
    }
  }

  // 4. Look for any numeric value that could be a quantity
  const genericNumberMatch = normalizedDesc.match(/(\d+(?:\.\d+)?)/);
  if (genericNumberMatch && isUnitCompatibleWithNumber(normalizedUnit)) {
    const value = Number.parseFloat(genericNumberMatch[1]);
    if (value > 0 && value < 100000) {
      return { value, confidence: "inferred", source: `número "${genericNumberMatch[0]}" detectado en descripción` };
    }
  }

  // 5. Default fallback
  return { value: 1, confidence: "default", source: "valor por defecto" };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizePartidaUnit(unit: string): string {
  return normalizePartidaText(unit)
    .replace(/\s/g, "")
    .replace(/²/g, "2")
    .replace(/³/g, "3");
}

function areUnitsCompatible(unitA: string, unitB: string): boolean {
  if (unitA === unitB) return true;

  const areaUnits = new Set(["m2", "ha", "p2", "km2"]);
  const volumeUnits = new Set(["m3"]);
  const lengthUnits = new Set(["m", "ml", "km"]);
  const countUnits = new Set(["und", "glb", "pza", "pieza", "jgo", "juego"]);

  const unitGroups = [areaUnits, volumeUnits, lengthUnits, countUnits];
  for (const group of unitGroups) {
    if (group.has(unitA) && group.has(unitB)) return true;
  }

  return false;
}

function isUnitCompatibleWithNumber(unit: string): boolean {
  // These units commonly use numbers > 1
  const compatible = new Set(["m2", "m3", "ml", "m", "kg", "und", "glb", "p2", "pza"]);
  return compatible.has(unit);
}

function estimateAreaPerFloor(normalizedDesc: string): number {
  for (const [keyword, area] of Object.entries(UNIT_AREA_ESTIMATES)) {
    if (normalizedDesc.includes(keyword)) {
      return area;
    }
  }
  return 100; // default: 100m² per floor
}
