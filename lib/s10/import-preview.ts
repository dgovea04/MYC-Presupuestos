import type { BudgetRecord } from "@/types/budget";
import type { ResourceCategory } from "@/types/resource";
import {
  createMycImportDraftFromS10,
  type MycS10ImportDraft,
  type S10ApuImportStatus,
  type S10ExportSnapshot,
  type S10ImportMapperOptions,
} from "@/lib/s10/import-mapper";

export type S10ImportDraftPreviewBudget = {
  id: string;
  kind: BudgetRecord["kind"];
  name: string;
  totalDirectCost: number;
  totalAmount: number;
  itemCount: number;
  apuCount: number;
  items: S10ImportDraftPreviewItem[];
};

export type S10ImportDraftPreviewItem = {
  budgetName: string;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  apuResourceCount: number;
  apuStatus: S10ApuImportStatus;
  calculatedApuUnitPrice?: number;
  unitPriceDifference?: number;
};

export type S10ImportDraftPreview = {
  source: "S10";
  sourceBudgetCode: string;
  projectName: string;
  resourceCount: number;
  resourcesByCategory: Record<ResourceCategory, number>;
  budgets: S10ImportDraftPreviewBudget[];
  sampleItems: S10ImportDraftPreviewItem[];
  warnings: string[];
};

const defaultSampleItemLimit = 20;

export function createS10ImportDraftPreview(
  snapshot: S10ExportSnapshot,
  options: S10ImportMapperOptions & { sampleItemLimit?: number } = {},
): S10ImportDraftPreview {
  return summarizeS10ImportDraft(createMycImportDraftFromS10(snapshot, options), options.sampleItemLimit ?? defaultSampleItemLimit);
}

export function summarizeS10ImportDraft(draft: MycS10ImportDraft, sampleItemLimit = defaultSampleItemLimit): S10ImportDraftPreview {
  const resourcesByCategory = createEmptyResourceCategoryCounts();

  for (const resource of draft.resources) {
    resourcesByCategory[resource.category] += 1;
  }
  const itemMetadataById = new Map(draft.itemMetadata.map((metadata) => [metadata.budgetItemId, metadata]));

  return {
    source: "S10",
    sourceBudgetCode: draft.sourceBudgetCode,
    projectName: draft.project.name,
    resourceCount: draft.resources.length,
    resourcesByCategory,
    budgets: draft.budgets.map((budget) => ({
      id: budget.id,
      kind: budget.kind,
      name: budget.name,
      totalDirectCost: budget.totalDirectCost,
      totalAmount: budget.totalAmount,
      itemCount: budget.items.length,
      apuCount: budget.items.filter((item) => item.apu != null).length,
      items: createPreviewItemsForBudget(budget, itemMetadataById),
    })),
    sampleItems: createSampleItems(draft.budgets, itemMetadataById, sampleItemLimit),
    warnings: draft.warnings,
  };
}

export function parseS10ExportSnapshotJson(json: string): S10ExportSnapshot {
  const parsed: unknown = JSON.parse(stripBom(json));

  if (!isS10ExportSnapshot(parsed)) {
    throw new Error("El JSON no tiene la estructura esperada de un snapshot S10.");
  }

  return parsed;
}

function createSampleItems(
  budgets: BudgetRecord[],
  itemMetadataById: Map<string, MycS10ImportDraft["itemMetadata"][number]>,
  limit: number,
): S10ImportDraftPreviewItem[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  const items: S10ImportDraftPreviewItem[] = [];

  for (const budget of budgets.filter((entry) => entry.kind === "SUB_BUDGET")) {
    for (const item of budget.items) {
      if (items.length >= safeLimit) {
        return items;
      }

      items.push({
        ...createPreviewItem(budget, item, itemMetadataById),
      });
    }
  }

  return items;
}

function createPreviewItemsForBudget(
  budget: BudgetRecord,
  itemMetadataById: Map<string, MycS10ImportDraft["itemMetadata"][number]>,
): S10ImportDraftPreviewItem[] {
  return budget.items.map((item) => createPreviewItem(budget, item, itemMetadataById));
}

function createPreviewItem(
  budget: BudgetRecord,
  item: BudgetRecord["items"][number],
  itemMetadataById: Map<string, MycS10ImportDraft["itemMetadata"][number]>,
): S10ImportDraftPreviewItem {
  const metadata = itemMetadataById.get(item.id);

  return {
    budgetName: budget.name,
    code: item.code,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    partial: item.partial,
    apuResourceCount: item.apu?.resources.length ?? 0,
    apuStatus: metadata?.apuStatus ?? (item.apu ? "OK" : "MISSING"),
    calculatedApuUnitPrice: metadata?.calculatedApuUnitPrice,
    unitPriceDifference: metadata?.unitPriceDifference,
  };
}

function createEmptyResourceCategoryCounts(): Record<ResourceCategory, number> {
  return {
    MATERIAL: 0,
    LABOR: 0,
    EQUIPMENT: 0,
    TOOLS: 0,
    SUBCONTRACT: 0,
  };
}

function isS10ExportSnapshot(value: unknown): value is S10ExportSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.presupuestos) &&
    Array.isArray(value.subpresupuestos) &&
    Array.isArray(value.partidas) &&
    Array.isArray(value.apuDetalles)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stripBom(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
