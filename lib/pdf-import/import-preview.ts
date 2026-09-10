import { calculatePdfImportDraftTotals } from "./calculations";
import { linkPdfImportDraft } from "./linker";
import { createPdfImportWarnings } from "./warnings";
import type {
  PdfAiImportDraft,
  PdfImportDocumentRole,
  PdfImportedApu,
  PdfImportedApuRow,
  PdfImportedBudgetLevel,
  PdfImportedBudgetItem,
  PdfImportedBudgetFooterRow,
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
    requiresOcr?: boolean;
    ocrApplied?: boolean;
    aiDebug?: PdfAiImportDraft["aiDebug"];
  }>;
};

export function createPdfAiImportDraftFromText(input: CreatePdfAiImportDraftFromTextInput): PdfAiImportDraft {
  const currency = input.currency ?? "PEN";
  const normalizedFiles = input.files.map((file) => ({ ...file, text: normalizePdfImportText(file.text) }));
  const budgetFiles = normalizedFiles.filter((file) => file.role === "BUDGET");
  const budgetItems = budgetFiles.flatMap((file) => parseBudgetItems(file.fileName, file.text, file.confidence));
  const budgetLevels = budgetFiles.flatMap((file) => parseBudgetLevels(file.fileName, file.text));
  const budgetFooterRows = budgetFiles.flatMap((file) => parseBudgetFooterRows(file.text));
  const sourceMetadata = parsePdfSourceMetadata(budgetFiles[0]?.text ?? "");
  const linkedBudgetItems = budgetItems.map((item) => ({
    ...item,
    levelId: findBudgetLevelId(item.code, budgetLevels),
  }));
  const apus = normalizedFiles.flatMap((file) => (file.role === "APU" ? parseApus(file.fileName, file.text, file.confidence) : []));
  const subpartidas = normalizedFiles.flatMap((file) => (file.role === "SUBPARTIDAS" ? parseSubpartidas(file.fileName, file.text, file.confidence) : []));
  const linkedApus = apus.map((apu) => ({
    ...apu,
    rows: apu.rows.map((row) => subpartidas.some((subpartida) => normalizePdfImportDescription(subpartida.description) === normalizePdfImportDescription(row.description) && normalizePdfUnit(subpartida.unit) === normalizePdfUnit(row.unit))
      ? { ...row, resourceType: "SUBPARTIDA" }
      : row),
  }));
  const resources = linkedApus.flatMap((apu) => apu.rows.map((row): PdfImportedResource => createResourceFromApuRow(row, currency)));
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
  if (linkedBudgetItems.length === 0) {
    warnings.push("No se encontraron partidas de presupuesto en los PDFs.");
  }
  if (apus.length === 0) {
    warnings.push("No se encontraron APUs estructurados en los PDFs.");
  }

  const draft: PdfAiImportDraft = {
    source: "PDF_AI",
    project: {
      name: input.projectName?.trim() || sourceMetadata.projectName || "Proyecto importado desde PDF",
      currency,
    },
    sourceFiles: input.files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      role: file.role,
      pageCount: file.pageCount ?? 1,
      confidence: file.confidence ?? 0.7,
      ...(file.requiresOcr && file.ocrApplied ? { ocrText: file.text } : {}),
    })),
    budgets: [
      {
        id: "budget-pdf-general",
        name: sourceMetadata.subBudgetName || "Presupuesto importado",
        kind: "SUB_BUDGET",
        currency,
        levels: budgetLevels,
        items: linkedBudgetItems,
        footerRows: budgetFooterRows,
      },
    ],
    apus: linkedApus,
    subpartidas,
    resources,
    links: [],
    validations: [],
    warnings,
    aiDebug: input.files.flatMap((file) => file.aiDebug ?? []),
  };

  const priceTolerance = input.priceTolerance ?? "0.01";
  const linkedDraft = linkPdfImportDraft(calculatePdfImportDraftTotals(draft), { priceTolerance });
  return createPdfImportWarnings(linkedDraft, { priceTolerance });
}

