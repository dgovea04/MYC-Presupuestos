import type { BudgetItemRecord } from "@/types/budget";

type BudgetReviewSummaryInput = {
  budgetName: string;
  currency: string;
  items: BudgetItemRecord[];
  totalDirectCost: number;
};

type ReviewLine = {
  id: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
};

const MAX_REVIEW_ITEMS = 120;
const SUSPICIOUS_UNITS = new Set(["", "glb", "global", "s/u", "und", "varios"]);

export function buildAiBudgetReviewSummary(input: BudgetReviewSummaryInput) {
  const lines = input.items
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .slice(0, MAX_REVIEW_ITEMS)
    .map(toReviewLine);

  const sections = [
    "Contexto para revision inteligente de presupuesto de construccion en Peru.",
    `Presupuesto: ${input.budgetName}`,
    `Moneda: ${input.currency}`,
    `Partidas enviadas: ${lines.length} de ${input.items.length}`,
    `Total costo directo: ${formatFixed(input.totalDirectCost, 2)}`,
    "",
    "Senales previas detectadas por el sistema:",
    buildDuplicateSignals(lines),
    buildSuspiciousUnitSignals(lines),
    buildQuantitySignals(lines),
    buildCostSignals(lines),
    "",
    "Partidas:",
    ...lines.map(formatReviewLine),
  ];

  return sections.join("\n");
}

function toReviewLine(item: BudgetItemRecord): ReviewLine {
  return {
    id: item.id,
    code: item.code || "s/c",
    description: item.description,
    unit: item.unit || "s/u",
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    partial: item.partial,
  };
}

function buildDuplicateSignals(lines: ReviewLine[]) {
  const duplicates: string[] = [];
  const seen = new Map<string, ReviewLine>();

  for (const line of lines) {
    const key = normalizeDescription(line.description);
    const previous = seen.get(key);

    if (previous) {
      duplicates.push(`${previous.id} <-> ${line.id}: "${previous.description}" / "${line.description}"`);
      continue;
    }

    seen.set(key, line);
  }

  return duplicates.length > 0 ? `- Duplicados potenciales: ${duplicates.join("; ")}` : "- Duplicados potenciales: no se detectaron coincidencias directas.";
}

function buildSuspiciousUnitSignals(lines: ReviewLine[]) {
  const suspicious = lines.filter((line) => SUSPICIOUS_UNITS.has(normalizeUnit(line.unit)));
  const duplicateUnitMismatches = getDuplicateUnitMismatches(lines);
  const signals = [
    ...suspicious.map((line) => `${line.id} usa unidad "${line.unit}"`),
    ...duplicateUnitMismatches.map(([left, right]) => `${left.id}/${right.id} tienen unidades distintas (${left.unit} vs ${right.unit})`),
  ];

  return signals.length > 0
    ? `- Unidades poco especificas o sospechosas: ${signals.join("; ")}`
    : "- Unidades poco especificas o sospechosas: no se detectaron alertas.";
}

function buildQuantitySignals(lines: ReviewLine[]) {
  const nonPositive = lines.filter((line) => line.quantity <= 0);
  const highQuantities = getHighOutliers(lines, (line) => line.quantity);
  const signals = [
    ...nonPositive.map((line) => `${line.id} tiene metrado ${formatFixed(line.quantity, 3)}`),
    ...highQuantities.map((line) => `${line.id} tiene metrado alto (${formatFixed(line.quantity, 3)}) frente al conjunto`),
  ];

  return signals.length > 0 ? `- Metrados no positivos o sospechosos: ${signals.join("; ")}` : "- Metrados no positivos o sospechosos: no se detectaron alertas.";
}

function buildCostSignals(lines: ReviewLine[]) {
  const zeroCosts = lines.filter((line) => line.unitPrice <= 0);
  const highCosts = getHighOutliers(lines, (line) => line.unitPrice);
  const signals = [
    ...zeroCosts.map((line) => `${line.id} tiene PU ${formatFixed(line.unitPrice, 2)}`),
    ...highCosts.map((line) => `${line.id} tiene PU alto (${formatFixed(line.unitPrice, 2)}) frente al conjunto`),
  ];

  return signals.length > 0 ? `- Costos unitarios fuera de rango interno: ${signals.join("; ")}` : "- Costos unitarios fuera de rango interno: no se detectaron alertas.";
}

function getDuplicateUnitMismatches(lines: ReviewLine[]) {
  const pairs: Array<[ReviewLine, ReviewLine]> = [];
  const seen = new Map<string, ReviewLine>();

  for (const line of lines) {
    const key = normalizeDescription(line.description);
    const previous = seen.get(key);

    if (previous && normalizeUnit(previous.unit) !== normalizeUnit(line.unit)) {
      pairs.push([previous, line]);
      continue;
    }

    seen.set(key, line);
  }

  return pairs;
}

function getHighOutliers(lines: ReviewLine[], selectValue: (line: ReviewLine) => number) {
  const positiveValues = lines.map(selectValue).filter((value) => value > 0).sort((left, right) => left - right);
  if (positiveValues.length < 3) return [];

  const median = positiveValues[Math.floor(positiveValues.length / 2)] ?? 0;
  if (median <= 0) return [];

  return lines.filter((line) => selectValue(line) >= median * 8);
}

function formatReviewLine(line: ReviewLine) {
  return `${line.code} | ${line.description} | ${line.unit} | metrado ${formatFixed(line.quantity, 3)} | PU ${formatFixed(line.unitPrice, 2)} | parcial ${formatFixed(line.partial, 2)}`;
}

function normalizeDescription(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/f['`]?\s*c/g, "fc")
    .replace(/kg\/cm2/g, "kg cm2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeUnit(value: string) {
  return value.trim().toLowerCase();
}

function formatFixed(value: number, fractionDigits: number) {
  return Number.isFinite(value) ? value.toFixed(fractionDigits) : (0).toFixed(fractionDigits);
}
