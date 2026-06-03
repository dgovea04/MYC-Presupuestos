export type PolynomialMonomialDisplayMetadata = {
  code: string;
  name: string;
  baseIndexCode: string;
  baseIndexName: string;
};

export type PolynomialIuDisplayFamily =
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

export const IU_MONOMIAL_METADATA: Record<string, { code: string; name: string }> = {
  "1": { code: "ALU", name: "ACEITE Y LUBRICANTE" },
  "2": { code: "AL", name: "ACERO DE CONSTRUCCION LISO" },
  "3": { code: "AC", name: "ACERO DE CONSTRUCCION CORRUGADO" },
  "4": { code: "AF", name: "AGREGADO FINO" },
  "5": { code: "AG", name: "AGREGADO GRUESO" },
  "17": { code: "BL", name: "BLOQUES Y LADRILLOS" },
  "21": { code: "CE", name: "CEMENTO PORTLAND E HIDRAULICO" },
  "37": { code: "HM", name: "HERRAMIENTA MANUAL" },
  "39": { code: "GU", name: "INDICE GENERAL DE PRECIOS AL CONSUMIDOR" },
  "43": { code: "MAD", name: "MADERA NACIONAL PARA ENCOFRADO Y CARPINTERIA" },
  "47": { code: "MO", name: "MANO DE OBRA (INCLUYE LEYES SOCIALES)" },
};

const IU_FAMILY_METADATA: Record<string, PolynomialIuDisplayFamily> = {
  "1": "OTHERS",
  "2": "STEEL",
  "3": "STEEL",
  "4": "AGGREGATES",
  "5": "AGGREGATES",
  "17": "MASONRY",
  "21": "CEMENT",
  "37": "EQUIPMENT",
  "39": "GENERAL_EXPENSES",
  "43": "WOOD",
  "47": "LABOR",
};

export function normalizePolynomialBaseIndexCode(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  const codeMatch = trimmed.match(/^\d+/);
  if (!codeMatch) return trimmed;

  return codeMatch[0].replace(/^0+(?=\d)/, "") || "0";
}

export function formatPolynomialIuCodeForDisplay(value: string | null | undefined): string {
  const normalizedCode = normalizePolynomialBaseIndexCode(value);
  if (!normalizedCode) return "";

  return /^\d+$/.test(normalizedCode) ? normalizedCode.padStart(2, "0") : normalizedCode;
}

export function formatPolynomialIuNameForDisplay(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s+\([a-z]\)\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function resolvePolynomialMonomialDisplayMetadata(input: {
  code: string;
  name: string;
  baseIndexCode: string;
  baseIndexName: string;
  fallbackIndexName?: string | null;
}): PolynomialMonomialDisplayMetadata {
  const baseIndexCode = normalizePolynomialBaseIndexCode(input.baseIndexCode);
  const iuMetadata = IU_MONOMIAL_METADATA[baseIndexCode];
  const displayBaseIndexCode = formatPolynomialIuCodeForDisplay(baseIndexCode);

  if (!baseIndexCode) {
    return {
      code: input.code,
      name: input.name,
      baseIndexCode: input.baseIndexCode,
      baseIndexName: input.baseIndexName,
    };
  }

  const rawBaseIndexName =
    iuMetadata?.name ||
    input.fallbackIndexName?.trim() ||
    (input.baseIndexName === "Pendiente de asignar" ? "" : input.baseIndexName.trim());
  const baseIndexName = formatPolynomialIuNameForDisplay(rawBaseIndexName);

  if (!baseIndexName) {
    return {
      code: input.code,
      name: input.name,
      baseIndexCode,
      baseIndexName: input.baseIndexName,
    };
  }

  return {
    code: iuMetadata?.code ?? input.code,
    name: `IU ${displayBaseIndexCode} : ${baseIndexName}`,
    baseIndexCode,
    baseIndexName,
  };
}

export function resolvePolynomialUnifiedIndexDisplay(input: {
  code?: string | null;
  name?: string | null;
}): { code?: string; name?: string } {
  const normalizedCode = normalizePolynomialBaseIndexCode(input.code);
  if (!normalizedCode) {
    return {
      code: input.code?.trim() || undefined,
      name: input.name?.trim() || undefined,
    };
  }

  const explicitName = input.name?.trim();
  const embeddedName = input.code?.includes(":")
    ? input.code.split(":").slice(1).join(":").trim()
    : "";
  const metadataName = IU_MONOMIAL_METADATA[normalizedCode]?.name;

  return {
    code: normalizedCode,
    name: metadataName || explicitName || embeddedName || undefined,
  };
}

export function resolvePolynomialIuFamilyDisplay(input: {
  code?: string | null;
  family?: string | null;
}): string | undefined {
  const normalizedCode = normalizePolynomialBaseIndexCode(input.code);
  const familyFromCode = normalizedCode ? IU_FAMILY_METADATA[normalizedCode] : undefined;

  return familyFromCode ?? input.family?.trim() ?? undefined;
}
