import { Prisma } from "@prisma/client";
import Decimal from "decimal.js";

import { calculateMetradoSheet } from "@/lib/calculations/metrados";
import { prisma } from "@/lib/db/prisma";
import {
  hasBlockingMetradoIssues,
  validateMetradoSheet,
} from "@/lib/metrados/validation";
import { metradoTemplates } from "@/lib/metrados/templates";
import type {
  CustomMetradoFormulaRecord,
  MetradoFormulaInputKey,
  MetradoFormulaInputs,
  MetradoFormulaKey,
  MetradoFormulaRecord,
  MetradoRowRecord,
  MetradoSheetRecord,
  MetradoSheetStatus,
  MetradoTemplateType,
  MetradoUnit,
} from "@/types/metrado";

const formulaInputKeys = [
  "largo",
  "ancho",
  "alto",
  "cantidad",
  "longitud",
  "pesoUnitario",
  "perimetro",
  "altura",
  "area",
  "factor",
  "manual",
] as const satisfies MetradoFormulaInputKey[];

const metradoUnits = ["m", "m2", "m3", "kg", "und", "glb"] as const satisfies MetradoUnit[];

const metradoSheetInclude = Prisma.validator<Prisma.MetradoSheetInclude>()({
  project: true,
  budget: true,
  template: true,
  rows: {
    orderBy: {
      sortOrder: "asc",
    },
  },
  partidaLinks: {
    include: {
      budgetItem: true,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: 1,
  },
});

type MetradoSheetWithRelations = Prisma.MetradoSheetGetPayload<{
  include: typeof metradoSheetInclude;
}>;

type MetradoPartidaLinkCreateInput = {
  sheetId: string;
  budgetId: string;
  budgetItemId: string;
};

type MetradoRowCreateData = {
  sheetId: string;
  sector: string;
  eje: string;
  nivel: string;
  description: string;
  unit: MetradoUnit;
  formulaKey: MetradoFormulaKey;
  inputs: MetradoFormulaInputs;
  partial: number;
  sortOrder: number;
};

type MetradoCreationOptions = {
  projects: Array<{ id: string; name: string }>;
  budgets: Array<{ id: string; projectId: string; name: string }>;
  partidas: Array<{
    id: string;
    projectId: string;
    budgetId: string;
    code: string;
    description: string;
    unit: string;
  }>;
};

type CustomMetradoFormulaCreateInput = {
  userId: string;
  name: string;
  description?: string;
  category: string;
  expression: string;
  requiredInputs: MetradoFormulaInputKey[];
  resultUnit: MetradoUnit;
  showInSuggestions?: boolean;
};

type CustomMetradoFormulaUpdateInput = CustomMetradoFormulaCreateInput & {
  id: string;
};

type DuplicateMetradoSheetInput = {
  sourceSheetId: string;
  userId: string;
  name?: string;
};

export function parseMetradoInputs(value: Prisma.JsonValue): MetradoFormulaInputs {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const jsonObject = value as Record<string, unknown>;

  return Object.entries(jsonObject).reduce<MetradoFormulaInputs>((inputs, [key, rawValue]) => {
    if (!isFormulaInputKey(key) && !isCustomFormulaInputKey(key)) {
      return inputs;
    }

    const parsed = parseFiniteDecimal(rawValue);
    if (parsed !== null) {
      inputs[key] = parsed;
    }

    return inputs;
  }, {});
}

function parseFiniteDecimal(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new Decimal(trimmed);
    if (parsed.isFinite()) {
      return parsed.toNumber();
    }
  } catch {
    return null;
  }

  return null;
}

export function buildMetradoRowCreateData(
  row: MetradoRowRecord,
  sheetId: string,
): MetradoRowCreateData {
  return {
    sheetId,
    sector: row.sector,
    eje: row.eje,
    nivel: row.nivel,
    description: row.description,
    unit: row.unit,
    formulaKey: row.formulaKey,
    inputs: row.inputs,
    partial: row.partial,
    sortOrder: row.sortOrder,
  };
}

export function assertMetradoRowsArePersistable(input: {
  sheetUnit: MetradoUnit;
  templateFormulaKeys: MetradoFormulaKey[];
  formulas?: MetradoFormulaRecord[];
  linkedPartidaUnit?: string | null;
  rows: MetradoRowRecord[];
}): void {
  const issues = validateMetradoSheet(input);

  if (hasBlockingMetradoIssues(issues)) {
    throw new Error("No se pueden guardar filas de metrado con errores de validacion.");
  }
}

