import type { BudgetRecord } from "@/types/budget";
import type { ResourceCategory } from "@/types/resource";
import {
  createMycImportDraftFromS10,
  type MycS10ImportDraft,
  type ImportSourceSystem,
  type S10ApuImportStatus,
  type S10ExportSnapshot,
  type S10ImportMapperOptions,
} from "@/lib/s10/import-mapper";

export type S10ImportDraftPreviewBudget = {
  id: string;
  kind: BudgetRecord["kind"];
  name: string;
  igvRate: number;
  generalExpensesRate: number;
  utilityRate: number;
  totalDirectCost: number;
  totalAmount: number;
  itemCount: number;
  apuCount: number;
  footerRows: S10ImportDraftPreviewFooterRow[];
  rows: S10ImportDraftPreviewRow[];
  items: S10ImportDraftPreviewItem[];
};

export type S10ImportDraftPreviewFooterRow = {
  variable: string;
  description: string;
  formula?: string | null;
  manualValue: number;
  highlight: boolean;
  sortOrder: number;
};

export type S10ImportDraftPreviewLevel = {
  kind: "LEVEL";
  budgetName: string;
  code: string;
  description: string;
  levelType: BudgetRecord["levels"][number]["type"];
  depth: number;
  sortOrder: number;
};

export type S10ImportDraftPreviewItemRow = S10ImportDraftPreviewItem & {
  kind: "ITEM";
  levelCode?: string | null;
  depth: number;
  sortOrder: number;
};

export type S10ImportDraftPreviewRow = S10ImportDraftPreviewLevel | S10ImportDraftPreviewItemRow;

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
  source: ImportSourceSystem;
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
  const footerRowsByBudgetId = new Map(draft.budgetFooterRows.map((entry) => [entry.budgetId, entry.rows]));

  return {
    source: draft.source,
    sourceBudgetCode: draft.sourceBudgetCode,
    projectName: draft.project.name,
    resourceCount: draft.resources.length,
    resourcesByCategory,
    budgets: draft.budgets.map((budget) => ({
      id: budget.id,
      kind: budget.kind,
      name: budget.name,
      igvRate: budget.igvRate,
      generalExpensesRate: budget.generalExpensesRate,
      utilityRate: budget.utilityRate,
      totalDirectCost: budget.totalDirectCost,
      totalAmount: budget.totalAmount,
      itemCount: budget.items.length,
      apuCount: budget.items.filter((item) => item.apu != null).length,
      footerRows: (footerRowsByBudgetId.get(budget.id) ?? [])
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((row) => ({
          variable: row.variable,
          description: row.description,
          formula: row.formula,
          manualValue: row.manualValue,
          highlight: row.highlight,
          sortOrder: row.sortOrder,
        })),
      rows: createPreviewRowsForBudget(budget, itemMetadataById),
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

function createPreviewRowsForBudget(
  budget: BudgetRecord,
  itemMetadataById: Map<string, MycS10ImportDraft["itemMetadata"][number]>,
): S10ImportDraftPreviewRow[] {
  const levelsById = new Map(budget.levels.map((level) => [level.id, level]));
  const rows: S10ImportDraftPreviewRow[] = [
    ...budget.levels.map((level): S10ImportDraftPreviewLevel => ({
      kind: "LEVEL",
      budgetName: budget.name,
      code: level.code,
      description: level.name,
      levelType: level.type,
      depth: calculateLevelDepth(level.id, levelsById),
      sortOrder: level.sortOrder,
    })),
    ...budget.items.map((item): S10ImportDraftPreviewItemRow => {
      const level = item.levelId ? levelsById.get(item.levelId) : undefined;

      return {
        kind: "ITEM",
        ...createPreviewItem(budget, item, itemMetadataById),
        levelCode: level?.code ?? null,
        depth: level ? calculateLevelDepth(level.id, levelsById) + 1 : 1,
        sortOrder: item.sortOrder,
      };
    }),
  ];

  return rows.sort(comparePreviewRows);
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

function calculateLevelDepth(levelId: string, levelsById: Map<string, BudgetRecord["levels"][number]>) {
  let depth = 1;
  let current = levelsById.get(levelId);
  const visited = new Set<string>();

  while (current?.parentId && !visited.has(current.parentId)) {
    visited.add(current.id);
    const parent = levelsById.get(current.parentId);
    if (!parent) {
      break;
    }

    depth += 1;
    current = parent;
  }

  return depth;
}

function comparePreviewRows(left: S10ImportDraftPreviewRow, right: S10ImportDraftPreviewRow) {
  const codeComparison = left.code.localeCompare(right.code, "es", { numeric: true });
  if (codeComparison !== 0) {
    return codeComparison;
  }

  if (left.kind !== right.kind) {
    return left.kind === "LEVEL" ? -1 : 1;
  }

  return left.sortOrder - right.sortOrder;
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
