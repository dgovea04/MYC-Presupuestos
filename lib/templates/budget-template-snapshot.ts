import { calculateBudgetRecord } from "@/lib/calculations/budget";
import type { ApuResourceRecord } from "@/types/apu";
import type { ResourceRecord } from "@/types/resource";
import type { BudgetItemRecord, BudgetKind, BudgetLevelRecord, BudgetLevelType, BudgetRecord } from "@/types/budget";

export type BudgetTemplateSnapshot = {
  schemaVersion: 1;
  name: string;
  description: string;
  source: BudgetTemplateSource;
  budget: BudgetTemplateBudgetSettings;
  levels: BudgetTemplateLevel[];
  items: BudgetTemplateItem[];
  summary: BudgetTemplateSummary;
};

export type BudgetTemplateSource = {
  budgetId: string;
  projectId: string;
  budgetName: string;
  capturedAt: string;
};

export type BudgetTemplateBudgetSettings = {
  kind: BudgetKind;
  currency: string;
  igvRate: number;
  generalExpensesRate: number;
  utilityRate: number;
  totalDirectCost: number;
  totalGeneralExpenses: number;
  totalUtility: number;
  totalTax: number;
  totalAmount: number;
};

export type BudgetTemplateLevel = {
  templateKey: string;
  sourceLevelId: string;
  parentKey: string | null;
  type: BudgetLevelType;
  code: string;
  name: string;
  sortOrder: number;
};

export type BudgetTemplateItem = {
  templateKey: string;
  sourceItemId: string;
  levelKey: string | null;
  code: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  sortOrder: number;
  apu: BudgetTemplateApu | null;
};

export type BudgetTemplateApu = {
  name: string;
  unit: string;
  performance: number;
  totalUnitCost: number;
  resources: BudgetTemplateApuResource[];
};

export type BudgetTemplateApuResource = {
  resourceType: string;
  crew: number | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  resource: BudgetTemplateResource | null;
};

export type BudgetTemplateResource = Pick<
  ResourceRecord,
  "code" | "description" | "category" | "iu" | "subcategory" | "unit" | "unitPrice" | "currency" | "source"
>;

export type BudgetTemplateSummary = {
  levelCount: number;
  itemCount: number;
  apuCount: number;
  currency: string;
  totalDirectCost: number;
  totalAmount: number;
};

export type BuildBudgetTemplateSnapshotOptions = {
  name?: string;
  description?: string;
  capturedAt?: Date | string;
};

export type BuildBudgetFromTemplateSnapshotOptions = {
  budgetId: string;
  projectId: string;
  parentBudgetId?: string | null;
  name?: string;
  nextId?: BudgetTemplateIdFactory;
};

export type BudgetTemplateIdScope = "level" | "item" | "apu" | "apuResource";
export type BudgetTemplateIdFactory = (scope: BudgetTemplateIdScope, index: number, templateKey: string) => string;

export function buildBudgetTemplateSnapshot(
  budget: BudgetRecord,
  options: BuildBudgetTemplateSnapshotOptions = {},
): BudgetTemplateSnapshot {
  const normalizedBudget = calculateBudgetRecord(budget);
  const sortedLevels = sortLevels(normalizedBudget.levels);
  const levelKeys = new Map(sortedLevels.map((level, index) => [level.id, buildTemplateKey("level", index)]));
  const levels = sortedLevels.map((level, index) => toTemplateLevel(level, index, levelKeys));
  const items = sortItems(normalizedBudget.items).map((item, index) => toTemplateItem(item, index, levelKeys));
  const apuCount = items.filter((item) => item.apu).length;

  return {
    schemaVersion: 1,
    name: options.name?.trim() || `Plantilla de ${normalizedBudget.name}`,
    description: options.description?.trim() ?? "",
    source: {
      budgetId: normalizedBudget.id,
      projectId: normalizedBudget.projectId,
      budgetName: normalizedBudget.name,
      capturedAt: toIsoDate(options.capturedAt ?? new Date()),
    },
    budget: {
      kind: normalizedBudget.kind,
      currency: normalizedBudget.currency,
      igvRate: normalizedBudget.igvRate,
      generalExpensesRate: normalizedBudget.generalExpensesRate,
      utilityRate: normalizedBudget.utilityRate,
      totalDirectCost: normalizedBudget.totalDirectCost,
      totalGeneralExpenses: normalizedBudget.totalGeneralExpenses,
      totalUtility: normalizedBudget.totalUtility,
      totalTax: normalizedBudget.totalTax,
      totalAmount: normalizedBudget.totalAmount,
    },
    levels,
    items,
    summary: {
      levelCount: levels.length,
      itemCount: items.length,
      apuCount,
      currency: normalizedBudget.currency,
      totalDirectCost: normalizedBudget.totalDirectCost,
      totalAmount: normalizedBudget.totalAmount,
    },
  };
}