export async function listCustomMetradoFormulas(userId: string): Promise<CustomMetradoFormulaRecord[]> {
  const formulas = await prisma.customMetradoFormula.findMany({
    where: { userId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return formulas.map(mapCustomMetradoFormulaRecord);
}

export async function createCustomMetradoFormula(
  input: CustomMetradoFormulaCreateInput,
): Promise<CustomMetradoFormulaRecord> {
  const formula = await prisma.customMetradoFormula.create({
    data: {
      userId: input.userId,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      category: input.category.trim() || "Personalizado",
      expression: input.expression.trim(),
      requiredInputs: input.requiredInputs,
      resultUnit: input.resultUnit,
      showInSuggestions: input.showInSuggestions ?? false,
    },
  });

  return mapCustomMetradoFormulaRecord(formula);
}

export async function updateCustomMetradoFormula(
  input: CustomMetradoFormulaUpdateInput,
): Promise<CustomMetradoFormulaRecord> {
  const result = await prisma.customMetradoFormula.updateMany({
    where: {
      id: input.id,
      userId: input.userId,
    },
    data: {
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      category: input.category.trim() || "Personalizado",
      expression: input.expression.trim(),
      requiredInputs: input.requiredInputs,
      resultUnit: input.resultUnit,
      showInSuggestions: input.showInSuggestions ?? false,
    },
  });

  if (result.count === 0) {
    throw new Error("La formula personalizada no existe.");
  }

  const formula = await prisma.customMetradoFormula.findFirst({
    where: {
      id: input.id,
      userId: input.userId,
    },
  });

  if (!formula) {
    throw new Error("No se pudo cargar la formula actualizada.");
  }

  return mapCustomMetradoFormulaRecord(formula);
}

export function buildBudgetItemQuantityPatch(primaryTotal: number): { quantity: number } {
  return {
    quantity: new Decimal(primaryTotal).toDecimalPlaces(3, Decimal.ROUND_HALF_UP).toNumber(),
  };
}

export function buildMetradoPartidaLinkCreateInput(
  input: MetradoPartidaLinkCreateInput,
): MetradoPartidaLinkCreateInput {
  return {
    sheetId: input.sheetId,
    budgetId: input.budgetId,
    budgetItemId: input.budgetItemId,
  };
}

export async function ensureMetradoTemplates(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const template of metradoTemplates) {
      const savedTemplate = await tx.metradoTemplate.upsert({
        where: { type: template.type },
        create: {
          type: template.type,
          name: template.name,
          description: template.description,
          defaultUnit: template.defaultUnit,
        },
        update: {
          name: template.name,
          description: template.description,
          defaultUnit: template.defaultUnit,
        },
      });

      for (const [index, formula] of template.formulas.entries()) {
        await tx.metradoFormula.upsert({
          where: {
            templateId_key: {
              templateId: savedTemplate.id,
              key: formula.key,
            },
          },
          create: {
            templateId: savedTemplate.id,
            key: formula.key,
            label: formula.label,
            expression: formula.expression,
            requiredInputs: [...formula.requiredInputs],
            resultUnit: formula.resultUnit,
            sortOrder: index + 1,
          },
          update: {
            label: formula.label,
            expression: formula.expression,
            requiredInputs: [...formula.requiredInputs],
            resultUnit: formula.resultUnit,
            sortOrder: index + 1,
          },
        });
      }
    }
  });
}

export async function listMetradoSheetsByUser(userId: string): Promise<MetradoSheetRecord[]> {
  await ensureMetradoTemplates();
  const sheets = await prisma.metradoSheet.findMany({
    where: { userId },
    include: metradoSheetInclude,
    orderBy: { updatedAt: "desc" },
  });

  return sheets.map(mapMetradoSheetRecord);
}

export async function listMetradoCreationOptions(userId: string): Promise<MetradoCreationOptions> {
  const projects = await prisma.project.findMany({
    where: {
      company: {
        userId,
      },
    },
    include: {
      budgets: {
        include: {
          items: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              budgetId: true,
              code: true,
              description: true,
              unit: true,
            },
          },
        },
        orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return {
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
    })),
    budgets: projects.flatMap((project) =>
      project.budgets.map((budget) => ({
        id: budget.id,
        projectId: project.id,
        name: budget.name,
      })),
    ),
    partidas: projects.flatMap((project) =>
      project.budgets.flatMap((budget) =>
        budget.items.map((item) => ({
          id: item.id,
          projectId: project.id,
          budgetId: item.budgetId,
          code: item.code,
          description: item.description,
          unit: item.unit,
        })),
      ),
    ),
  };
}