export function normalizePdfImportText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line
      .replace(/\s*\|\s*/g, " ")
      .replace(/S\/\s*/gi, "")
      .replace(/ {2,}/g, " ")
      .trim())
    .filter((line) => !/^[-\s|]+$/.test(line))
    .join("\n");
}

function parsePdfSourceMetadata(text: string) {
  const projectName = readPdfHeaderValue(text, "PROYECTO", ["SUBPRESUPUESTO", "CLIENTE", "UBICACION", "FECHA BASE", "MONEDA"]);
  const subBudgetName = readPdfHeaderValue(text, "SUBPRESUPUESTO", ["CLIENTE", "UBICACION", "FECHA BASE", "MONEDA"]);
  return { projectName, subBudgetName };
}

function readPdfHeaderValue(text: string, label: string, followingLabels: string[]) {
  const following = followingLabels.join("|");
  const match = text.match(new RegExp(`${label}\\s*:\\s*(.*?)(?=\\s+(?:${following})\\s*:|\\s+ITEM\\s+PARTIDA|$)`, "i"));
  return match?.[1]?.trim() || null;
}

function parseBudgetFooterRows(text: string): PdfImportedBudgetFooterRow[] {
  const rows: PdfImportedBudgetFooterRow[] = [];
  const footerPattern = /(?:^|\s)(COSTO DIRECTO|GASTOS GENERALES|UTILIDAD|SUB TOTAL|IGV|TOTAL PRESUPUESTO)(?:\s+(\d+(?:\.\d+)?%))?\s+(-?\d[\d,]*(?:\.\d+)?)(?=\s|$)/gi;
  const variableByDescription: Record<string, string> = {
    "COSTO DIRECTO": "CD",
    "GASTOS GENERALES": "PGG",
    UTILIDAD: "UTI",
    "SUB TOTAL": "ST",
    IGV: "IGV",
    "TOTAL PRESUPUESTO": "TOTAL",
  };

  for (const match of text.matchAll(footerPattern)) {
    const description = match[1]!.toUpperCase();
    if (rows.some((row) => row.description === description)) continue;
    rows.push({
      id: `footer-${variableByDescription[description]!.toLowerCase()}`,
      variable: variableByDescription[description]!,
      description,
      rate: match[2] ?? null,
      value: normalizePdfNumber(match[3]!),
      highlight: description === "COSTO DIRECTO" || description === "SUB TOTAL" || description === "TOTAL PRESUPUESTO",
      sortOrder: rows.length,
    });
  }

  return rows;
}

