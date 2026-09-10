import Decimal from "decimal.js";
import { normalizeUnit } from "./units";
import type { EvidenceType } from "./types";

export interface NormalizedEvidenceMetadata {
  code?: string;
  description?: string;
  quantity?: Decimal;
  unitPrice?: Decimal;
  unit?: string;
  technicalSpecification?: string;
  discipline?: string;
  yield?: Decimal;
  attributes?: Record<string, string>;
  apuComponents?: string[];
  evidenceType?: EvidenceType;
}

const aliases = {
  code: ["code", "codigo"],
  description: ["description", "descripcion"],
  quantity: ["quantity", "cantidad", "metrado", "qty"],
  unitPrice: ["unitprice", "precio", "preciounitario", "precio_unitario"],
  unit: ["unit", "unidad"],
  technicalSpecification: ["technicalspecification", "technicalspec", "spec", "especificacion"],
  discipline: ["discipline", "disciplina"],
  yield: ["yield", "rendimiento", "performance"],
  apuComponents: ["apucomponents", "componentes", "componente", "recurso"],
  evidenceType: ["evidencetype", "tipoevidencia"],
} as const;

const recognizedKeys: Set<string> = new Set(Object.values(aliases).flatMap((keys) => keys));
const numericTextPattern = /^[+-]?(?:(?:\d+(?:[.,]\d*)?)|(?:[.,]\d+))(?:[eE][+-]?\d+)?$/;

function keyOf(value: string): string {
  return value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function textValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function firstValue(metadata: Record<string, unknown>, names: readonly string[]): unknown {
  for (const name of names) {
    const matchingEntry = Object.entries(metadata).find(([key]) => keyOf(key) === name);
    if (matchingEntry) return matchingEntry[1];
  }
  return undefined;
}

export function parseDecimalText(value: unknown): Decimal | undefined {
  if (value instanceof Decimal) return value.isFinite() ? value : undefined;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? new Decimal(value) : undefined;

  const trimmed = value.trim();
  if (!numericTextPattern.test(trimmed)) return undefined;
  const normalized = trimmed.replace(",", ".");
  try {
    const decimal = new Decimal(normalized);
    return decimal.isFinite() ? decimal : undefined;
  } catch {
    return undefined;
  }
}

function componentsValue(value: unknown): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const components = value.split(/[;,|]/).map((component) => component.trim()).filter(Boolean);
  return components.length > 0 ? components : undefined;
}

function stringAttributes(metadata: Record<string, unknown>): Record<string, string> | undefined {
  const attributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!recognizedKeys.has(keyOf(key)) && keyOf(key) !== "attributes") attributes[key] = value == null ? "" : String(value);
  }
  const supplied = metadata.attributes;
  if (supplied && typeof supplied === "object" && !Array.isArray(supplied)) {
    for (const [key, value] of Object.entries(supplied)) attributes[key] = value == null ? "" : String(value);
  }
  return Object.keys(attributes).length > 0 ? attributes : undefined;
}

function evidenceTypeValue(value: unknown): EvidenceType | undefined {
  return typeof value === "string" && ["QUANTITY", "UNIT", "TECHNICAL_SPECIFICATION", "DOCUMENT_REFERENCE", "APU_COMPONENT", "OTHER"].includes(value)
    ? value as EvidenceType
    : undefined;
}

export function normalizeEvidenceMetadata(metadata: Record<string, unknown>): NormalizedEvidenceMetadata {
  const quantity = parseDecimalText(firstValue(metadata, aliases.quantity));
  const unitPrice = parseDecimalText(firstValue(metadata, aliases.unitPrice));
  const yieldValue = parseDecimalText(firstValue(metadata, aliases.yield));
  const rawUnit = textValue(firstValue(metadata, aliases.unit));
  const normalizedUnit = rawUnit === undefined ? undefined : normalizeUnit(rawUnit);
  const technicalSpecification = textValue(firstValue(metadata, aliases.technicalSpecification));
  const normalized: NormalizedEvidenceMetadata = {
    code: textValue(firstValue(metadata, aliases.code)),
    description: textValue(firstValue(metadata, aliases.description)),
    quantity,
    unitPrice,
    unit: normalizedUnit === undefined ? undefined : normalizedUnit.dimension === "unknown" ? rawUnit : normalizedUnit.canonical,
    technicalSpecification,
    discipline: textValue(firstValue(metadata, aliases.discipline)),
    yield: yieldValue,
    attributes: stringAttributes(metadata),
    apuComponents: componentsValue(firstValue(metadata, aliases.apuComponents)),
    evidenceType: evidenceTypeValue(firstValue(metadata, aliases.evidenceType)),
  };

  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined)) as NormalizedEvidenceMetadata;
}

export function classifyEvidenceType(metadata: NormalizedEvidenceMetadata): EvidenceType {
  if (metadata.quantity !== undefined) return "QUANTITY";
  if (metadata.technicalSpecification !== undefined) return "TECHNICAL_SPECIFICATION";
  if (metadata.apuComponents !== undefined && metadata.apuComponents.length > 0) return "APU_COMPONENT";
  if (metadata.unit !== undefined) return "UNIT";
  return metadata.evidenceType ?? "OTHER";
}
