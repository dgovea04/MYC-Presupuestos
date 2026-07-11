import { normalizePartidaText } from "@/lib/partida-generation/text";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BudgetGenerationProjectType =
  | "vivienda"
  | "edificio"
  | "colegio"
  | "hospital"
  | "carretera"
  | "industrial"
  | "otro";

export type BudgetGenerationIntent = {
  projectId?: string;
  companyId: string;
  description: string;
  projectType: BudgetGenerationProjectType;
  areaM2: number | null;
  floors: number | null;
  location: string | null;
  currency: "PEN" | "USD";
  templateSource: "auto" | "mcp" | "project" | "catalog";
  previewOnly: boolean;
};

// ─── Project type synonyms (canonical location) ─────────────────────────────

export const PROJECT_TYPE_SYNONYMS: Record<string, string[]> = {
  vivienda: [
    "casa", "departamento", "vivienda", "habitacional",
    "residencial", "condominio", "multifamiliar", "unifamiliar",
  ],
  edificio: [
    "edificio", "edificación", "oficina", "comercial", "corporativo", "torre",
  ],
  hospital: [
    "hospital", "clinica", "posta", "salud", "medico", "sanitario",
  ],
  colegio: [
    "colegio", "escuela", "instituto", "universidad", "aula", "educativo",
  ],
  carretera: [
    "carretera", "pista", "pavimento", "via", "camino", "autopista", "tramo",
  ],
  industrial: [
    "industrial", "fabrica", "planta", "almacen", "galpon", "nave",
  ],
};

// ─── Related type groups (cross-type affinity) ────────────────────────────
// When a candidate belongs to one group and the query targets another group
// in the same affinity set, give partial credit (0.6) instead of 0.
// Example: "edificación" (edificio) ↔ "vivienda" queries
export const RELATED_TYPE_GROUPS: Array<Set<string>> = [
  new Set(["vivienda", "edificio"]),
];

/**
 * Returns the related type score (0.6) if the candidate's canonical type
 * and any of the detected types belong to the same affinity group.
 */
export function getRelatedTypeScore(
  candidateCanonicalType: string,
  detectedTypes: string[],
): number {
  for (const group of RELATED_TYPE_GROUPS) {
    if (group.has(candidateCanonicalType)) {
      for (const detected of detectedTypes) {
        if (group.has(detected) && detected !== candidateCanonicalType) {
          return 0.8;
        }
      }
    }
  }
  return 0;
}

/**
 * Finds the canonical project type key for a given type string.
 * E.g., "edificación" → "edificio", "casa" → "vivienda".
 * Returns null if no match is found.
 */
export function findCanonicalType(normalizedType: string): string | null {
  for (const [key, synonyms] of Object.entries(PROJECT_TYPE_SYNONYMS)) {
    if (normalizedType === key || synonyms.some((s) => normalizedType.includes(normalizePartidaText(s)))) {
      return key;
    }
  }
  return null;
}

const LOCATION_PATTERNS: Array<{ regex: RegExp; city: string }> = [
  { regex: /\b(lima|san\s+miguel|miraflores|san\s+isidro|surco|la\s+molina|san\s+borja|barranco|chorrillos|callao|san\s+juan\s+de\s+lurigancho|san\s+juan\s+de\s+miraflores|villa\s+el\s+salvador|villa\s+maria\s+del\s+triunfo|comas|los\s+olivos|independencia|san\s+martin\s+de\s+porres|puente\s+piedra|carabayllo|ancon|santa\s+rosa|ventanilla)\b/i, city: "Lima" },
  { regex: /\b(arequipa|cayma|cercado|paucarpata|miraflores\s+arequipa)\b/i, city: "Arequipa" },
  { regex: /\b(cusco|cuzco|wanchaq|san\s+sebastian|san\s+jerónimo)\b/i, city: "Cusco" },
  { regex: /\b(trujillo|la\s+libertad|huanchaco|moche|victor\s+larco)\b/i, city: "Trujillo" },
  { regex: /\b(piura|sullana|paita|talara|castilla)\b/i, city: "Piura" },
  { regex: /\b(chiclayo|lambayeque|ferreñafe|chongoyape)\b/i, city: "Chiclayo" },
  { regex: /\b(huancayo|junin|el\s+tambo|chilca)\b/i, city: "Huancayo" },
  { regex: /\b(iquitos|loreto|maynas|belen|punchana)\b/i, city: "Iquitos" },
  { regex: /\b(pucallpa|ucayali|coronel\s+portillo|calleria|yarinacocha)\b/i, city: "Pucallpa" },
  { regex: /\b(tacna|alto\s+de\s+la\s+alianza|ciudad\s+nueva|gregorio\s+albarracin)\b/i, city: "Tacna" },
  { regex: /\b(cajamarca|baños\s+del\s+inca)\b/i, city: "Cajamarca" },
  { regex: /\b(ayacucho|huamanga|san\s+juan\s+bautista|carmen\s+alto)\b/i, city: "Ayacucho" },
  { regex: /\b(ica|chincha|pisco|nazca|paracas)\b/i, city: "Ica" },
  { regex: /\b(puno|juliaca)\b/i, city: "Puno" },
  { regex: /\b(huanuco|amarilis|pillco\s+marca)\b/i, city: "Huánuco" },
  { regex: /\b(chimbote|ancash|nuevo\s+chimbote|huaraz)\b/i, city: "Chimbote" },
];

