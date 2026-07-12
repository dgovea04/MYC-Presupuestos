import { normalizePartidaText } from "@/lib/partida-generation/text";

// ─── Constants ──────────────────────────────────────────────────────────────

/**
 * Pares de nombres que deben considerarse equivalentes.
 * Ej: "inst. electricas" → "instalaciones electricas"
 */
const NAME_EQUIVALENCES: Array<[string, string]> = [
  ["inst. electricas", "instalaciones electricas"],
  ["inst. sanitarias", "instalaciones sanitarias"],
  ["inst electricas", "instalaciones electricas"],
  ["inst sanitarias", "instalaciones sanitarias"],
  ["arquitectonico", "arquitectura"],
  ["estruct", "estructuras"],
  ["elec", "instalaciones electricas"],
  ["sanit", "instalaciones sanitarias"],
];

/** Umbral de Jaccard para considerar que dos nombres son iguales. */
const NAME_SIMILARITY_THRESHOLD = 0.6;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Normaliza un nombre de sub-presupuesto para comparación.
 *
 * Reglas:
 * - Minúsculas
 * - Sin tildes
 * - Expansión de abreviaturas comunes (inst. electricas → instalaciones electricas)
 * - Trim de espacios
 */
export function normalizeSubBudgetName(name: string): string {
  let normalized = normalizePartidaText(name.trim());

  // Apply equivalences (longest first to avoid partial replacements)
  const sortedEquivalences = [...NAME_EQUIVALENCES].sort(
    (a, b) => b[0].length - a[0].length,
  );

  for (const [abbrev, full] of sortedEquivalences) {
    if (normalized === normalizePartidaText(abbrev)) {
      return normalizePartidaText(full);
    }
    // Check if the normalized name starts with the abbreviation
    if (normalized.startsWith(normalizePartidaText(abbrev))) {
      normalized = normalizePartidaText(full) + normalized.slice(normalizePartidaText(abbrev).length);
    }
  }

  return normalized;
}

/**
 * Compara dos nombres de sub-presupuesto para determinar si son el mismo.
 *
 * Usa normalización + comparación de tokens Jaccard-like.
 */
export function isSameSubBudgetName(left: string, right: string): boolean {
  const a = normalizeSubBudgetName(left);
  const b = normalizeSubBudgetName(right);

  if (a === b) return true;

  // Token-based comparison
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);

  if (tokensA.length === 0 || tokensB.length === 0) return false;

  const intersection = tokensA.filter((t) => tokensB.includes(t));
  const union = [...new Set([...tokensA, ...tokensB])];

  const jaccard = intersection.length / union.length;
  return jaccard >= NAME_SIMILARITY_THRESHOLD;
}

/**
 * Mapea un nombre de sub-presupuesto MCP a uno existente en el proyecto.
 *
 * Retorna el nombre existente si hay match, o null si no hay correspondencia.
 */
export function mapMcpSubBudgetToExisting(input: {
  mcpName: string;
  existingNames: string[];
}): string | null {
  const normalizedMcp = normalizeSubBudgetName(input.mcpName);

  for (const existing of input.existingNames) {
    if (isSameSubBudgetName(input.mcpName, existing)) {
      return existing;
    }
  }

  return null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .filter((t) => !["de", "del", "la", "el", "los", "las", "y", "e", "o"].includes(t));
}
