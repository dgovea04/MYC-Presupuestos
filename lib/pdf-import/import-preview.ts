import { calculatePdfImportDraftTotals } from "./calculations";
import { linkPdfImportDraft } from "./linker";
import { createPdfImportWarnings } from "./warnings";
import type {
  PdfAiImportDraft,
  PdfImportDocumentRole,
  PdfImportedApu,
  PdfImportedApuRow,
  PdfImportedBudgetItem,
  PdfImportedResource,
} from "./types";

export type CreatePdfAiImportDraftFromTextInput = {
  companyId?: string;
  projectName?: string;
  currency?: string;
  priceTolerance?: string;
  files: Array<{
    id: string;
    fileName: string;
    role: PdfImportDocumentRole;
    text: string;
    pageCount?: number;
    confidence?: number;
  }>;
};

export function createPdfAiImportDraftFromText(input: CreatePdfAiImportDraftFromTextInput): PdfAiImportDraft {
  const currency = input.currency ?? "PEN";
  const budgetItems = input.files.flatMap((file) => (file.role === "BUDGET" ? parseBudgetItems(file.fileName, file.text, file.confidence) : []));
  const apus = input.files.flatMap((file) => (file.role === "APU" ? parseApus(file.fileName, file.text, file.confidence) : []));
  const resources = apus.flatMap((apu) => apu.rows.map((row): PdfImportedResource => createResourceFromApuRow(row, currency)));
  const warnings: string[] = [];

  for (const file of input.files) {
    if (file.role === "OTHER") {
      warnings.push(`No se pudo clasificar ${file.fileName} como presupuesto, APU o subpartidas.`);
    }
    if ("requiresOcr" in file && file.requiresOcr && !("ocrApplied" in file && file.ocrApplied)) {
      warnings.push(`${file.fileName} parece escaneado y no tuvo OCR automatico disponible. Configura una API key cloud en Configuracion > IA > Proveedores Cloud IA.`);
    }
    if ("requiresOcr" in file && file.requiresOcr && "ocrApplied" in file && file.ocrApplied) {
      warnings.push(`${file.fileName} fue procesado con OCR/vision; revisa las filas de baja confianza.`);
    }
  }
  if (budgetItems.length === 0) {
    warnings.push("No se encontraron partidas de presupuesto en los PDFs.");
  }
  if (apus.length === 0) {
    warnings.push("No se encontraron APUs estructurados en los PDFs.");
  }

  const draft: PdfAiImportDraft = {
    source: "PDF_AI",
    project: {
      name: input.projectName?.trim() || "Proyecto importado desde PDF",
      currency,
    },
    sourceFiles: input.files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      role: file.role,
      pageCount: file.pageCount ?? 1,
      confidence: file.confidence ?? 0.7,
    })),
    budgets: [
      {
        id: "budget-pdf-general",
        name: "Presupuesto importado",
        kind: "SUB_BUDGET",
        currency,
        levels: [],
        items: budgetItems,
      },
    ],
    apus,
    subpartidas: [],
    resources,
    links: [],
    validations: [],
    warnings,
  };

  const priceTolerance = input.priceTolerance ?? "0.01";
  const linkedDraft = linkPdfImportDraft(calculatePdfImportDraftTotals(draft), { priceTolerance });
  return createPdfImportWarnings(linkedDraft, { priceTolerance });
}

function parseBudgetItems(fileName: string, text: string, confidence = 0.75): PdfImportedBudgetItem[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => parseBudgetLine(fileName, line, index + 1, confidence))
    .filter((item): item is PdfImportedBudgetItem => item != null);
}

function parseBudgetLine(fileName: string, line: string, sortOrder: number, confidence: number): PdfImportedBudgetItem | null {
  const match = line.trim().match(/^(\d+(?:\.\d+)*)\s+(.+?)\s+([a-zA-Z0-9.³²]+)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }

  const [, code, description, unit, quantity, unitPrice, partial] = match;
  return {
    id: `item-${code!.replace(/[^a-zA-Z0-9]+/g, "-")}`,
    code: code!,
    description: description!.trim(),
    unit: unit!,
    quantity: quantity!,
    unitPrice: unitPrice!,
    partial: partial!,
    sortOrder,
    evidence: {
      sourceFileName: fileName,
      sourcePage: 1,
      rawText: line.trim(),
      confidence,
    },
  };
}

function parseApus(fileName: string, text: string, confidence = 0.75): PdfImportedApu[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const apus: PdfImportedApu[] = [];
  let current: PdfImportedApu | null = null;

  lines.forEach((line, index) => {
    const apuMatch = line.match(/^APU\s+(\d+(?:\.\d+)*)\s+(.+?)\s+([a-zA-Z0-9.³²]+)\s+(-?\d+(?:\.\d+)?)$/i);
    if (apuMatch) {
      const [, code, name, unit, totalUnitCost] = apuMatch;
      current = {
        id: `apu-${code!.replace(/[^a-zA-Z0-9]+/g, "-")}`,
        budgetItemCode: code!,
        name: name!.trim(),
        unit: unit!,
        performance: "1",
        totalUnitCost: totalUnitCost!,
        rows: [],
        evidence: {
          sourceFileName: fileName,
          sourcePage: 1,
          rawText: line,
          confidence,
        },
      };
      apus.push(current);
      return;
    }

    const rowMatch = line.match(/^RECURSO\s+(.+?)\s+([a-zA-Z0-9.³²]+)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/i);
    if (rowMatch && current) {
      const [, description, unit, quantity, unitPrice, subtotal] = rowMatch;
      current.rows.push({
        id: `row-${current.id}-${current.rows.length + 1}`,
        description: description!.trim(),
        unit: unit!,
        resourceType: inferResourceType(description!),
        quantity: quantity!,
        unitPrice: unitPrice!,
        subtotal: subtotal!,
        sortOrder: index + 1,
        evidence: {
          sourceFileName: fileName,
          sourcePage: 1,
          rawText: line,
          confidence,
        },
      });
    }
  });

  return apus;
}

function inferResourceType(description: string) {
  const normalized = description.toLowerCase();
  if (normalized.includes("mano") || normalized.includes("operario") || normalized.includes("peon")) {
    return "LABOR";
  }
  if (normalized.includes("equipo") || normalized.includes("herramienta")) {
    return "EQUIPMENT";
  }
  return "MATERIAL";
}

function createResourceFromApuRow(row: PdfImportedApuRow, currency: string): PdfImportedResource {
  return {
    id: `resource-${row.id}`,
    code: "",
    description: row.description,
    category: row.resourceType === "LABOR" || row.resourceType === "EQUIPMENT" ? row.resourceType : "MATERIAL",
    unit: row.unit,
    unitPrice: row.unitPrice,
    currency,
    evidence: row.evidence,
  };
}
