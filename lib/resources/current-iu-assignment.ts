import { normalizeResourceIuCode } from "@/lib/resources/iu";
import type { UnifiedIndexDictionaryRow } from "@/types/unified-index";

type UnifiedIndexLookupRow = {
  code: string;
  name: string;
};

type ResolveCurrentResourceIuInput = {
  description: string;
  category: string;
  legacyIu?: string | null;
  unifiedIndices: UnifiedIndexLookupRow[];
  dictionaryRows: UnifiedIndexDictionaryRow[];
};

const MIN_DICTIONARY_SCORE = 0.82;

export function resolveCurrentResourceIu(input: ResolveCurrentResourceIuInput): string | null {
  const availableCodes = new Set(input.unifiedIndices.map((index) => normalizeLookupCode(index.code)).filter((code): code is string => Boolean(code)));
  const description = normalizeCatalogText(input.description);
  const manualCode = resolveManualCurrentIuCode(description, input.category);

  if (manualCode && availableCodes.has(manualCode)) {
    return normalizeResourceIuCode(manualCode);
  }

  const dictionaryCode = resolveDictionaryCurrentIuCode({
    description,
    legacyIu: input.legacyIu,
    availableCodes,
    dictionaryRows: input.dictionaryRows,
  });

  if (dictionaryCode) {
    return normalizeResourceIuCode(dictionaryCode);
  }

  const normalizedLegacyIu = normalizeLookupCode(input.legacyIu);
  return normalizedLegacyIu && availableCodes.has(normalizedLegacyIu)
    ? normalizeResourceIuCode(normalizedLegacyIu)
    : null;
}

function resolveManualCurrentIuCode(description: string, category: string) {
  if (category === "LABOR") {
    return "47";
  }

  if (description.includes("CEMENTO")) {
    return "21";
  }

  if (description.includes("LUBRICANTE") || description.includes("LUBRICANTES")) {
    return "1";
  }

  if (
    description.includes("CONCRETO PREMEZCLADO") ||
    description.includes("PRODUCCION CONCRETO") ||
    description.includes("PRODUCCION DE CONCRETO") ||
    description.includes("CONCRETO HIDRAULICO") ||
    description.includes("CONCRETO CLASE")
  ) {
    return "80";
  }

  if (
    !description.includes("VINILICA") &&
    !description.includes("PVC") &&
    !description.includes("FRAGUA") &&
    !description.includes("PEGAMENTO") &&
    (
      description.includes("BALDOSA") ||
      description.includes("CERAMICA") ||
      description.includes("CERAMICO") ||
      description.includes("MAYOLICA") ||
      description.includes("PORCELANATO")
    )
  ) {
    return "24";
  }

  if (
    description.includes("ACERO CORRUGADO") ||
    description.includes("ACERO DE REFUERZO") ||
    description.includes("ACERO REFUERZO") ||
    description.includes("F Y") ||
    description.includes("FY") ||
    description.includes("GRADO 60") ||
    description.includes("VARILLA DE ACERO")
  ) {
    return "3";
  }

  if (
    description.includes("ALAMBRE THW") ||
    description.includes("ALAMBRE TW") ||
    description.includes("ALAMBRE LSOH") ||
    description.includes("CABLE THW") ||
    description.includes("CABLE TW") ||
    description.includes("CABLE LSOH")
  ) {
    return "7";
  }

  if (
    description.includes("ACERO DE CONSTRUCCION LISO") ||
    description.includes("ACERO LISO") ||
    description.includes("ALAMBRE DE ACERO") ||
    description.includes("CLAVO") ||
    description.includes("MALLA DE ACERO")
  ) {
    return "2";
  }

  if (description.includes("LADRILLO") || description.includes("BLOQUE")) {
    return "17";
  }

  if (
    description.includes("ARENA FINA") ||
    description.includes("ARENA ZARANDEADA") ||
    description.includes("AGREGADO FINO")
  ) {
    return "4";
  }

  if (
    description.includes("AGREGADO GRUESO") ||
    description.includes("ARENA GRUESA") ||
    description.includes("PIEDRA CHANCADA") ||
    description.includes("GRAVA") ||
    description.includes("CONFITILLO")
  ) {
    return "5";
  }

  if (
    description.includes("TUBO PVC ELECTRICO") ||
    description.includes("TUBO DE PVC ELECTRICO") ||
    description.includes("TUBERIA PVC SAP") ||
    description.includes("TUBO DE PVC SAP") ||
    description.includes("TUBO PVC SAP") ||
    description.includes("UNION UNIVERSAL PVC") ||
    description.includes("ACCESORIOS Y PEGAMENTO")
  ) {
    return "72";
  }

  if (
    description.includes("TUBERIA DE PVC") ||
    description.includes("TUBO DE PVC") ||
    description.includes("TUBO PVC")
  ) {
    return "66";
  }

  if (
    description.includes("CODO FIERRO GALVANIZADO") ||
    description.includes("CAJA OCTOGONAL GALV") ||
    description.includes("CAJA ELECTR") ||
    description.includes("CONECTOR BR") ||
    description.includes("VALVULA")
  ) {
    return "65";
  }

  if (
    description.includes("MADERA") ||
    description.includes("TRIPLAY") ||
    description.includes("ENCOFRADO") ||
    description.includes("TABLA ") ||
    description.includes("TABLON")
  ) {
    return "43";
  }

  if (description.includes("HERRAMIENTA MANUAL") || description.includes("HERRAMIENTAS MANUALES")) {
    return "37";
  }

  if (
    description.includes("MOTONIVELADORA") ||
    description.includes("VOLQUETE") ||
    description.includes("CAMION") ||
    description.includes("JUMBO") ||
    description.includes("DUMPER") ||
    description.includes("PLATAFORMA DE TRABAJO") ||
    description.includes("PERFORACION") ||
    description.includes("PERFORACIÓN")
  ) {
    return "49";
  }

  if (
    description.includes("MEZCLADORA") ||
    description.includes("VIBRADOR") ||
    description.includes("COMPACTADOR") ||
    description.includes("RODILLO LISO VIBRATORIO MANUAL") ||
    description.includes("MAQUINA PARA PINTAR") ||
    description.includes("SOLDADORA") ||
    description.includes("EQUIPO DE CORTE") ||
    description.includes("EQUIPO DE PINTURA") ||
    description.includes("SHOTCRETERA") ||
    description.includes("BOMBA MANUAL") ||
    description.includes("GATA HIDRAULICA") ||
    description.includes("CIZALLA") ||
    description.includes("MIRAS Y JALONES") ||
    description.includes("MIRA TOPOGRAFICA") ||
    description.includes("ESTACION TOTAL")
  ) {
    return "48";
  }

  if (
    description.includes("FLETE") ||
    description.includes("TRANSPORTE") ||
    description.includes("MOVILIZACION") ||
    description.includes("DESMOVILIZACION") ||
    description.includes("MOVILIZACIÓN") ||
    description.includes("DESMOVILIZACIÓN")
  ) {
    return "32";
  }

  return null;
}