export async function createMetradoSheet(input: {
  userId: string;
  projectId: string;
  budgetId: string;
  budgetItemId: string;
  templateType: MetradoTemplateType;
  unit?: MetradoUnit;
  name: string;
}): Promise<MetradoSheetRecord> {
  await ensureMetradoTemplates();

  const [template, budgetItem] = await Promise.all([
    prisma.metradoTemplate.findUnique({
      where: { type: input.templateType },
      select: { id: true, defaultUnit: true },
    }),
    prisma.budgetItem.findFirst({
      where: {
        id: input.budgetItemId,
        budgetId: input.budgetId,
        budget: {
          id: input.budgetId,
          projectId: input.projectId,
          project: {
            company: {
              userId: input.userId,
            },
          },
        },
      },
      select: { id: true },
    }),
  ]);

  if (!template) {
    throw new Error("La plantilla de metrado seleccionada no existe.");
  }

  if (!budgetItem) {
    throw new Error("La partida seleccionada no pertenece al presupuesto elegido.");
  }

  const sheetId = await prisma.$transaction(async (tx) => {
    const sheet = await tx.metradoSheet.create({
      data: {
        userId: input.userId,
        projectId: input.projectId,
        budgetId: input.budgetId,
        templateId: template.id,
        name: input.name.trim() || "Nuevo metrado",
        unit: buildMetradoSheetUnit(toMetradoUnit(template.defaultUnit), input.unit),
      },
      select: { id: true },
    });

    await tx.metradoPartidaLink.create({
      data: buildMetradoPartidaLinkCreateInput({
        sheetId: sheet.id,
        budgetId: input.budgetId,
        budgetItemId: input.budgetItemId,
      }),
    });

    return sheet.id;
  });

  const created = await getMetradoSheetById(sheetId, input.userId);
  if (!created) {
    throw new Error("No se pudo cargar el metrado creado.");
  }

  return created;
}

export function buildMetradoSheetUnit(templateDefaultUnit: MetradoUnit, requestedUnit?: MetradoUnit): MetradoUnit {
  return requestedUnit ?? templateDefaultUnit;
}

export function buildMetradoSheetDuplicateName(sourceName: string, requestedName?: string): string {
  const trimmedName = requestedName?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  return `${sourceName.trim() || "Metrado"} copia`;
}

export function buildMetradoRowsForDuplicate(
  sourceRows: readonly MetradoRowRecord[],
  sheetId: string,
): MetradoRowRecord[] {
  return sourceRows.map((row, index) => ({
    ...row,
    id: `duplicate-row-${index + 1}`,
    sheetId,
    inputs: { ...row.inputs },
    sortOrder: index + 1,
  }));
}

export async function duplicateMetradoSheet(input: DuplicateMetradoSheetInput): Promise<MetradoSheetRecord> {
  const source = await getMetradoSheetById(input.sourceSheetId, input.userId);

  if (!source) {
    throw new Error("Metrado no encontrado.");
  }

  if (!source.partidaLink) {
    throw new Error("El metrado de origen no tiene partida vinculada.");
  }

  const created = await createMetradoSheet({
    userId: input.userId,
    projectId: source.projectId,
    budgetId: source.budgetId,
    budgetItemId: source.partidaLink.budgetItemId,
    templateType: source.templateType,
    unit: source.unit,
    name: buildMetradoSheetDuplicateName(source.name, input.name),
  });

  if (source.rows.length === 0) {
    return created;
  }

  const duplicatedRows = buildMetradoRowsForDuplicate(source.rows, created.id);
  const copied = await replaceMetradoRows(created.id, input.userId, duplicatedRows);

  if (!copied) {
    throw new Error("No se pudo cargar el metrado duplicado.");
  }

  return copied;
}

export async function getMetradoSheetById(
  sheetId: string,
  userId: string,
): Promise<MetradoSheetRecord | null> {
  await ensureMetradoTemplates();
  const sheet = await prisma.metradoSheet.findFirst({
    where: { id: sheetId, userId },
    include: metradoSheetInclude,
  });

  return sheet ? mapMetradoSheetRecord(sheet) : null;
}

export async function updateMetradoSheetMetadata(
  sheetId: string,
  userId: string,
  input: { name?: string; unit?: MetradoUnit },
): Promise<MetradoSheetRecord | null> {
  const existing = await prisma.metradoSheet.findFirst({
    where: { id: sheetId, userId },
    select: { id: true },
  });

  if (!existing) {
    return null;
  }

  await prisma.metradoSheet.update({
    where: { id: existing.id },
    data: {
      name: input.name?.trim() || undefined,
      unit: input.unit,
    },
  });

  return getMetradoSheetById(sheetId, userId);
}

