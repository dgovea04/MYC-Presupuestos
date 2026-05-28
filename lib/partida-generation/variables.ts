import { normalizePartidaText, normalizeUnit, uniqueTokens } from "@/lib/partida-generation/text";
import type { PartidaTechnicalVariables } from "@/types/partida-generation";

const ELEMENT_PATTERNS: Array<{ element: string; patterns: RegExp[] }> = [
  { element: "columnas", patterns: [/\bcolumnas?\b/] },
  { element: "placas", patterns: [/\bplacas?\b/, /\bmuros?\s+de\s+concreto\b/] },
  { element: "vigas", patterns: [/\bvigas?\b/] },
  { element: "losas", patterns: [/\blosas?\b/] },
  { element: "muros", patterns: [/\bmuros?\b/, /\bparedes?\b/] },
  { element: "zapatas", patterns: [/\bzapatas?\b/] },
  { element: "cimientos", patterns: [/\bcimientos?\b/, /\bcimentacion(?:es)?\b/] },
  { element: "excavaciones", patterns: [/\bexcavacion(?:es)?\b/, /\bexcavar\b/] },
];

const MATERIAL_PATTERNS: Array<{ material: string; category: string; patterns: RegExp[] }> = [
  { material: "concreto armado", category: "concreto", patterns: [/\bconcreto\b.*\barmado\b/, /\barmado\b.*\bconcreto\b/] },
  { material: "concreto", category: "concreto", patterns: [/\bconcreto\b/] },
  { material: "mortero", category: "acabados", patterns: [/\btarrajeo\b/, /\bmortero\b/, /\bmezcla\d+:\d+\b/] },
  { material: "acero", category: "estructuras", patterns: [/\bacero\b/, /\bfierro\b/] },
  { material: "madera", category: "encofrados", patterns: [/\bmadera\b/, /\bencofrado\b/] },
  { material: "tierra", category: "movimiento de tierras", patterns: [/\bexcavacion(?:es)?\b/, /\brelleno\b/] },
];

export function extractPartidaVariables(description: string, unit?: string | null): PartidaTechnicalVariables {
  const normalizedText = normalizePartidaText(description);
  const matchedMaterial = MATERIAL_PATTERNS.find((entry) => entry.patterns.some((pattern) => pattern.test(normalizedText)));
  const matchedElement = ELEMENT_PATTERNS.find((entry) => entry.patterns.some((pattern) => pattern.test(normalizedText)));
  const resistance = normalizedText.match(/\bfc(\d{2,4})\b/)?.[1] ?? null;
  const mixture = normalizedText.match(/\bmezcla\d+:\d+\b/)?.[0] ?? null;
  const technicalSpecs = [
    resistance ? `fc${resistance}` : null,
    mixture,
  ].filter((value): value is string => value !== null);

  return {
    normalizedText,
    material: matchedMaterial?.material ?? null,
    resistance,
    element: matchedElement?.element ?? null,
    category: matchedMaterial?.category ?? null,
    unit: unit ? normalizeUnit(unit) : null,
    technicalSpecs,
    keywords: uniqueTokens(description),
  };
}