function resolveDictionaryCurrentIuCode(input: {
  description: string;
  legacyIu?: string | null;
  availableCodes: Set<string>;
  dictionaryRows: UnifiedIndexDictionaryRow[];
}) {
  const descriptionTokens = toTokenSet(input.description);
  const normalizedLegacyIu = normalizeLookupCode(input.legacyIu);
  let bestMatch: { code: string; score: number; tokenCount: number } | null = null;

  for (const row of input.dictionaryRows) {
    const code = normalizeLookupCode(row.code);
    if (!code || !input.availableCodes.has(code)) {
      continue;
    }

    const element = normalizeCatalogText(row.element);
    const elementTokens = [...toTokenSet(element)];
    if (elementTokens.length === 0) {
      continue;
    }

    const phraseMatch = input.description.includes(element);
    const matchingTokens = elementTokens.filter((token) => descriptionTokens.has(token)).length;
    const coverage = matchingTokens / elementTokens.length;
    const score = coverage + (phraseMatch ? 0.35 : 0) + (normalizedLegacyIu === code ? 0.1 : 0);

    if (score < MIN_DICTIONARY_SCORE) {
      continue;
    }

    if (
      !bestMatch ||
      score > bestMatch.score ||
      (score === bestMatch.score && elementTokens.length > bestMatch.tokenCount)
    ) {
      bestMatch = { code, score, tokenCount: elementTokens.length };
    }
  }

  return bestMatch?.code ?? null;
}

function normalizeLookupCode(value: string | null | undefined) {
  const normalized = normalizeResourceIuCode(value);
  return normalized?.replace(/^0+(?=\d)/, "") ?? null;
}

function normalizeCatalogText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

function toTokenSet(value: string) {
  return new Set(value.split(" ").filter((token) => token.length > 1));
}