function parseBudgetLevels(fileName: string, text: string): PdfImportedBudgetLevel[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const lineOrientedCodes = lines.filter((line) => /^\d+(?:\.\d+)*\s+/.test(line)).length;
  if (lineOrientedCodes >= 2) {
    return parseLineOrientedBudgetLevels(fileName, lines);
  }

  const pageBlocks = [...text.matchAll(/(?:^|\n)Pagina\s+(\d+)(?:,\s*segmento\s+\d+)?:\s*\n([\s\S]*?)(?=(?:\nPagina\s+\d+(?:,\s*segmento\s+\d+)?:)|$)/gi)];
  const blocks = pageBlocks.length > 0
    ? pageBlocks.map((match) => ({ page: Number(match[1]), text: match[2] ?? "" }))
    : [{ page: 1, text }];
  const levels: PdfImportedBudgetLevel[] = [];
  const levelPattern = /([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ0-9 ,.'-]+?)\s+(\d+(?:\.\d+)*)\s+(-?\d[\d,]*(?:\.\d+)?)(?=\s|$)/g;

  for (const block of blocks) {
    for (const match of block.text.matchAll(levelPattern)) {
      const name = cleanBudgetLevelName(match[1]!);
      const code = match[2]!;
      if (code.includes(".") && code.split(".").length > 2) continue;
      if (code.includes(".") && (code.split(".").at(-1)?.length ?? 0) > 1) continue;
      if (name.length < 3 || levels.some((level) => level.code === code)) continue;

      const parentCode = code.includes(".") ? code.slice(0, code.lastIndexOf(".")) : null;
      const parent = parentCode ? levels.find((level) => level.code === parentCode) : undefined;
      levels.push({
        id: `level-${code.replace(/[^a-zA-Z0-9]+/g, "-")}`,
        code,
        name,
        type: code.includes(".") ? "SUBTITLE" : "TITLE",
        parentId: parent?.id ?? null,
        sortOrder: levels.length + 1,
      });
    }
  }

  return levels;
}

function parseLineOrientedBudgetLevels(fileName: string, lines: string[]): PdfImportedBudgetLevel[] {
  const levels: PdfImportedBudgetLevel[] = [];
  const levelLines: Array<{ code: string; text: string; sourcePage: number; rawText: string }> = [];
  let sourcePage = 1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]!;
    const pageMatch = line.match(/^Pagina\s+(\d+)(?:,\s*segmento\s+\d+)?:$/i);
    if (pageMatch) {
      sourcePage = Number(pageMatch[1]);
      continue;
    }

    const codeMatch = line.match(/^(\d+(?:\.\d+)*)\s+(.+)$/);
    if (!codeMatch || parseBudgetLine(fileName, line, index + 1, 0.75, sourcePage)) continue;

    const code = codeMatch[1]!;
    let description = codeMatch[2]!.trim();
    let rawText = line;
    let nextIndex = index + 1;
    while (nextIndex < lines.length && !/^\d+(?:\.\d+)*\s+/.test(lines[nextIndex]!) && !/^Pagina\s+\d+(?:,\s*segmento\s+\d+)?:$/i.test(lines[nextIndex]!)) {
      description += ` ${lines[nextIndex]!.trim()}`;
      rawText += ` ${lines[nextIndex]!.trim()}`;
      nextIndex += 1;
    }
    index = nextIndex - 1;

    description = description
      .replace(/\s+-?\d[\d,]*(?:\.\d+)?\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (description.length < 3) continue;

    levelLines.push({ code, text: description, sourcePage, rawText });
  }

  for (const [index, level] of levelLines.entries()) {
    const parent = [...levelLines.slice(0, index)]
      .reverse()
      .find((candidate) => isDirectHierarchyParent(candidate.code, level.code));
    levels.push({
      id: `level-${level.code.replace(/[^a-zA-Z0-9]+/g, "-")}`,
      code: level.code,
      name: cleanBudgetLevelName(level.text).toUpperCase(),
      type: level.code.split(".").length === 1 ? "TITLE" : "SUBTITLE",
      parentId: parent ? `level-${parent.code.replace(/[^a-zA-Z0-9]+/g, "-")}` : null,
      sortOrder: index + 1,
    });
  }

  return levels;
}

function isDirectHierarchyParent(parentCode: string, childCode: string) {
  const parentSegments = parentCode.split(".");
  const childSegments = childCode.split(".");
  if (childSegments.length !== parentSegments.length + 1) return false;
  return parentSegments.every((segment, index) => Number(segment) === Number(childSegments[index]));
}

function cleanBudgetLevelName(value: string) {
  let name = value.trim();
  const numbers = [...name.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)];
  const lastNumber = numbers.at(-1);
  if (lastNumber?.index != null) {
    name = name.slice(lastNumber.index + lastNumber[0].length).trim();
  }

  const headerEnd = name.toUpperCase().lastIndexOf("PARCIAL");
  if (headerEnd >= 0) {
    name = name.slice(headerEnd + "PARCIAL".length).trim();
  }

  return name;
}

function findBudgetLevelId(code: string, levels: PdfImportedBudgetLevel[]) {
  const parent = [...levels]
    .sort((left, right) => right.code.length - left.code.length)
    .find((level) => code.startsWith(`${level.code}.`));
  return parent?.id ?? null;
}

function parseBudgetItems(fileName: string, text: string, confidence = 0.75): PdfImportedBudgetItem[] {
  let sourcePage = 1;
  const lineItems = text
    .split(/\r?\n/)
    .map((line, index) => {
      const pageMatch = line.match(/^Pagina\s+(\d+)(?:,\s*segmento\s+\d+)?:$/i);
      if (pageMatch) sourcePage = Number(pageMatch[1]);
      return parseBudgetLine(fileName, line, index + 1, confidence, sourcePage);
    })
    .filter((item): item is PdfImportedBudgetItem => item != null);

  const parsedItems = lineItems.length > 0 ? lineItems : parseFlattenedBudgetItems(fileName, text, confidence);
  return deduplicateBudgetItems(parsedItems);
}

