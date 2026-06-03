import { z } from "zod";

export const budgetSchema = z.object({
  projectId: z.string().min(1, "Selecciona un proyecto"),
  parentBudgetId: z.string().min(1).optional(),
  kind: z.enum(["GENERAL", "SUB_BUDGET"]).default("GENERAL"),
  name: z.string().min(3, "Ingresa el nombre del presupuesto"),
  currency: z.string().default("PEN"),
  igvRate: z.coerce.number().min(0).max(1),
  generalExpensesRate: z.coerce.number().min(0).max(1),
  utilityRate: z.coerce.number().min(0).max(1),
});

export type BudgetInput = z.infer<typeof budgetSchema>;

const apuResourceSchema = z.object({
  id: z.string().min(1),
  apuId: z.string().min(1),
  resourceId: z.string().min(1).nullable().optional(),
  catalogPartidaId: z.string().min(1).nullable().optional(),
  resourceType: z.string().min(1),
  crew: z.coerce.number().nullable().optional(),
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
  subtotal: z.coerce.number(),
  nestedApuRows: z
    .array(
      z.object({
        id: z.string(),
        catalogPartidaId: z.string(),
        resourceId: z.string().nullable().optional(),
        catalogSubpartidaId: z.string().nullable().optional(),
        description: z.string(),
        unit: z.string(),
        crew: z.coerce.number().nullable().optional(),
        quantity: z.coerce.number(),
        unitPrice: z.coerce.number(),
        subtotal: z.coerce.number(),
        resourceType: z.string().nullable().optional(),
        groupLabel: z.string().nullable().optional(),
        sortOrder: z.coerce.number().int().nonnegative(),
      }),
    )
    .optional(),
  resource: z
    .object({
      id: z.string().min(1),
      companyId: z.string().nullish(),
      code: z.string(),
      description: z.string(),
      category: z.enum(["MATERIAL", "LABOR", "EQUIPMENT", "TOOLS", "SUBCONTRACT"]),
      iu: z.string().nullish(),
      subcategory: z.string().nullish(),
      unit: z.string(),
      unitPrice: z.coerce.number(),
      currency: z.string(),
      source: z.string().nullish(),
    })
    .optional(),
});

const apuSchema = z.object({
  id: z.string().min(1),
  budgetItemId: z.string(),
  name: z.string(),
  unit: z.string(),
  performance: z.coerce.number(),
  totalUnitCost: z.coerce.number(),
  resources: z.array(apuResourceSchema),
});

const budgetLevelRecordSchema = z.object({
  id: z.string().min(1),
  budgetId: z.string().min(1),
  parentId: z.string().nullable().optional(),
  type: z.enum(["TITLE", "SUBTITLE", "ITEM_GROUP", "SUBITEM"]),
  code: z.string(),
  name: z.string(),
  sortOrder: z.number().int(),
});

const budgetItemRecordSchema = z.object({
  id: z.string().min(1),
  budgetId: z.string().min(1),
  levelId: z.string().nullable().optional(),
  code: z.string(),
  description: z.string(),
  unit: z.string(),
  quantity: z.coerce.number(),
  unitPrice: z.coerce.number(),
  partial: z.coerce.number(),
  sortOrder: z.number().int(),
  apu: apuSchema.nullable().optional(),
});

const budgetLevelUpdatePatchSchema = z.object({
  id: z.string().min(1),
  changes: budgetLevelRecordSchema.omit({ id: true }).partial(),
});

const budgetItemUpdatePatchSchema = z.object({
  id: z.string().min(1),
  changes: budgetItemRecordSchema.omit({ id: true }).partial(),
});

export const budgetStatePatchSchema = z.object({
  budget: z
    .object({
    name: z.string().min(1),
    currency: z.string().min(1),
    igvRate: z.coerce.number().min(0).max(1),
    generalExpensesRate: z.coerce.number().min(0).max(1),
    utilityRate: z.coerce.number().min(0).max(1),
    totalDirectCost: z.coerce.number(),
    totalGeneralExpenses: z.coerce.number(),
    totalUtility: z.coerce.number(),
    totalTax: z.coerce.number(),
    totalAmount: z.coerce.number(),
    })
    .partial(),
  levels: z.object({
    create: z.array(budgetLevelRecordSchema),
    update: z.array(budgetLevelUpdatePatchSchema),
    delete: z.array(z.string().min(1)),
  }),
  items: z.object({
    create: z.array(budgetItemRecordSchema),
    update: z.array(budgetItemUpdatePatchSchema),
    delete: z.array(z.string().min(1)),
  }),
});

export type BudgetStatePatchInput = z.infer<typeof budgetStatePatchSchema>;
