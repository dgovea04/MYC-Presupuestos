import type { WorkScheduleLineRecord } from "@/types/work-schedule";

/**
 * Construction phases used by the `by_front` work schedule generation strategy.
 *
 * Phases are ordered by their typical occurrence in a construction project:
 * preliminaries → earthwork → structure → masonry → installations → finishes → testing.
 * The `other` phase is used when no specific phase keyword is matched.
 */
export type WorkFrontPhase =
  | "preliminaries"
  | "earthwork"
  | "structure"
  | "masonry"
  | "installations"
  | "finishes"
  | "testing"
  | "other";

/**
 * Numeric order for each construction phase.
 *
 * Lower values represent earlier phases in the construction sequence.
 * Used by {@link sortWorkFrontLines} to order lines by phase.
 *
 * @example
 * ```ts
 * WORK_FRONT_PHASE_ORDER["earthwork"]; // 20
 * WORK_FRONT_PHASE_ORDER["structure"]; // 30
 * ```
 */
export const WORK_FRONT_PHASE_ORDER: Record<WorkFrontPhase, number> = {
  preliminaries: 10,
  earthwork: 20,
  structure: 30,
  masonry: 40,
  installations: 50,
  finishes: 60,
  testing: 70,
  other: 80,
};

/**
 * Keywords used to classify a budget line into a construction phase.
 *
 * Each phase has a list of normalized keywords (lowercase, no accents).
 * A line is classified into the first phase whose keyword list matches any
 * word in the line's searchable text (`itemCode + description + unit`).
 *
 * @example
 * ```ts
 * WORK_FRONT_PHASE_KEYWORDS["structure"]; // ["concreto", "hormigon", ...]
 * ```
 */
export const WORK_FRONT_PHASE_KEYWORDS: Record<WorkFrontPhase, readonly string[]> = {
  preliminaries: [
    "preliminar",
    "limpieza",
    "trazo",
    "replanteo",
    "cartel",
    "movilizacion",
    "campamento",
    "seguridad",
    "demolicion",
    "desalojo",
    "descombrado",
    "bodega",
    "oficina",
    "caseta",
  ],
  earthwork: [
    "excavacion",
    "corte",
    "relleno",
    "eliminacion",
    "movimiento de tierras",
    "nivelacion",
    "compactacion",
    "desbroce",
    "desmonte",
    "terraceria",
    "explanacion",
    "relleno",
  ],
  structure: [
    "concreto",
    "hormigon",
    "acero",
    "fierro",
    "encofrado",
    "desencofrado",
    "columna",
    "viga",
    "losa",
    "zapata",
    "cimentacion",
    "placa",
    "loseta",
    "escalera",
  ],
  masonry: [
    "muro",
    "ladrillo",
    "albanileria",
    "tabique",
    "asentado",
    "bloque",
    "pandereta",
    "mamposteria",
    "particion",
  ],
  installations: [
    "electrica",
    "sanitario",
    "sanitaria",
    "tuberia",
    "desague",
    "agua",
    "cable",
    "conduit",
    "tablero",
    "instalacion",
    "red",
    "ducto",
    "ventilacion",
    "climatizacion",
    "ascensor",
    "montacargas",
    "sprinkler",
    "gas",
    "telecomunicaciones",
    "datos",
    "fibra",
    "cctv",
    "aislante",
  ],
  finishes: [
    "pintura",
    "ceramico",
    "porcelanato",
    "enchape",
    "piso",
    "acabado",
    "cielo raso",
    "carpinteria",
    "puerta",
    "ventana",
    "drywall",
    "tablayeso",
    "vidrio",
    "techos",
    "yeso",
    "azulejo",
    "granito",
    "marmol",
    "parquet",
    "vinil",
    "epoxy",
    "impermeabilizacion",
    "baranda",
    "fachada",
    "mueble",
    "closet",
    "cocina",
  ],
  testing: [
    "prueba",
    "ensayo",
    "puesta en marcha",
    "limpieza final",
    "entrega",
    "recepcion",
    "certificacion",
    "inspeccion",
    "control de calidad",
  ],
  other: [],
};

/**
 * Resolves the effective keywords for a phase.
 *
 * If `customKeywords` contains a non-empty list for the phase, it is used as a
 * complete replacement for the default keywords. Otherwise the built-in defaults
 * are used. This keeps backward compatibility: callers that do not pass a
 * custom mapping continue to use the hard-coded keywords.
 *
 * @example
 * ```ts
 * const keywords = resolvePhaseKeywords("structure", { structure: ["hormigon"] });
 * // keywords === ["hormigon"]
 * ```
 */
export function resolvePhaseKeywords(
  phase: WorkFrontPhase,
  customKeywords?: Record<string, string[]> | null,
): readonly string[] {
  const override = customKeywords?.[phase];
  if (override && override.length > 0) {
    return override;
  }

  return WORK_FRONT_PHASE_KEYWORDS[phase];
}

// Classifies a line into a construction phase used by the `by_front` strategy.
// The order of checks matters: `testing` is evaluated first because words like
// "limpieza final", "entrega" or "recepcion" should be treated as final
// acceptance/testing even if they share words with earlier phases (e.g.
// "limpieza" also appears in `preliminaries`). After that, phases are checked
// in their natural construction sequence so that a line is assigned to the
// earliest matching phase.
export function classifyWorkFrontPhase(
  line: WorkScheduleLineRecord,
  customKeywords?: Record<string, string[]> | null,
): WorkFrontPhase {
  const text = normalizeScheduleText(`${line.itemCode} ${line.description} ${line.unit}`);

  // Testing must win over preliminaries/finishes when explicit final words are present.
  if (includesAnyKeyword(text, resolvePhaseKeywords("testing", customKeywords))) {
    return "testing";
  }

  if (includesAnyKeyword(text, resolvePhaseKeywords("preliminaries", customKeywords))) {
    return "preliminaries";
  }

  if (includesAnyKeyword(text, resolvePhaseKeywords("earthwork", customKeywords))) {
    return "earthwork";
  }

  if (includesAnyKeyword(text, resolvePhaseKeywords("structure", customKeywords))) {
    return "structure";
  }

  if (includesAnyKeyword(text, resolvePhaseKeywords("masonry", customKeywords))) {
    return "masonry";
  }

  if (includesAnyKeyword(text, resolvePhaseKeywords("installations", customKeywords))) {
    return "installations";
  }

  if (includesAnyKeyword(text, resolvePhaseKeywords("finishes", customKeywords))) {
    return "finishes";
  }

  return "other";
}

function getWorkFrontPhaseOrder(phase: WorkFrontPhase) {
  return WORK_FRONT_PHASE_ORDER[phase];
}

export function sortWorkFrontLines(lines: WorkFrontLine[]) {
  return [...lines].sort((left, right) => {
    const phaseDifference = getWorkFrontPhaseOrder(left.phase) - getWorkFrontPhaseOrder(right.phase);
    if (phaseDifference !== 0) {
      return phaseDifference;
    }

    return left.originalIndex - right.originalIndex;
  });
}

export type WorkFrontLine = {
  line: WorkScheduleLineRecord;
  phase: WorkFrontPhase;
  originalIndex: number;
};

function normalizeScheduleText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAnyKeyword(value: string, keywords: readonly string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}
