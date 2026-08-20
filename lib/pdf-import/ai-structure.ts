import { z } from "zod";

import type { AiProviderId, AiProviderResult } from "@/lib/ai/gateway/types";
import { extractJsonObjectFromText } from "@/lib/ai/structured-output";
import { buildPdfImportStructurePrompt } from "./prompts";
import { linkPdfImportDraft } from "./linker";
import { calculatePdfImportDraftTotals } from "./calculations";
import type { PdfAiImportDraft, PdfImportDocumentRole, PdfImportedApuRow } from "./types";

export type PdfImportAiExecutor = (input: {
  provider: AiProviderId;
  task: "pdf_import_structure";
  payload: Record<string, unknown>;
  userId: string;
}) => Promise<AiProviderResult>;

export type PdfImportAiStructureInput = {
  executeAi?: PdfImportAiExecutor;
  userId: string;
  companyId: string;
  provider?: AiProviderId;
  projectName?: string;
  currency?: string;
  priceTolerance?: string;
  files: Array<{
    id: string;
    fileName: string;
    role: PdfImportDocumentRole;
    text: string;
    pageCount: number;
    requiresOcr: boolean;
    confidence: number;
  }>;
};

export type PdfImportAiStructureResult = {
  draft: PdfAiImportDraft;
  metadata: {
    provider: string;
    model: string;
    structuredParseStatus: "parsed" | "repaired";
  };
};

const aiDecimalSchema = z.union([z.string(), z.number()]).nullable().transform((value) => {
  if (value == null || value === "") {
    return "0";
  }
  return typeof value === "number" ? String(value) : value.replace(/[^\d.-]/g, "") || "0";
});

const aiEvidenceFieldsSchema = z.object({
  sourcePage: z.number().int().min(1).catch(1),
  confidence: z.number().min(0).max(1).catch(0.5),
});

const aiBudgetItemSchema = aiEvidenceFieldsSchema.extend({
  code: z.string().nullable().catch(null),
  description: z.string().nullable().catch(null),
  unit: z.string().nullable().catch(null),
  quantity: aiDecimalSchema,
  unitPrice: aiDecimalSchema,
  partial: aiDecimalSchema,
});

const aiApuRowSchema = aiEvidenceFieldsSchema.extend({
  description: z.string().nullable().catch(null),
  unit: z.string().nullable().catch(null),
  resourceType: z.string().nullable().catch("OTHER"),
  quantity: aiDecimalSchema,
  unitPrice: aiDecimalSchema,
  subtotal: aiDecimalSchema,
});

const aiApuSchema = aiEvidenceFieldsSchema.extend({
  budgetItemCode: z.string().nullable().optional(),
  name: z.string().nullable().catch(null),
  unit: z.string().nullable().catch(null),
  performance: aiDecimalSchema,
  totalUnitCost: aiDecimalSchema,
  rows: z.array(aiApuRowSchema).catch([]),
});

const aiSubpartidaSchema = aiEvidenceFieldsSchema.extend({
  code: z.string().nullable().optional(),
  description: z.string().nullable().catch(null),
  unit: z.string().nullable().catch(null),
  unitPrice: aiDecimalSchema,
  performance: aiDecimalSchema,
  rows: z.array(aiApuRowSchema).catch([]),
});

const aiBudgetSchema = z.object({
  name: z.string().nullable().catch(null),
  items: z.array(aiBudgetItemSchema).catch([]),
});

const aiPdfImportStructureSchema = z.object({
  project: z.object({
    name: z.string().nullable().catch(null),
    currency: z.string().nullable().catch(null),
  }).catch({ name: null, currency: null }),
  budgets: z.array(aiBudgetSchema).catch([]),
  apus: z.array(aiApuSchema).catch([]),
  subpartidas: z.array(aiSubpartidaSchema).catch([]),
  resources: z.array(z.unknown()).catch([]),
  warnings: z.array(z.string()).catch([]),
});

export async function structurePdfImportWithAi(input: PdfImportAiStructureInput): Promise<PdfImportAiStructureResult> {
  const executeAi = input.executeAi ?? (await loadDefaultAiExecutor());
  const prompt = buildPdfImportStructurePrompt({ files: input.files });
  const startedAt = Date.now();
  const result = await executeAi({
    provider: input.provider ?? "auto",
    task: "pdf_import_structure",
    payload: {
      companyId: input.companyId,
      prompt,
      files: input.files.map((file) => ({ fileName: file.fileName, role: file.role, pageCount: file.pageCount, requiresOcr: file.requiresOcr })),
    },
    userId: input.userId,
  });

  const parsed = parseAiStructureAnswer(result.answer);
  const draft = buildDraftFromAiStructure({
    parsed: parsed.data,
    files: input.files,
    projectName: input.projectName,
    currency: input.currency,
    priceTolerance: input.priceTolerance,
    warnings: result.warnings,
    latencyMs: Date.now() - startedAt,
    provider: result.provider,
  });

  return {
    draft,
    metadata: {
      provider: result.provider,
      model: result.model,
      structuredParseStatus: parsed.status,
    },
  };
}

async function loadDefaultAiExecutor(): Promise<PdfImportAiExecutor> {
  const executeModule = await import("@/lib/ai/gateway/execute");
  return executeModule.executeAiTask as PdfImportAiExecutor;
}

function parseAiStructureAnswer(answer: string) {
  let rawJson = answer;
  let status: "parsed" | "repaired" = "parsed";

  try {
    JSON.parse(rawJson);
  } catch {
    try {
      rawJson = extractJsonObjectFromText(answer);
      status = "repaired";
    } catch {
      throw new Error("No se pudo estructurar la respuesta IA del paquete PDF.");
    }
  }

  const jsonValue: unknown = JSON.parse(rawJson);
  return {
    status,
    data: aiPdfImportStructureSchema.parse(jsonValue),
  };
}

