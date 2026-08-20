import Decimal from "decimal.js";

import { calculateDecimalDifference } from "./calculations";
import type { PdfAiImportDraft, PdfImportLink, PdfImportValidation, PdfImportedApu, PdfImportedBudgetItem } from "./types";

export type PdfImportLinkerOptions = {
  priceTolerance: string;
};

export function normalizePdfImportUnit(unit: string) {
  const normalized = unit
    .trim()
    .toLowerCase()
    .replaceAll(".", "")
    .replaceAll("²", "2")
    .replaceAll("³", "3");

  const aliases = new Map([
    ["metro cuadrado", "m2"],
    ["metros cuadrados", "m2"],
    ["m2", "m2"],
    ["m3", "m3"],
    ["metro cubico", "m3"],
    ["metros cubicos", "m3"],
    ["und", "und"],
    ["unidad", "und"],
    ["unidades", "und"],
    ["global", "glb"],
    ["glb", "glb"],
  ]);

  return aliases.get(normalized) ?? normalized;
}

export function normalizePdfImportCode(code: string) {
  return code
    .trim()
    .split(".")
    .map((part) => {
      const numeric = Number(part);
      return Number.isFinite(numeric) ? String(numeric) : part;
    })
    .join(".");
}

export function linkPdfImportDraft(draft: PdfAiImportDraft, options: PdfImportLinkerOptions): PdfAiImportDraft {
  const links: PdfImportLink[] = [];
  const validations: PdfImportValidation[] = [...draft.validations];
  const apusByCode = new Map<string, PdfImportedApu[]>();
  const linkedApuIds = new Set<string>();

  for (const apu of draft.apus) {
    const code = normalizePdfImportCode(apu.budgetItemCode ?? "");
    if (!code) {
      continue;
    }
    apusByCode.set(code, [...(apusByCode.get(code) ?? []), apu]);
  }

  for (const budget of draft.budgets) {
    for (const item of budget.items) {
      const link = createBudgetApuLink(item, apusByCode, draft.apus, options);
      links.push(link);
      if (link.toId) {
        linkedApuIds.add(link.toId);
      }
      if (link.status === "PRICE_MISMATCH" || link.status === "AMBIGUOUS") {
        validations.push({
          id: `validation-${link.id}`,
          severity: "error",
          code: link.status,
          message: link.reason,
          entityId: item.id,
        });
      }
    }
  }

  for (const apu of draft.apus) {
    if (linkedApuIds.has(apu.id)) {
      continue;
    }
    links.push({
      id: `link-${apu.id}-missing-budget-item`,
      fromId: apu.id,
      kind: "BUDGET_ITEM_APU",
      status: "MISSING_BUDGET_ITEM",
      confidence: 0,
      reason: "No se encontro una partida de presupuesto compatible para el APU.",
    });
  }

  for (const apu of draft.apus) {
    for (const row of apu.rows) {
      if (row.resourceType.toUpperCase() !== "SUBPARTIDA") {
        continue;
      }
      const subpartida = findSubpartidaCandidate(row.description, row.unit, draft.subpartidas);
      links.push({
        id: `link-${row.id}-${subpartida?.id ?? "missing-subpartida"}`,
        fromId: row.id,
        toId: subpartida?.id ?? null,
        kind: "APU_SUBPARTIDA",
        status: subpartida ? "MATCHED" : "NEEDS_REVIEW",
        confidence: subpartida ? 0.86 : 0.25,
        reason: subpartida ? "Descripcion y unidad de subpartida compatibles." : "La fila parece subpartida pero no se encontro detalle compatible.",
      });
    }
  }

  return {
    ...draft,
    links,
    validations,
    warnings: [...draft.warnings, ...validations.filter((validation) => validation.severity === "warning").map((validation) => validation.message)],
  };
}

function createBudgetApuLink(
  item: PdfImportedBudgetItem,
  apusByCode: Map<string, PdfImportedApu[]>,
  apus: PdfImportedApu[],
  options: PdfImportLinkerOptions,
): PdfImportLink {
  const itemCode = normalizePdfImportCode(item.code);
  const codeCandidates = apusByCode.get(itemCode) ?? [];
  const candidates = codeCandidates.length > 0 ? codeCandidates : findDescriptionCandidates(item, apus);

  if (candidates.length === 0) {
    return {
      id: `link-${item.id}-missing-apu`,
      fromId: item.id,
      kind: "BUDGET_ITEM_APU",
      status: "MISSING_APU",
      confidence: 0,
      reason: "No se encontro un APU compatible para la partida.",
    };
  }

  if (candidates.length > 1) {
    return {
      id: `link-${item.id}-ambiguous`,
      fromId: item.id,
      kind: "BUDGET_ITEM_APU",
      status: "AMBIGUOUS",
      confidence: 0.5,
      reason: "Hay mas de un APU compatible con la partida.",
    };
  }

  const apu = candidates[0]!;
  if (normalizePdfImportUnit(item.unit) !== normalizePdfImportUnit(apu.unit)) {
    return {
      id: `link-${item.id}-${apu.id}`,
      fromId: item.id,
      toId: apu.id,
      kind: "BUDGET_ITEM_APU",
      status: "UNIT_MISMATCH",
      confidence: 0.65,
      reason: "La unidad del presupuesto no coincide con la unidad del APU.",
    };
  }

  const difference = calculateDecimalDifference(item.unitPrice, apu.totalUnitCost);
  if (difference.gt(new Decimal(options.priceTolerance))) {
    return {
      id: `link-${item.id}-${apu.id}`,
      fromId: item.id,
      toId: apu.id,
      kind: "BUDGET_ITEM_APU",
      status: "PRICE_MISMATCH",
      confidence: 0.75,
      reason: `El precio unitario del presupuesto difiere del APU por ${difference.toFixed(2)}.`,
    };
  }

  return {
    id: `link-${item.id}-${apu.id}`,
    fromId: item.id,
    toId: apu.id,
    kind: "BUDGET_ITEM_APU",
    status: "MATCHED",
    confidence: codeCandidates.length > 0 ? 0.98 : 0.82,
    reason: codeCandidates.length > 0 ? "Codigo de partida coincidente." : "Descripcion y unidad compatibles.",
  };
}

function findDescriptionCandidates(item: PdfImportedBudgetItem, apus: PdfImportedApu[]) {
  const itemDescription = normalizeText(item.description);
  const itemUnit = normalizePdfImportUnit(item.unit);

  return apus.filter((apu) => normalizePdfImportUnit(apu.unit) === itemUnit && normalizeText(apu.name) === itemDescription);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findSubpartidaCandidate(
  description: string,
  unit: string,
  subpartidas: PdfAiImportDraft["subpartidas"],
) {
  const normalizedDescription = normalizeText(description);
  const normalizedUnit = normalizePdfImportUnit(unit);
  return subpartidas.find(
    (subpartida) =>
      normalizeText(subpartida.description) === normalizedDescription &&
      normalizePdfImportUnit(subpartida.unit) === normalizedUnit,
  );
}
