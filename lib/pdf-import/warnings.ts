import Decimal from "decimal.js";

import { calculateDecimalDifference, formatPdfImportMoney } from "./calculations";
import type { PdfAiImportDraft, PdfImportValidation, PdfImportedApu, PdfImportedBudgetItem } from "./types";

export type PdfImportWarningOptions = {
  priceTolerance: string;
  confidenceThreshold?: number;
};

export function createPdfImportWarnings(draft: PdfAiImportDraft, options: PdfImportWarningOptions): PdfAiImportDraft {
  const confidenceThreshold = options.confidenceThreshold ?? 0.65;
  const validations = [...draft.validations];
  const warnings = [...draft.warnings];
  const apusById = new Map(draft.apus.map((apu) => [apu.id, apu]));

  for (const budget of draft.budgets) {
    for (const item of budget.items) {
      addBudgetPartialValidation(validations, warnings, item);
      addLowConfidenceValidation(validations, warnings, item.id, item.description, item.evidence.confidence, confidenceThreshold);
    }
  }

  for (const link of draft.links) {
    if (link.kind !== "BUDGET_ITEM_APU" || !link.toId) {
      continue;
    }
    const item = findBudgetItemById(draft, link.fromId);
    const apu = apusById.get(link.toId);
    if (item && apu) {
      addBudgetApuPriceValidation(validations, warnings, item, apu, options.priceTolerance);
    }
  }

  return {
    ...draft,
    validations,
    warnings,
  };
}

function addBudgetPartialValidation(validations: PdfImportValidation[], warnings: string[], item: PdfImportedBudgetItem) {
  const expected = formatPdfImportMoney(new Decimal(item.quantity).times(item.unitPrice));
  if (calculateDecimalDifference(item.partial, expected).isZero()) {
    return;
  }

  const message = `La partida ${item.code} tiene parcial ${item.partial}; recalculado esperado ${expected}.`;
  pushUniqueValidation(validations, {
    id: `warning-${item.id}-partial-recalculated`,
    severity: "warning",
    code: "BUDGET_PARTIAL_RECALCULATED",
    message,
    entityId: item.id,
  });
  pushUniqueWarning(warnings, message);
}

function addBudgetApuPriceValidation(
  validations: PdfImportValidation[],
  warnings: string[],
  item: PdfImportedBudgetItem,
  apu: PdfImportedApu,
  priceTolerance: string,
) {
  const difference = calculateDecimalDifference(item.unitPrice, apu.totalUnitCost);
  if (difference.lte(priceTolerance)) {
    return;
  }

  const message = `La partida ${item.code} tiene P.U. ${item.unitPrice}; el APU vinculado recalcula ${apu.totalUnitCost}.`;
  pushUniqueValidation(validations, {
    id: `validation-${item.id}-price-mismatch`,
    severity: "error",
    code: "PRICE_MISMATCH",
    message,
    entityId: item.id,
  });
  pushUniqueWarning(warnings, message);
}

function addLowConfidenceValidation(
  validations: PdfImportValidation[],
  warnings: string[],
  entityId: string,
  description: string,
  confidence: number,
  confidenceThreshold: number,
) {
  if (confidence >= confidenceThreshold) {
    return;
  }

  const message = `${description} viene de evidencia OCR/IA de baja confianza (${(confidence * 100).toFixed(0)}%).`;
  pushUniqueValidation(validations, {
    id: `warning-${entityId}-low-confidence`,
    severity: "warning",
    code: "LOW_CONFIDENCE_OCR",
    message,
    entityId,
  });
  pushUniqueWarning(warnings, message);
}

function findBudgetItemById(draft: PdfAiImportDraft, itemId: string) {
  for (const budget of draft.budgets) {
    const item = budget.items.find((candidate) => candidate.id === itemId);
    if (item) {
      return item;
    }
  }
  return null;
}

function pushUniqueValidation(validations: PdfImportValidation[], validation: PdfImportValidation) {
  const exists = validations.some((current) => current.code === validation.code && current.entityId === validation.entityId);
  if (!exists) {
    validations.push(validation);
  }
}

function pushUniqueWarning(warnings: string[], warning: string) {
  if (!warnings.includes(warning)) {
    warnings.push(warning);
  }
}