export function buildBudgetFromTemplateSnapshot(
  snapshot: BudgetTemplateSnapshot,
  options: BuildBudgetFromTemplateSnapshotOptions,
): BudgetRecord {
  const nextId = options.nextId ?? defaultNextId;
  const levelIds = new Map<string, string>();

  const levels = snapshot.levels.map((level, index) => {
    const id = nextId("level", index, level.templateKey);
    levelIds.set(level.templateKey, id);

    return {
      id,
      budgetId: options.budgetId,
      parentId: level.parentKey ? levelIds.get(level.parentKey) ?? null : null,
      type: level.type,
      code: level.code,
      name: level.name,
      sortOrder: level.sortOrder,
    };
  });

  const items = snapshot.items.map((item, index) => {
    const id = nextId("item", index, item.templateKey);

    return {
      id,
      budgetId: options.budgetId,
      levelId: item.levelKey ? levelIds.get(item.levelKey) ?? null : null,
      code: item.code,
      description: item.description,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      partial: item.partial,
      sortOrder: item.sortOrder,
      apu: item.apu ? toBudgetApu(item.apu, id, index, item.templateKey, nextId) : null,
    };
  });

  return calculateBudgetRecord({
    id: options.budgetId,
    projectId: options.projectId,
    parentBudgetId: options.parentBudgetId ?? null,
    kind: snapshot.budget.kind,
    name: options.name?.trim() || snapshot.name,
    currency: snapshot.budget.currency,
    igvRate: snapshot.budget.igvRate,
    generalExpensesRate: snapshot.budget.generalExpensesRate,
    utilityRate: snapshot.budget.utilityRate,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels,
    items,
  });
}

function toTemplateLevel(
  level: BudgetLevelRecord,
  index: number,
  levelKeys: Map<string, string>,
): BudgetTemplateLevel {
  return {
    templateKey: buildTemplateKey("level", index),
    sourceLevelId: level.id,
    parentKey: level.parentId ? levelKeys.get(level.parentId) ?? null : null,
    type: level.type,
    code: level.code,
    name: level.name,
    sortOrder: level.sortOrder,
  };
}

function toTemplateItem(
  item: BudgetItemRecord,
  index: number,
  levelKeys: Map<string, string>,
): BudgetTemplateItem {
  return {
    templateKey: buildTemplateKey("item", index),
    sourceItemId: item.id,
    levelKey: item.levelId ? levelKeys.get(item.levelId) ?? null : null,
    code: item.code,
    description: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    partial: item.partial,
    sortOrder: item.sortOrder,
    apu: item.apu
      ? {
          name: item.apu.name,
          unit: item.apu.unit,
          performance: item.apu.performance,
          totalUnitCost: item.apu.totalUnitCost,
          resources: sortApuResources(item.apu.resources).map(toTemplateApuResource),
        }
      : null,
  };
}

function toTemplateApuResource(resource: ApuResourceRecord): BudgetTemplateApuResource {
  return {
    resourceType: resource.resourceType,
    crew: resource.crew ?? null,
    quantity: resource.quantity,
    unitPrice: resource.unitPrice,
    subtotal: resource.subtotal,
    resource: resource.resource ? toTemplateResource(resource.resource) : null,
  };
}

function toTemplateResource(resource: ResourceRecord): BudgetTemplateResource {
  return {
    code: resource.code,
    description: resource.description,
    category: resource.category,
    iu: resource.iu ?? null,
    subcategory: resource.subcategory ?? null,
    unit: resource.unit,
    unitPrice: resource.unitPrice,
    currency: resource.currency,
    source: resource.source ?? null,
  };
}

function toBudgetApu(
  apu: BudgetTemplateApu,
  budgetItemId: string,
  itemIndex: number,
  itemTemplateKey: string,
  nextId: BudgetTemplateIdFactory,
) {
  const apuId = nextId("apu", itemIndex, itemTemplateKey);

  return {
    id: apuId,
    budgetItemId,
    name: apu.name,
    unit: apu.unit,
    performance: apu.performance,
    totalUnitCost: apu.totalUnitCost,
    resources: apu.resources.map((resource, index) => ({
      id: nextId("apuResource", index, `${itemTemplateKey}:resource-${index + 1}`),
      apuId,
      resourceId: "",
      resourceType: resource.resourceType,
      crew: resource.crew,
      quantity: resource.quantity,
      unitPrice: resource.unitPrice,
      subtotal: resource.subtotal,
      resource: resource.resource
        ? {
            id: "",
            ...resource.resource,
          }
        : undefined,
    })),
  };
}

function sortLevels(levels: BudgetLevelRecord[]) {
  return [...levels].sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code));
}

function sortItems(items: BudgetItemRecord[]) {
  return [...items].sort((left, right) => left.sortOrder - right.sortOrder || left.code.localeCompare(right.code));
}

function sortApuResources(resources: ApuResourceRecord[]) {
  return [...resources].sort((left, right) => left.resourceType.localeCompare(right.resourceType) || left.id.localeCompare(right.id));
}

function buildTemplateKey(scope: "level" | "item", index: number) {
  return `${scope}-${String(index + 1).padStart(3, "0")}`;
}

function toIsoDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function defaultNextId(scope: BudgetTemplateIdScope, index: number, templateKey: string) {
  return `${scope}-${templateKey}-${index + 1}`;
}