function deduplicateBudgetItems(items: PdfImportedBudgetItem[]) {
  const seenCodes = new Set<string>();
  return items.filter((item) => {
    if (seenCodes.has(item.code)) return false;
    seenCodes.add(item.code);
    return true;
  });
}

function parseFlattenedBudgetItems(fileName: string, text: string, confidence: number): PdfImportedBudgetItem[] {
  const pageBlocks = [...text.matchAll(/(?:^|\n)Pagina\s+(\d+)(?:,\s*segmento\s+\d+)?:\s*\n([\s\S]*?)(?=(?:\nPagina\s+\d+(?:,\s*segmento\s+\d+)?:)|$)/gi)];
  const blocks = pageBlocks.length > 0
    ? pageBlocks.map((match) => ({ page: Number(match[1]), text: match[2] ?? "" }))
    : [{ page: 1, text }];
  const items: PdfImportedBudgetItem[] = [];
  const rowPattern = /(\d+(?:\.\d+)+)\s+([^\s\d][^\s]*)\s+(-?\d[\d,]*(?:\.\d+)?)\s+(-?\d[\d,]*(?:\.\d+)?)\s+(-?\d[\d,]*(?:\.\d+)?)(?=\s|$)/g;

  for (const block of blocks) {
    let previousRowEnd = 0;
    for (const match of block.text.matchAll(rowPattern)) {
      const [, code, unit, quantity, unitPrice, partial] = match;
      const description = cleanFlattenedDescription(
        block.text.slice(previousRowEnd, match.index ?? 0),
        previousRowEnd === 0,
      );
      previousRowEnd = (match.index ?? 0) + match[0].length;
      if (!description) {
        continue;
      }
      const sortOrder = items.length + 1;
      items.push({
        id: `item-${code!.replace(/[^a-zA-Z0-9]+/g, "-")}-${block.page}-${sortOrder}`,
        code: code!,
        description,
        unit: normalizePdfUnit(unit!),
        quantity: normalizePdfNumber(quantity!),
        unitPrice: normalizePdfNumber(unitPrice!),
        partial: normalizePdfNumber(partial!),
        sortOrder,
        evidence: {
          sourceFileName: fileName,
          sourcePage: block.page,
          rawText: match[0].trim(),
          confidence,
        },
      });
    }
  }

  return items;
}

function cleanFlattenedDescription(value: string, removePageHeader = false) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const removeSectionSummary = (text: string) => {
    const sectionSummaryPattern = /(?:^|\s)([A-ZÁÉÍÓÚÑ][\s\S]*?)\s+\d+(?:\.\d+)*\s+-?\d[\d,]*(?:\.\d+)?\s+/g;
    const summaries = [...text.matchAll(sectionSummaryPattern)];
    const lastSummary = summaries.at(-1);
    return lastSummary?.index != null ? text.slice(lastSummary.index + lastSummary[0].length).trim() : text;
  };

  if (!removePageHeader) return removeSectionSummary(trimmed);

  const partialIndex = trimmed.toUpperCase().lastIndexOf("PARCIAL");
  if (partialIndex >= 0) {
    const afterHeader = trimmed.slice(partialIndex + "PARCIAL".length).trim();
    return removeSectionSummary(afterHeader);
  }

  const numbers = [...trimmed.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)];
  if (numbers.length === 0) return trimmed;

  return trimmed.slice((numbers.at(-1)?.index ?? -1) + (numbers.at(-1)?.[0].length ?? 0)).trim();
}

function normalizePdfNumber(value: string) {
  return value.replace(/,/g, "");
}