// ─── Area & floor patterns ──────────────────────────────────────────────────

const AREA_PATTERN = /(\d+(?:\.\d+)?)\s*(?:m2|m²|metros?\s*cuadrados?)/i;
const FLOOR_PATTERN = /(\d+)\s*(?:pisos?|niveles?|plantas?)/i;
const HECTARE_PATTERN = /(\d+(?:\.\d+)?)\s*(?:ha|hectareas?|hectáreas?)/i;

// ─── Currency detection ─────────────────────────────────────────────────────

const USD_KEYWORDS = /\b(?:usd|dólares?|dolares?|dollar)\b/i;
const SOLES_KEYWORDS = /\b(?:pen|soles?|s\/\.?)\b/i;

// ─── Main extraction function ───────────────────────────────────────────────

export function extractBudgetGenerationIntent(input: {
  description: string;
  companyId: string;
  projectId?: string;
  explicitProjectType?: string;
  explicitTemplateSource?: BudgetGenerationIntent["templateSource"];
}): BudgetGenerationIntent {
  const normalized = normalizePartidaText(input.description);

  // 1. Project type
  const projectType = extractProjectType(normalized, input.explicitProjectType);

  // 2. Area (m2)
  const areaM2 = extractAreaM2(normalized);

  // 3. Floors
  const floors = extractFloors(normalized);

  // 4. Location
  const location = extractLocation(input.description);

  // 5. Currency
  const currency = extractCurrency(input.description);

  return {
    projectId: input.projectId,
    companyId: input.companyId,
    description: input.description,
    projectType,
    areaM2,
    floors,
    location,
    currency,
    templateSource: input.explicitTemplateSource ?? "auto",
    previewOnly: false,
  };
}

// ─── Public helpers ─────────────────────────────────────────────────────────

/**
 * Detects project types from a user description.
 * Returns an array of matching type keys (e.g., ["vivienda", "edificio"]).
 * Used by project-similarity and mcp-template-search for scoring.
 */
export function detectProjectTypes(
  description: string,
  explicitType?: string,
): string[] {
  const normalized = normalizePartidaText(description);
  const types: string[] = [];

  if (explicitType) {
    types.push(normalizePartidaText(explicitType));
  }

  for (const [type, synonyms] of Object.entries(PROJECT_TYPE_SYNONYMS)) {
    if (synonyms.some((s) => normalized.includes(s))) {
      types.push(type);
    }
  }

  return [...new Set(types)];
}

// ─── Private extraction helpers ─────────────────────────────────────────────

function extractProjectType(
  normalized: string,
  explicitType?: string,
): BudgetGenerationProjectType {
  if (explicitType) {
    const mapped = mapToProjectType(explicitType);
    if (mapped) return mapped;
  }

  const detected = detectProjectTypes(normalized);
  if (detected.length > 0) {
    const first = detected[0];
    if (isValidProjectType(first)) return first;
  }

  return "otro";
}

function mapToProjectType(value: string): BudgetGenerationProjectType | null {
  const normalized = normalizePartidaText(value);
  // Check if the value is already a valid type
  if (isValidProjectType(normalized)) return normalized as BudgetGenerationProjectType;
  // Check synonyms (normalize synonyms too to avoid accent mismatches)
  for (const [type, synonyms] of Object.entries(PROJECT_TYPE_SYNONYMS)) {
    if (synonyms.some((s) => normalizePartidaText(s) === normalized)) return type as BudgetGenerationProjectType;
  }
  return null;
}

function isValidProjectType(value: string): value is BudgetGenerationProjectType {
  return ["vivienda", "edificio", "colegio", "hospital", "carretera", "industrial", "otro"].includes(
    value,
  );
}

function extractAreaM2(normalized: string): number | null {
  // Try m2 first
  const m2Match = normalized.match(AREA_PATTERN);
  if (m2Match) {
    const value = Number.parseFloat(m2Match[1]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  // Try hectares (convert to m2)
  const haMatch = normalized.match(HECTARE_PATTERN);
  if (haMatch) {
    const value = Number.parseFloat(haMatch[1]);
    if (Number.isFinite(value) && value > 0) return value * 10000;
  }
  return null;
}

function extractFloors(normalized: string): number | null {
  const match = normalized.match(FLOOR_PATTERN);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return value > 0 && value <= 100 ? value : null;
}

function extractLocation(description: string): string | null {
  const lower = description.toLowerCase();
  for (const pattern of LOCATION_PATTERNS) {
    const match = lower.match(pattern.regex);
    if (match) return pattern.city;
  }
  return null;
}

function extractCurrency(description: string): "PEN" | "USD" {
  const lower = description.toLowerCase();
  if (USD_KEYWORDS.test(lower)) return "USD";
  if (SOLES_KEYWORDS.test(lower)) return "PEN";
  return "PEN"; // default Peruvian market
}