export async function deleteMetradoSheet(sheetId: string, userId: string): Promise<boolean> {
  const existing = await prisma.metradoSheet.findFirst({
    where: { id: sheetId, userId },
    select: { id: true },
  });

  if (!existing) {
    return false;
  }

  await prisma.metradoSheet.delete({
    where: { id: existing.id },
  });

  return true;
}

export async function replaceMetradoRows(
  sheetId: string,
  userId: string,
  rows: MetradoRowRecord[],
): Promise<MetradoSheetRecord | null> {
  const existing = await prisma.metradoSheet.findFirst({
    where: { id: sheetId, userId },
    select: {
      id: true,
      unit: true,
      template: {
        select: {
          type: true,
          formulas: {
            select: {
              key: true,
              id: true,
              templateId: true,
              label: true,
              expression: true,
              requiredInputs: true,
              resultUnit: true,
            },
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
      partidaLinks: {
        include: {
          budgetItem: {
            select: {
              unit: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 1,
      },
    },
  });

  if (!existing) {
    return null;
  }

  const sheetUnit = toMetradoUnit(existing.unit);
  const formulaRecords = await getAvailableFormulaRecords({
    userId,
    templateType: toMetradoTemplateType(existing.template.type),
    templateFormulas: existing.template.formulas,
  });
  const normalizedRows = rows.map((row, index) => ({
    ...row,
    sheetId,
    sortOrder: row.sortOrder ?? index + 1,
  }));

  if (normalizedRows.length > 0) {
    assertMetradoRowsArePersistable({
      sheetUnit,
      templateFormulaKeys: formulaRecords.map((formula) => formula.key),
      formulas: formulaRecords,
      linkedPartidaUnit: existing.partidaLinks[0]?.budgetItem.unit ?? null,
      rows: normalizedRows,
    });
  }

  const calculated = calculateMetradoSheet({
    unit: sheetUnit,
    rows: normalizedRows,
    formulas: formulaRecords,
  });

  await prisma.$transaction(async (tx) => {
    await tx.metradoRow.deleteMany({
      where: { sheetId },
    });

    for (const row of calculated.rows) {
      await tx.metradoRow.create({
        data: buildMetradoRowCreateData(row, sheetId),
      });
    }

    await tx.metradoSheet.update({
      where: { id: sheetId },
      data: {
        totalQuantity: calculated.primaryTotal,
        status: "DRAFT",
      },
    });
  });

  return getMetradoSheetById(sheetId, userId);
}

export async function sendMetradoTotalToPartida(
  sheetId: string,
  userId: string,
): Promise<{ quantity: number }> {
  const sheet = await prisma.metradoSheet.findFirstOrThrow({
    where: { id: sheetId, userId },
    include: {
      rows: { orderBy: { sortOrder: "asc" } },
      template: {
        include: {
          formulas: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      },
      partidaLinks: {
        include: { budgetItem: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  const link = sheet.partidaLinks[0];
  if (!link) {
    throw new Error("La hoja no tiene una partida vinculada.");
  }

  if (link.budgetId !== sheet.budgetId || link.budgetItem.budgetId !== sheet.budgetId) {
    throw new Error("La partida vinculada no pertenece al presupuesto de la hoja.");
  }

  const formulaRecords = await getAvailableFormulaRecords({
    userId,
    templateType: toMetradoTemplateType(sheet.template.type),
    templateFormulas: sheet.template.formulas,
  });
  const calculation = calculateMetradoSheet({
    unit: toMetradoUnit(sheet.unit),
    rows: sheet.rows.map(mapMetradoRowRecord),
    formulas: formulaRecords,
  });
  const patch = buildBudgetItemQuantityPatch(calculation.primaryTotal);

  await prisma.$transaction([
    prisma.budgetItem.update({
      where: {
        id_budgetId: {
          id: link.budgetItemId,
          budgetId: link.budgetId,
        },
      },
      data: patch,
    }),
    prisma.metradoPartidaLink.update({
      where: { id: link.id },
      data: {
        lastSentQuantity: patch.quantity,
        sentAt: new Date(),
      },
    }),
    prisma.metradoSheet.update({
      where: { id: sheet.id },
      data: {
        status: "SENT_TO_BUDGET",
        totalQuantity: patch.quantity,
      },
    }),
  ]);

  return patch;
}

async function getAvailableFormulaRecords({
  userId,
  templateType,
  templateFormulas,
}: {
  userId: string;
  templateType: MetradoTemplateType;
  templateFormulas: Array<{
    id: string;
    templateId: string;
    key: string;
    label: string;
    expression: string;
    requiredInputs: string[];
    resultUnit: string;
  }>;
}): Promise<MetradoFormulaRecord[]> {
  const formulas = templateFormulas.map(mapTemplateFormulaRecord);

  if (templateType !== "CUSTOM") {
    return formulas;
  }

  const customFormulas = await listCustomMetradoFormulas(userId);
  return [...formulas, ...customFormulas];
}

function mapTemplateFormulaRecord(formula: {
  id: string;
  templateId: string;
  key: string;
  label: string;
  expression: string;
  requiredInputs: string[];
  resultUnit: string;
}): MetradoFormulaRecord {
  return {
    id: formula.id,
    templateId: formula.templateId,
    key: formula.key,
    label: formula.label,
    expression: formula.expression,
    requiredInputs: formula.requiredInputs.filter(isFormulaInputKey),
    resultUnit: toMetradoUnit(formula.resultUnit),
    source: "system",
  };
}

function mapCustomMetradoFormulaRecord(formula: {
  id: string;
  userId: string;
  name: string;
  description: string;
  category: string;
  expression: string;
  requiredInputs: string[];
  resultUnit: string;
  showInSuggestions?: boolean;
  createdAt: Date;
  updatedAt: Date;
}): CustomMetradoFormulaRecord {
  return {
    id: formula.id,
    userId: formula.userId,
    templateId: "custom-user",
    key: formula.id,
    label: formula.name,
    name: formula.name,
    description: formula.description,
    category: formula.category,
    showInSuggestions: formula.showInSuggestions ?? false,
    expression: formula.expression,
    requiredInputs: formula.requiredInputs.filter(isCustomFormulaInputKey),
    resultUnit: toMetradoUnit(formula.resultUnit),
    source: "user",
    createdAt: formula.createdAt,
    updatedAt: formula.updatedAt,
  };
}

function mapMetradoSheetRecord(sheet: MetradoSheetWithRelations): MetradoSheetRecord {
  const link = sheet.partidaLinks[0];

  return {
    id: sheet.id,
    userId: sheet.userId,
    projectId: sheet.projectId,
    projectName: sheet.project.name,
    budgetId: sheet.budgetId,
    budgetName: sheet.budget.name,
    templateId: sheet.templateId,
    templateType: toMetradoTemplateType(sheet.template.type),
    name: sheet.name,
    status: toMetradoSheetStatus(sheet.status),
    unit: toMetradoUnit(sheet.unit),
    totalQuantity: Number(sheet.totalQuantity),
    rows: sheet.rows.map(mapMetradoRowRecord),
    partidaLink: link
      ? {
          id: link.id,
          sheetId: link.sheetId,
          budgetItemId: link.budgetItemId,
          budgetItemCode: link.budgetItem.code,
          budgetItemDescription: link.budgetItem.description,
          budgetItemUnit: link.budgetItem.unit,
          lastSentQuantity: link.lastSentQuantity === null ? null : Number(link.lastSentQuantity),
        }
      : null,
    createdAt: sheet.createdAt,
    updatedAt: sheet.updatedAt,
  };
}

function mapMetradoRowRecord(row: {
  id: string;
  sheetId: string;
  sector: string;
  eje: string;
  nivel: string;
  description: string;
  unit: string;
  formulaKey: string;
  inputs: Prisma.JsonValue;
  partial: Prisma.Decimal;
  sortOrder: number;
}): MetradoRowRecord {
  return {
    id: row.id,
    sheetId: row.sheetId,
    sector: row.sector,
    eje: row.eje,
    nivel: row.nivel,
    description: row.description,
    unit: toMetradoUnit(row.unit),
    formulaKey: toMetradoFormulaKey(row.formulaKey),
    inputs: parseMetradoInputs(row.inputs),
    partial: Number(row.partial),
    sortOrder: row.sortOrder,
  };
}

function isFormulaInputKey(value: string): value is MetradoFormulaInputKey {
  return formulaInputKeys.some((key) => key === value);
}

function isCustomFormulaInputKey(value: string): value is MetradoFormulaInputKey {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function toMetradoFormulaKey(value: string): MetradoFormulaKey {
  return value.trim() || "manual";
}

function toMetradoUnit(value: string): MetradoUnit {
  return metradoUnits.find((unit) => unit === value) ?? "und";
}

function toMetradoTemplateType(value: string): MetradoTemplateType {
  return metradoTemplates.find((template) => template.type === value)?.type ?? "CUSTOM";
}

function toMetradoSheetStatus(value: string): MetradoSheetStatus {
  if (value === "VALIDATED" || value === "SENT_TO_BUDGET") {
    return value;
  }

  return "DRAFT";
}