function buildDraftFromAiStructure(input: {
  parsed: z.infer<typeof aiPdfImportStructureSchema>;
  files: PdfImportAiStructureInput["files"];
  projectName?: string;
  currency?: string;
  priceTolerance?: string;
  warnings: string[];
  latencyMs: number;
  provider: string;
}): PdfAiImportDraft {
  const firstFileName = input.files[0]?.fileName ?? "pdf";
  const currency = input.currency ?? input.parsed.project.currency ?? "PEN";
  const draft: PdfAiImportDraft = {
    source: "PDF_AI",
    project: {
      name: input.projectName?.trim() || input.parsed.project.name || "Proyecto importado desde PDF",
      currency,
    },
    sourceFiles: input.files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      role: file.role,
      pageCount: file.pageCount,
      confidence: file.confidence,
    })),
    budgets: input.parsed.budgets.map((budget, budgetIndex) => ({
      id: `ai-budget-${budgetIndex + 1}`,
      name: budget.name || `Presupuesto ${budgetIndex + 1}`,
      kind: "SUB_BUDGET",
      currency,
      levels: [],
      items: budget.items
        .filter((item) => item.code && item.description && item.unit)
        .map((item, itemIndex) => ({
          id: `ai-item-${budgetIndex + 1}-${itemIndex + 1}`,
          code: item.code ?? "",
          description: item.description ?? "",
          unit: item.unit ?? "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          partial: item.partial,
          sortOrder: itemIndex + 1,
          evidence: {
            sourceFileName: firstFileName,
            sourcePage: item.sourcePage,
            rawText: [item.code, item.description, item.unit, item.quantity, item.unitPrice, item.partial].filter(Boolean).join(" "),
            confidence: item.confidence,
          },
          needsReview: item.confidence < 0.7,
          reviewReason: item.confidence < 0.7 ? "Confianza IA baja." : null,
        })),
    })),
    apus: input.parsed.apus
      .filter((apu) => apu.name && apu.unit)
      .map((apu, apuIndex) => ({
        id: `ai-apu-${apuIndex + 1}`,
        budgetItemCode: apu.budgetItemCode ?? null,
        name: apu.name ?? "",
        unit: apu.unit ?? "",
        performance: apu.performance,
        totalUnitCost: apu.totalUnitCost,
        rows: apu.rows.map((row, rowIndex): PdfImportedApuRow => ({
          id: `ai-apu-${apuIndex + 1}-row-${rowIndex + 1}`,
          description: row.description ?? "",
          unit: row.unit ?? "",
          resourceType: normalizeAiResourceType(row.resourceType),
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          subtotal: row.subtotal,
          sortOrder: rowIndex + 1,
          evidence: {
            sourceFileName: firstFileName,
            sourcePage: row.sourcePage,
            rawText: [row.description, row.unit, row.quantity, row.unitPrice, row.subtotal].filter(Boolean).join(" "),
            confidence: row.confidence,
          },
          needsReview: row.confidence < 0.7,
          reviewReason: row.confidence < 0.7 ? "Confianza IA baja." : null,
        })),
        evidence: {
          sourceFileName: firstFileName,
          sourcePage: apu.sourcePage,
          rawText: [apu.budgetItemCode, apu.name, apu.unit, apu.totalUnitCost].filter(Boolean).join(" "),
          confidence: apu.confidence,
        },
      })),
    subpartidas: input.parsed.subpartidas
      .filter((subpartida) => subpartida.description && subpartida.unit)
      .map((subpartida, subpartidaIndex) => ({
        id: `ai-subpartida-${subpartidaIndex + 1}`,
        code: subpartida.code ?? null,
        description: subpartida.description ?? "",
        unit: subpartida.unit ?? "",
        unitPrice: subpartida.unitPrice,
        performance: subpartida.performance,
        rows: subpartida.rows.map((row, rowIndex): PdfImportedApuRow => ({
          id: `ai-subpartida-${subpartidaIndex + 1}-row-${rowIndex + 1}`,
          description: row.description ?? "",
          unit: row.unit ?? "",
          resourceType: normalizeAiResourceType(row.resourceType),
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          subtotal: row.subtotal,
          sortOrder: rowIndex + 1,
          evidence: {
            sourceFileName: firstFileName,
            sourcePage: row.sourcePage,
            rawText: [row.description, row.unit, row.quantity, row.unitPrice, row.subtotal].filter(Boolean).join(" "),
            confidence: row.confidence,
          },
          needsReview: row.confidence < 0.7,
          reviewReason: row.confidence < 0.7 ? "Confianza IA baja." : null,
        })),
        evidence: {
          sourceFileName: firstFileName,
          sourcePage: subpartida.sourcePage,
          rawText: [subpartida.code, subpartida.description, subpartida.unit, subpartida.unitPrice].filter(Boolean).join(" "),
          confidence: subpartida.confidence,
        },
      })),
    resources: [],
    links: [],
    validations: [],
    warnings: [
      ...input.parsed.warnings,
      ...input.warnings,
      `Estructurado con IA (${input.provider}) en ${input.latencyMs} ms.`,
    ],
  };

  return linkPdfImportDraft(calculatePdfImportDraftTotals(draft), { priceTolerance: input.priceTolerance ?? "0.01" });
}

function normalizeAiResourceType(value: string | null) {
  const normalized = (value ?? "OTHER").toUpperCase();
  if (["MATERIAL", "LABOR", "EQUIPMENT", "TOOLS"].includes(normalized)) {
    return normalized;
  }
  if (normalized === "SUBPARTIDA") {
    return "SUBPARTIDA";
  }
  return "OTHER";
}
