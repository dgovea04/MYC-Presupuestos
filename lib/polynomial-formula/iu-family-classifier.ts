export type PolynomialIuFamily =
  | "LABOR"
  | "GENERAL_EXPENSES"
  | "STEEL"
  | "CEMENT"
  | "AGGREGATES"
  | "MASONRY"
  | "WOOD"
  | "FINISHES"
  | "SANITARY_INSTALLATIONS"
  | "ELECTRICAL_INSTALLATIONS"
  | "EQUIPMENT"
  | "OTHERS";

type UnifiedIndexFamilyInput = {
  code: string;
  name: string;
};

const familyByKnownCode: Record<string, PolynomialIuFamily> = {
  "47": "LABOR",
  "39": "GENERAL_EXPENSES",
  "1": "OTHERS",
  "2": "STEEL",
  "3": "STEEL",
  "4": "AGGREGATES",
  "21": "CEMENT",
  "5": "AGGREGATES",
  "17": "MASONRY",
  "43": "WOOD",
  "41": "WOOD",
  "54": "FINISHES",
  "16": "FINISHES",
  "24": "FINISHES",
  "72": "SANITARY_INSTALLATIONS",
  "65": "SANITARY_INSTALLATIONS",
  "7": "ELECTRICAL_INSTALLATIONS",
};

export function normalizeUnifiedIndexCodeForPolynomialFormula(code: string | null | undefined): string {
  const trimmed = (code ?? "").trim();
  if (!trimmed) return "";

  const withoutLeadingZeros = trimmed.replace(/^0+(?=\d)/, "");
  return withoutLeadingZeros || "0";
}

function normalizeToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function classifyUnifiedIndexForPolynomialFormula(
  index: UnifiedIndexFamilyInput,
): PolynomialIuFamily {
  const byCode = familyByKnownCode[normalizeUnifiedIndexCodeForPolynomialFormula(index.code)];
  if (byCode) return byCode;

  const name = normalizeToken(index.name);
  if (name.includes("MANO DE OBRA")) return "LABOR";
  if (name.includes("INDICE GENERAL")) return "GENERAL_EXPENSES";
  if (name.includes("ACERO")) return "STEEL";
  if (name.includes("CEMENTO")) return "CEMENT";
  if (name.includes("AGREGADO") || name.includes("ARENA")) return "AGGREGATES";
  if (name.includes("LADRILLO") || name.includes("BLOQUE")) return "MASONRY";
  if (name.includes("MADERA")) return "WOOD";
  if (name.includes("PINTURA") || name.includes("CERAMICA") || name.includes("BALDOSA")) {
    return "FINISHES";
  }
  if (name.includes("TUBERIA") || name.includes("PVC") || name.includes("SANITAR")) {
    return "SANITARY_INSTALLATIONS";
  }
  if (name.includes("CABLE") || name.includes("ALAMBRE") || name.includes("ELECTRIC")) {
    return "ELECTRICAL_INSTALLATIONS";
  }
  if (name.includes("EQUIPO") || name.includes("MAQUIN")) return "EQUIPMENT";

  return "OTHERS";
}