function normalizePdfUnit(value: string) {
  const replacements: Record<string, string> = {
    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",
    "Ã±": "ñ", "Ã‘": "Ñ", "Ã’": "Ò", "Ã“": "Ó", "Ã”": "Ô",
    "Ãš": "Ú", "Ã™": "Ù", "Ã˜": "Ø", "Ã†": "Æ", "Ã‡": "Ç", "Ã§": "ç",
  };
  const repaired = Object.entries(replacements).reduce((result, [broken, normalized]) => result.replaceAll(broken, normalized), value);
  return repaired.replace(/Â([°²³])/g, "$1").replaceAll("\u00c3\u2018", "Ñ");
}

function parseBudgetLine(fileName: string, line: string, sortOrder: number, confidence: number, sourcePage = 1): PdfImportedBudgetItem | null {
  const match = line.trim().match(/^(\d+(?:\.\d+)*)\s+(.+?)\s+([^\s\d][^\s]*)\s+(-?\d[\d,]*(?:\.\d+)?)\s+(-?\d[\d,]*(?:\.\d+)?)\s+(-?\d[\d,]*(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }

  const [, code, description, unit, quantity, unitPrice, partial] = match;
  return {
    id: `item-${code!.replace(/[^a-zA-Z0-9]+/g, "-")}`,
    code: code!,
    description: description!.trim(),
    unit: normalizePdfUnit(unit!),
    quantity: normalizePdfNumber(quantity!),
    unitPrice: normalizePdfNumber(unitPrice!),
    partial: normalizePdfNumber(partial!),
    sortOrder,
    evidence: {
      sourceFileName: fileName,
      sourcePage,
      rawText: line.trim(),
      confidence,
    },
  };
}

function parseApus(fileName: string, text: string, confidence = 0.75): PdfImportedApu[] {
  const sections = parseCostSections(text, /(?:Pagina\s+\d+:\s*[\s\S]*?MONEDA:\s*[^\s]+|(?:Subcontratos|Sub Partidas|Materiales|Equipos|Mano de obra):\s*-?\d[\d,]*(?:\.\d+)?)\s+(\d+\.\d+(?:\.\d+)*)\s+([A-ZÁÉÍÓÚÑ][\s\S]*?)\s+Rendimiento:\s*(-?\d[\d,]*(?:\.\d+)?)\s+([^\s/]+)\/DIA\s+Unidad:\s*([^\s]+)\s+Costo Unitario:\s*(-?\d[\d,]*(?:\.\d+)?)/gi);
  const supplementalHeadingIndexes = [...text.matchAll(/\b\d+\.\d+(?:\.\d+)*\s+[A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜ 0-9.,='()\-/]{3,140}?\s+Rendimiento:/gi)]
    .map((match) => match.index ?? 0);
  const supplementalApus = [...text.matchAll(/(\d+\.\d+(?:\.\d+)*)\s+([A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜ 0-9.,='()\-/]{3,140}?)\s+Rendimiento:\s*(-?\d[\d,]*(?:\.\d+)?)\s+([^\s/]+)\/DIA\s+Unidad:\s*([^\s]+)\s+Costo Unitario:\s*(-?\d[\d,]*(?:\.\d+)?)/gi)]
    .filter((match) => !sections.some((section) => section.match[1] === match[1]) && !/(?:MONEDA|INSUMO|UNIDAD|CUADRILLA|CANTIDAD|PARCIAL|MATERIALES|EQUIPOS|MANO DE OBRA|SUB PARTIDAS)/i.test(match[2] ?? ""))
    .map((match) => {
      const id = `apu-${match[1]!.replace(/[^a-zA-Z0-9]+/g, "-")}`;
      const sourcePage = sourcePageAt(text, match.index ?? 0);
      const bodyStart = (match.index ?? 0) + match[0].length;
      const bodyEnd = supplementalHeadingIndexes.find((index) => index >= bodyStart) ?? text.length;
      return {
        id, budgetItemCode: match[1]!, name: match[2]!.trim(), unit: normalizePdfUnit(match[4]!), performance: normalizePdfNumber(match[3]!), totalUnitCost: normalizePdfNumber(match[6]!),
        rows: parseCostRows(id, fileName, text.slice((match.index ?? 0) + match[0].length, bodyEnd), confidence, sourcePage),
        evidence: { sourceFileName: fileName, sourcePage, rawText: match[0], confidence },
      } satisfies PdfImportedApu;
    });
  const missingPerformanceMatches: Array<{ code: string; name: string; unit: string; totalUnitCost: string; index: number; end: number }> = [];
  for (const performanceMatch of text.matchAll(/(?!)Rendimiento:\s*([^\s/]+)\/DIA\s+Unidad:\s*([^\s]+)\s+Costo Unitario:\s*(-?\d[\d,]*(?:\.\d+)?)/gi)) {
    if (/^-?\d[\d,]*(?:\.\d+)?$/.test(performanceMatch[1] ?? "")) continue;
    const end = performanceMatch.index ?? 0;
    const windowStart = Math.max(0, end - 180);
    const window = text.slice(windowStart, end);
    const headingMatches = [...window.matchAll(/(\d+\.\d+(?:\.\d+)*)\s+([A-Z][\s\S]{1,120}?)\s*$/gm)];
    const heading = headingMatches.at(-1);
    if (!heading) continue;
    missingPerformanceMatches.push({ code: heading[1]!, name: heading[2]!.trim(), unit: performanceMatch[2]!, totalUnitCost: performanceMatch[3]!, index: windowStart + (heading.index ?? 0), end: performanceMatch.index! + performanceMatch[0].length });
  }
  for (const match of text.matchAll(/(\d+\.\d+(?:\.\d+)*)\s+([A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ ]{3,100}?)\s+Rendimiento:\s*([^\s/]+)\/DIA\s+Unidad:\s*([^\s]+)\s+Costo Unitario:\s*(-?\d[\d,]*(?:\.\d+)?)/gi)) {
    if (/^-?\d[\d,]*(?:\.\d+)?$/.test(match[3] ?? "") || missingPerformanceMatches.some((current) => current.code === match[1])) continue;
    missingPerformanceMatches.push({ code: match[1]!, name: match[2]!.trim(), unit: match[4]!, totalUnitCost: match[5]!, index: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  for (const match of text.matchAll(/(\d+\.\d+(?:\.\d+)*)\s+([A-ZÁÉÍÓÚÑÜ][A-Za-zÁÉÍÓÚÑÜ 0-9.,='()\-/]{3,140}?)\s+Rendimiento:\s*([^\s/]+)\/DIA\s+Unidad:\s*([^\s]+)\s+Costo Unitario:\s*(-?\d[\d,]*(?:\.\d+)?)/gi)) {
    if (/^-?\d[\d,]*(?:\.\d+)?$/.test(match[3] ?? "") || missingPerformanceMatches.some((current) => current.code === match[1])) continue;
    missingPerformanceMatches.push({ code: match[1]!, name: match[2]!.trim(), unit: match[4]!, totalUnitCost: match[5]!, index: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  const missingPerformanceApus = missingPerformanceMatches.map((match) => {
      const id = `apu-${match.code.replace(/[^a-zA-Z0-9]+/g, "-")}`;
      const sourcePage = sourcePageAt(text, match.index);
      const nextIndex = text.slice(match.end).search(/\s+\d+\.\d+(?:\.\d+)*\s+[A-Z][\s\S]{1,120}?\s+Rendimiento:/i);
      const bodyEnd = nextIndex >= 0 ? match.end + nextIndex : text.length;
      return {
        id,
        budgetItemCode: match.code,
        name: match.name,
        unit: normalizePdfUnit(match.unit),
        performance: "1",
        performanceMissing: true,
        totalUnitCost: normalizePdfNumber(match.totalUnitCost),
        rows: parseCostRows(id, fileName, text.slice(match.end, bodyEnd), confidence, sourcePage),
        evidence: { sourceFileName: fileName, sourcePage, rawText: text.slice(match.index, match.end), confidence },
      } satisfies PdfImportedApu;
    });
  if (sections.length > 0) {
    return [...sections.map((section) => {
      const [, code, name, performance, , unit, totalUnitCost] = section.match;
      const id = `apu-${code!.replace(/[^a-zA-Z0-9]+/g, "-")}`;
      const sourcePage = sourcePageAt(text, section.index);
      const sectionEnd = section.index + section.match[0].length;
      const nextAdditionalHeading = [...sections.map((candidate) => candidate.index), ...supplementalHeadingIndexes, ...missingPerformanceMatches.map((match) => match.index)]
        .filter((index) => index >= sectionEnd)
        .sort((left, right) => left - right)[0];
      const bodyEnd = nextAdditionalHeading && nextAdditionalHeading > sectionEnd
        ? nextAdditionalHeading
        : sectionEnd + section.body.length;
      return {
        id,
        budgetItemCode: code!,
        name: name!.trim(),
        unit: normalizePdfUnit(unit!),
        performance: normalizePdfNumber(performance ?? "1"),
        performanceMissing: !performance,
        totalUnitCost: normalizePdfNumber(totalUnitCost!),
        rows: parseCostRows(id, fileName, text.slice(sectionEnd, bodyEnd), confidence, sourcePage),
        evidence: { sourceFileName: fileName, sourcePage, rawText: section.match[0], confidence },
      } satisfies PdfImportedApu;
    }), ...supplementalApus, ...missingPerformanceApus];
  }

  if (supplementalApus.length > 0 || missingPerformanceApus.length > 0) {
    return [...supplementalApus, ...missingPerformanceApus];
  }

  const missingPerformanceSections = parseCostSections(text, /(?:MONEDA:\s*[^\s]+|(?:Subcontratos|Sub Partidas|Materiales|Equipos|Mano de obra):\s*-?\d[\d,]*(?:\.\d+)?)\s+(\d+\.\d+(?:\.\d+)*)\s+([A-Z][\s\S]*?)\s+Rendimiento:\s*([^\s/]+)\/DIA\s+Unidad:\s*([^\s]+)\s+Costo Unitario:\s*(-?\d[\d,]*(?:\.\d+)?)/gi);
  if (missingPerformanceSections.length > 0) {
    return missingPerformanceSections.map((section) => {
      const [, code, name, , unit, totalUnitCost] = section.match;
      const id = `apu-${code!.replace(/[^a-zA-Z0-9]+/g, "-")}`;
      const sourcePage = sourcePageAt(text, section.index);
      return {
        id,
        budgetItemCode: code!,
        name: name!.trim(),
        unit: normalizePdfUnit(unit!),
        performance: "1",
        performanceMissing: true,
        totalUnitCost: normalizePdfNumber(totalUnitCost!),
        rows: parseCostRows(id, fileName, section.body, confidence, sourcePage),
        evidence: { sourceFileName: fileName, sourcePage, rawText: section.match[0], confidence },
      } satisfies PdfImportedApu;
    });
  }

  const unanchoredMissingPerformance = [...text.matchAll(/\b(\d+\.\d+(?:\.\d+)*)\s+([A-Z][\s\S]*?)\s+Rendimiento:\s*([^\s/]+)\/DIA\s+Unidad:\s*([^\s]+)\s+Costo Unitario:\s*(-?\d[\d,]*(?:\.\d+)?)/gi)];
  if (unanchoredMissingPerformance.length > 0) {
    return unanchoredMissingPerformance.map((match, index) => {
      const [, code, name, , unit, totalUnitCost] = match;
      const id = `apu-${code!.replace(/[^a-zA-Z0-9]+/g, "-")}`;
      const sourcePage = sourcePageAt(text, match.index ?? 0);
      const nextIndex = unanchoredMissingPerformance[index + 1]?.index ?? text.length;
      return {
        id,
        budgetItemCode: code!,
        name: name!.trim(),
        unit: normalizePdfUnit(unit!),
        performance: "1",
        performanceMissing: true,
        totalUnitCost: normalizePdfNumber(totalUnitCost!),
        rows: parseCostRows(id, fileName, text.slice((match.index ?? 0) + match[0].length, nextIndex), confidence, sourcePage),
        evidence: { sourceFileName: fileName, sourcePage, rawText: match[0], confidence },
      } satisfies PdfImportedApu;
    });
  }

  return parseLegacyApus(fileName, text, confidence);
}

function parseLegacyApus(fileName: string, text: string, confidence = 0.75): PdfImportedApu[] {
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
        unit: normalizePdfUnit(unit!),
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
        unit: normalizePdfUnit(unit!),
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

function parseSubpartidas(fileName: string, text: string, confidence = 0.75): PdfAiImportDraft["subpartidas"] {
  const sections = parseCostSections(text, /(?:MONEDA:\s*[^\s]+|Sub Partidas:\s*-?\d[\d,]*(?:\.\d+)?)\s+([A-ZÁÉÍÓÚÑ][\s\S]*?)\s+Rendimiento:\s*(-?\d[\d,]*(?:\.\d+)?)\s+([^\s/]+)\/DIA\s+Unidad:\s*([^\s]+)\s+Costo Unitario:\s*(-?\d[\d,]*(?:\.\d+)?)/gi);
  return sections.map((section, index) => {
    const [, name, performance, , unit, unitPrice] = section.match;
    const id = `subpartida-${index + 1}-${normalizeTextForId(name!)}`;
    const sourcePage = sourcePageAt(text, section.index);
    return {
      id,
      description: name!.trim(),
      unit: normalizePdfUnit(unit!),
      unitPrice: normalizePdfNumber(unitPrice!),
    performance: normalizePdfNumber(performance ?? "1"),
    performanceMissing: !performance,
      rows: parseCostRows(id, fileName, section.body, confidence, sourcePage),
      evidence: { sourceFileName: fileName, sourcePage, rawText: section.match[0], confidence },
    };
  });
}

function parseCostSections(text: string, pattern: RegExp) {
  const matches = [...text.matchAll(pattern)].filter((match) => {
    const name = match[2] ?? match[1] ?? "";
    return !/(?:Subcontratos|Sub Partidas|Materiales|Equipos|Mano de obra):|\b(?:HH|HM|BLS|GLB|M3|M2|M3K|%MO)\b/i.test(name);
  });
  return matches.map((match, index) => ({
    match,
    index: match.index ?? 0,
    body: text.slice((match.index ?? 0) + match[0].length, matches[index + 1]?.index ?? text.length),
  }));
}

function parseCostRows(parentId: string, fileName: string, body: string, confidence: number, sourcePage: number): PdfImportedApuRow[] {
  const number = "-?\\d[\\d,]*(?:\\.\\d+)?";
  const cleanBody = body.replace(/(?:Mano de obra|Materiales|Equipos|Sub Partidas|Subcontratos):\s*-?\d[\d,]*(?:\.\d+)?/gi, " ");
  const headerIndex = cleanBody.search(/\bParcial\b/i);
  const rowBody = headerIndex >= 0 ? cleanBody.slice(headerIndex + "Parcial".length) : cleanBody;
  const rowPattern = new RegExp(`(.+?)\\s+([^\\s]+)\\s+(?:(${number})\\s+)?(${number})\\s+(${number})\\s+(${number})(?=\\s|$)`, "gi");
  const rows: PdfImportedApuRow[] = [];

  for (const match of rowBody.matchAll(rowPattern)) {
    const description = match[1]!.trim();
    if (!description || /^(Insumo|Unidad|Cuadrilla|Cantidad|PU|Parcial)$/i.test(description)) continue;
    const quantity = match[4]!;
    const unitPrice = match[5]!;
    const subtotal = match[6]!;
    rows.push({
      id: `row-${parentId}-${rows.length + 1}`,
      description,
      unit: normalizePdfUnit(match[2]!),
      resourceType: inferResourceType(description),
      quantity: normalizePdfNumber(quantity),
      unitPrice: normalizePdfNumber(unitPrice),
      subtotal: normalizePdfNumber(subtotal),
      sortOrder: rows.length + 1,
      evidence: { sourceFileName: fileName, sourcePage, rawText: match[0].trim(), confidence },
    });
  }
  return rows;
}

function sourcePageAt(text: string, index: number) {
  const pages = [...text.slice(0, index).matchAll(/Pagina\s+(\d+)/gi)];
  return Number(pages.at(-1)?.[1] ?? 1);
}

function normalizeTextForId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";
}

function normalizePdfImportDescription(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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
