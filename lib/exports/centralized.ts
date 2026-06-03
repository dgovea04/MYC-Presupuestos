import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getUserAccount } from "@/lib/data/account";
import { getBudgetById } from "@/lib/data/budgets";
import { getBudgetFooterStructure, getBudgetGeneralExpenses, getGeneralBudgetResourceSummary } from "@/lib/data/budgets";
import { getUserCompanies } from "@/lib/data/projects";
import { getResourcesByUser } from "@/lib/data/resources";
import { getUserSettings } from "@/lib/data/settings";
import { getBudgetPolynomialFormulaSectionData } from "@/lib/data/polynomial-formulas";
import { getWorkScheduleSection } from "@/lib/data/work-schedule";
import { buildDisplayRows, levelTypeLabel } from "@/lib/budget/structure";
import { calculateBudgetRecord } from "@/lib/calculations/budget";
import { decimalToNumber } from "@/lib/db/serializers";
import { createApuWorkbook, createBudgetWorkbook } from "@/lib/exports/excel";
import { createApuPdf, createBudgetPdf, createTablesPdf, type PdfCurveChartPoint, type PdfExportTable, type PdfGanttChartRow } from "@/lib/exports/pdf";
import { normalizeResourceIuCode } from "@/lib/resources/iu";
import { formatDate } from "@/lib/utils";
import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_DEFINITIONS,
  getExportDefinition,
  getExportDefinitions,
  type ExportFormat,
  type ExportPreset,
  type ExportRequest,
  type NormalizedExportRequest,
} from "@/lib/exports/definitions";
import type { BudgetRecord } from "@/types/budget";
import type { ReportResponsibleMeta } from "@/types/report-meta";
import type { ResourceCategory } from "@/types/resource";
import type {
  WorkScheduleCurvePointRecord,
  WorkScheduleLineRecord,
  WorkSchedulePeriodRecord,
  WorkScheduleResourceCalendarRow,
  WorkScheduleValuationCalendarRow,
  WorkScheduleViewRecord,
} from "@/types/work-schedule";

export { getExportDefinition, getExportDefinitions };

export type ExportResult = {
  content: BodyInit;
  contentType: string;
  fileName: string;
};

type ExportTable = PdfExportTable & {
  slug: string;
};

type ZipInput = {
  fileName: string;
  content: string | Buffer | Uint8Array | ArrayBuffer;
};

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

export function normalizeExportRequest(input: ExportRequest): NormalizedExportRequest {
  const definition = EXPORT_DEFINITIONS[input.target];
  const preset = definition?.presets.find((candidate) => candidate.id === input.preset);

  if (!definition || !preset || !preset.formats.includes(input.format)) {
    throw new Error("La combinacion de modulo, formato y preset no esta disponible");
  }

  if (!input.targetId?.trim()) {
    throw new Error("El identificador del recurso a exportar es obligatorio");
  }

  const requestedDecimals = input.options?.currencyDecimals ?? preset.defaultOptions.currencyDecimals ?? DEFAULT_EXPORT_OPTIONS.currencyDecimals;
  const currencyDecimals = normalizeCurrencyDecimals(requestedDecimals);

  return {
      target: input.target,
    targetId: input.targetId,
    format: input.format,
    preset: input.preset,
    options: {
      ...DEFAULT_EXPORT_OPTIONS,
      ...preset.defaultOptions,
      ...input.options,
      currencyDecimals,
    },
  };
}

export async function createCentralizedExport(input: ExportRequest, userId: string): Promise<ExportResult> {
  const request = normalizeExportRequest(input);

  if (request.target === "budget") {
    return createBudgetExport(request, userId);
  }

  if (request.target === "apu") {
    return createApuExport(request, userId);
  }

  if (request.target === "resources") {
    return createResourcesExport(request, userId);
  }

  if (request.target === "budget_resources") {
    return createBudgetResourcesExport(request, userId);
  }

  if (request.target === "general_expenses") {
    return createGeneralExpensesExport(request, userId);
  }

  if (request.target === "budget_footer") {
    return createBudgetFooterExport(request, userId);
  }

  if (request.target === "polynomial_formula") {
    return createPolynomialFormulaExport(request, userId);
  }

  return createWorkScheduleExport(request, userId);
}

export function createExportResponse(result: ExportResult) {
  return new NextResponse(result.content, {
    headers: {
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${sanitizeFileName(result.fileName)}"`,
    },
  });
}

export function buildStoredZip(entries: ZipInput[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.fileName, "utf8");
    const content = normalizeZipContent(entry.content);
    const crc = crc32(content);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(content.byteLength, 18);
    localHeader.writeUInt32LE(content.byteLength, 22);
    localHeader.writeUInt16LE(fileName.byteLength, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, fileName, content);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(content.byteLength, 20);
    centralHeader.writeUInt32LE(content.byteLength, 24);
    centralHeader.writeUInt16LE(fileName.byteLength, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, fileName);
    offset += localHeader.byteLength + fileName.byteLength + content.byteLength;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.byteLength, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

async function createBudgetExport(request: NormalizedExportRequest, userId: string): Promise<ExportResult> {
  const { budget, responsible, settings } = await getBudgetExportContext(request.targetId, userId);
  const decimals = request.options.currencyDecimals ?? settings.currencyDecimals;

  if (request.format === "xlsx") {
    return {
      content: await createBudgetWorkbook(budget, budget.project, decimals, request.options.includeSignature ? responsible : undefined),
      contentType: CONTENT_TYPES.xlsx,
      fileName: request.options.fileName ?? `presupuesto-${budget.id}.xlsx`,
    };
  }

  if (request.format === "pdf") {
    return {
      content: await createBudgetPdf(budget, budget.project, decimals, request.options.includeSignature ? responsible : undefined),
      contentType: CONTENT_TYPES.pdf,
      fileName: request.options.fileName ?? `presupuesto-${budget.id}.pdf`,
    };
  }

  return {
    content: buildBudgetCsv(budget, decimals),
    contentType: CONTENT_TYPES.csv,
    fileName: request.options.fileName ?? `presupuesto-${budget.id}.csv`,
  };
}

async function createApuExport(request: NormalizedExportRequest, userId: string): Promise<ExportResult> {
  const { budget, responsible, settings } = await getBudgetExportContext(request.targetId, userId);
  const decimals = request.options.currencyDecimals ?? settings.currencyDecimals;

  if (request.format === "xlsx") {
    return {
      content: await createApuWorkbook(budget, budget.project, decimals, request.options.includeSignature ? responsible : undefined),
      contentType: CONTENT_TYPES.xlsx,
      fileName: request.options.fileName ?? `apu-${budget.id}.xlsx`,
    };
  }

  if (request.format === "pdf") {
    return {
      content: await createApuPdf(budget, budget.project, decimals, request.options.includeSignature ? responsible : undefined),
      contentType: CONTENT_TYPES.pdf,
      fileName: request.options.fileName ?? `apu-${budget.id}.pdf`,
    };
  }

  return {
    content: buildApuCsv(budget, decimals),
    contentType: CONTENT_TYPES.csv,
    fileName: request.options.fileName ?? `apu-${budget.id}.csv`,
  };
}

async function createResourcesExport(request: NormalizedExportRequest, userId: string): Promise<ExportResult> {
  const settings = await getUserSettings(userId);
  const resources = await getResourcesByUser(userId);
  const decimals = request.options.currencyDecimals ?? settings.currencyDecimals;
  const sortedResources = [...resources].sort((left, right) => {
    const categoryComparison = left.category.localeCompare(right.category);
    return categoryComparison === 0 ? left.description.localeCompare(right.description) : categoryComparison;
  });
  const rows: string[][] = [];
  const sectionRows: number[] = [];
  let currentCategory: ResourceCategory | null = null;

  for (const resource of sortedResources) {
    if (resource.category !== currentCategory) {
      currentCategory = resource.category;
      sectionRows.push(rows.length);
      rows.push([formatResourceCategoryLabel(resource.category).toUpperCase(), "", "", "", "", "", ""]);
    }

    rows.push([
      resource.code,
      resource.description,
      resource.unit,
      normalizeResourceIuCode(resource.iu) ?? "",
      normalizeResourceIuCode(resource.iuCurrent) ?? "",
      resource.currency,
      decimalToNumber(resource.unitPrice).toFixed(decimals),
    ]);
  }

  const table: ExportTable = {
    slug: "catalogo-insumos",
    title: "Catalogo de insumos",
    headers: ["Codigo", "Descripcion", "Unidad", "IU (Base Julio 1992=100)", "IU 2026", "Moneda", "Precio"],
    columnWidths: [50, 230, 42, 82, 46, 45, 50],
    fontSize: 7,
    headerFontSize: 7.2,
    sectionRows,
    rows,
  };

  return createTableExportResult(request, [table], "catalogo-insumos", "Catalogo de insumos");
}

function formatResourceCategoryLabel(category: ResourceCategory) {
  if (category === "LABOR") return "Mano de obra";
  if (category === "EQUIPMENT") return "Equipos";
  if (category === "TOOLS") return "Herramientas";
  if (category === "SUBCONTRACT") return "Sub contratos";
  return "Materiales";
}

async function createBudgetResourcesExport(request: NormalizedExportRequest, userId: string): Promise<ExportResult> {
  const { budget, settings } = await getBudgetExportContext(request.targetId, userId);
  const decimals = request.options.currencyDecimals ?? settings.currencyDecimals;
  const summary = await getGeneralBudgetResourceSummary(request.targetId, userId);
  const table: ExportTable = {
    slug: "lista-insumos",
    title: "Lista de insumos derivada",
    headers: ["Codigo", "Descripcion", "Categoria", "Unidad", "P. unitario", "Cantidad total", "Costo total", "Usos", "Sub presupuestos"],
    columnWidths: [44, 128, 74, 36, 54, 62, 58, 28, 120],
    fontSize: 6.5,
    headerFontSize: 6.8,
    rows: summary.resources.map((resource) => [
      resource.code,
      resource.description,
      resource.category,
      resource.unit,
      resource.unitPrice.toFixed(decimals),
      resource.totalQuantity.toFixed(4),
      resource.totalCost.toFixed(decimals),
      String(resource.usageCount),
      resource.budgetNames.join(", "),
    ]),
  };

  return createTableExportResult(request, [table], `lista-insumos-${budget.id}`, `Lista de insumos - ${budget.name}`);
}

async function createGeneralExpensesExport(request: NormalizedExportRequest, userId: string): Promise<ExportResult> {
  const { budget, settings } = await getBudgetExportContext(request.targetId, userId);
  const decimals = request.options.currencyDecimals ?? settings.currencyDecimals;
  const totalDirectCost = budget.totalDirectCost;
  const structure = await getBudgetGeneralExpenses(request.targetId, userId);
  const rows: string[][] = [];
  const sectionRows: number[] = [];
  const fixedTotal = structure.groups.find((group) => group.kind === "FIXED")?.subtotal ?? 0;
  const variableTotal = structure.groups.find((group) => group.kind === "VARIABLE")?.subtotal ?? 0;

  for (const group of structure.groups) {
    sectionRows.push(rows.length);
    rows.push([group.name, "", "", "", "", "", ""]);
    for (const title of group.titles) {
      rows.push([title.code, title.name, title.category, "", "", "", title.subtotal.toFixed(decimals)]);
      for (const item of title.items) {
        rows.push([
          item.code,
          item.description,
          item.unit,
          item.quantity.toFixed(decimals),
          item.participationPercentage.toFixed(2),
          item.unitPrice.toFixed(decimals),
          item.partial.toFixed(decimals),
        ]);
      }
    }
  }
  rows.push(["", "TOTAL", "", "", "", "", structure.total.toFixed(decimals)]);

  const summaryRows = [
    ["GASTOS GENERALES FIJOS", formatGeneralExpensePercentage(fixedTotal, totalDirectCost), fixedTotal.toFixed(decimals)],
    ["GASTOS GENERALES VARIABLES", formatGeneralExpensePercentage(variableTotal, totalDirectCost), variableTotal.toFixed(decimals)],
    ["TOTAL GASTOS GENERALES", formatGeneralExpensePercentage(structure.total, totalDirectCost), structure.total.toFixed(decimals)],
  ];

  return createTableExportResult(
    request,
    [
      {
        slug: "gastos-generales",
        title: "Gastos generales",
        headers: ["Codigo", "Descripcion", "Tipo", "Cantidad", "% Part.", "Precio", "Parcial"],
        columnWidths: [54, 185, 70, 58, 52, 52, 52],
        fontSize: 6.7,
        headerFontSize: 7,
        sectionRows,
        rows,
      },
      {
        slug: "resumen-gastos-generales",
        title: "Resumen final - DESCOMPOSICION DE LOS GASTOS GENERALES",
        headers: ["Descripcion", "Porcentaje", "Monto"],
        columnWidths: [300, 100, 123],
        fontSize: 8,
        headerFontSize: 8,
        startOnNewPage: true,
        rows: summaryRows,
      },
    ],
    `gastos-generales-${budget.id}`,
    `Gastos generales - ${budget.name}`,
  );
}

function formatGeneralExpensePercentage(amount: number, totalDirectCost: number) {
  if (totalDirectCost <= 0) {
    return "0.00%";
  }

  return `${((amount / totalDirectCost) * 100).toFixed(2)}%`;
}

async function createBudgetFooterExport(request: NormalizedExportRequest, userId: string): Promise<ExportResult> {
  const { budget, settings } = await getBudgetExportContext(request.targetId, userId);
  const decimals = request.options.currencyDecimals ?? settings.currencyDecimals;
  const structure = await getBudgetFooterStructure(request.targetId, userId);
  const emphasisRows: number[] = [];
  const rows = structure.rows.map((row) => [
    row.variable,
    row.description,
    row.formula ?? "",
    row.value.toFixed(decimals),
    row.iu ?? "",
  ]);
  structure.rows.forEach((row, index) => {
    if (row.highlight) {
      emphasisRows.push(index);
    }
  });

  const tables: ExportTable[] = [
    {
      slug: "pie-presupuesto",
      title: "Pie de presupuesto",
      headers: ["Variable", "Descripcion", "Formula", "Valor", "IU"],
      columnWidths: [58, 210, 146, 74, 35],
      emphasisRows,
      fontSize: 7.2,
      headerFontSize: 7.3,
      rows,
    },
  ];

  if (structure.amountInWords) {
    tables.push({
      slug: "importe-en-letras",
      title: "Importe en letras",
      headers: ["Detalle"],
      columnWidths: [523],
      fontSize: 8,
      headerFontSize: 8,
      hideHeader: true,
      rows: [[structure.amountInWords]],
    });
  }

  return createTableExportResult(
    request,
    tables,
    `pie-presupuesto-${budget.id}`,
    `Pie de presupuesto - ${budget.name}`,
  );
}

async function createPolynomialFormulaExport(request: NormalizedExportRequest, userId: string): Promise<ExportResult> {
  const section = await getBudgetPolynomialFormulaSectionData(request.targetId, userId);
  const rows = section.formula?.monomials.map((monomial) => [
    monomial.code,
    monomial.name,
    monomial.costGroupKey,
    Number(monomial.amount).toFixed(2),
    Number(monomial.coefficient).toFixed(3),
    `${monomial.baseIndexCode} - ${monomial.baseIndexName}`,
    monomial.baseIndexValue,
    monomial.adjustmentIndexCode ? `${monomial.adjustmentIndexCode} - ${monomial.adjustmentIndexName ?? ""}` : "",
    monomial.adjustmentIndexValue ?? "",
  ]) ?? [["", "No existe formula guardada", "", "", "", "", "", "", ""]];
  const tables: ExportTable[] = [
    {
      slug: "formula-polinomica",
      title: "Formula polinomica",
      headers: ["Codigo", "Monomio", "Grupo", "Monto", "Coef.", "Indice base", "Valor base", "Indice reajuste", "Valor reajuste"],
      columnWidths: [40, 100, 62, 56, 38, 92, 44, 92, 43],
      fontSize: 6.4,
      headerFontSize: 6.5,
      rows,
    },
  ];

  if (section.formula?.monomials.length) {
    tables.push({
      slug: "expresion-k",
      title: "Expresion K",
      headers: ["Expresion"],
      columnWidths: [523],
      fontSize: 8,
      headerFontSize: 8,
      hideHeader: true,
      rows: [[buildPolynomialKExpression(section.formula.monomials)]],
    });
  }

  return createTableExportResult(
    request,
    tables,
    `formula-polinomica-${request.targetId}`,
    section.formula?.name ?? "Formula polinomica",
  );
}

function buildPolynomialKExpression(monomials: NonNullable<Awaited<ReturnType<typeof getBudgetPolynomialFormulaSectionData>>["formula"]>["monomials"]) {
  return `K = ${monomials.map((monomial) => `${monomial.coefficient}(${monomial.code}r/${monomial.code}o)`).join(" + ")}`;
}

async function createWorkScheduleExport(request: NormalizedExportRequest, userId: string): Promise<ExportResult> {
  const settings = await getUserSettings(userId);
  const section = await getWorkScheduleSection(request.targetId, userId);
  const decimals = request.options.currencyDecimals ?? settings.currencyDecimals;
  const tables = buildWorkScheduleTables(section, decimals, settings.dateFormat);
  const selectedTables = selectWorkScheduleTables(request.preset, tables);

  if (request.format === "zip") {
    const entries = selectedTables.map((table) => ({
      fileName: `${table.slug}.csv`,
      content: buildCsvContent(table.headers, table.rows),
    }));

    return {
      content: buildStoredZip(entries),
      contentType: CONTENT_TYPES.zip,
      fileName: request.options.fileName ?? `cronograma-${section.budgetId}-paquete-ejecutivo.zip`,
    };
  }

  if (request.format === "xlsx") {
    return {
      content: await buildWorkScheduleWorkbook(selectedTables),
      contentType: CONTENT_TYPES.xlsx,
      fileName: request.options.fileName ?? `cronograma-${section.budgetId}-${selectedTables[0]?.slug ?? "export"}.xlsx`,
    };
  }

  if (request.format === "pdf") {
    const pdfTables = buildWorkSchedulePdfTables(request, selectedTables, section);
    return {
      content: await createTablesPdf("Programacion de obra", pdfTables, `Presupuesto ${section.budgetId}`, { layout: "landscape" }),
      contentType: CONTENT_TYPES.pdf,
      fileName: request.options.fileName ?? `cronograma-${section.budgetId}-${selectedTables[0]?.slug ?? "export"}.pdf`,
    };
  }

  return {
    content: buildCsvContent(selectedTables[0]?.headers ?? [], selectedTables[0]?.rows ?? []),
    contentType: CONTENT_TYPES.csv,
    fileName: request.options.fileName ?? `cronograma-${section.budgetId}-${selectedTables[0]?.slug ?? "export"}.csv`,
  };
}

function buildWorkSchedulePdfTables(
  request: NormalizedExportRequest,
  selectedTables: WorkScheduleExportTable[],
  section: WorkScheduleViewRecord,
): WorkScheduleExportTable[] {
  const tables: WorkScheduleExportTable[] = [];
  const shouldIncludeGantt =
    request.options.includeGanttChart &&
    (request.preset === "cronograma_ejecutivo" || request.preset === "cronograma_partidas");
  const shouldIncludeCurve =
    request.options.includeCurveChart &&
    (request.preset === "cronograma_ejecutivo" || request.preset === "curva_s");

  if (shouldIncludeGantt) {
    tables.push({
      slug: "gantt",
      title: "Diagrama Gantt",
      headers: ["Gantt"],
      hideHeader: true,
      rows: [],
      chart: {
        kind: "gantt",
        rows: buildWorkScheduleGanttRows(section, request.options.includeCriticalPath),
      },
    });
  }

  tables.push(...selectedTables.map((table, index) => (shouldIncludeGantt && index === 0 ? { ...table, startOnNewPage: true } : table)));

  if (shouldIncludeCurve) {
    tables.push({
      slug: "grafico-curva-s",
      title: "Grafico Curva S",
      headers: ["Curva S"],
      hideHeader: true,
      rows: [],
      chart: {
        kind: "curve",
        points: buildWorkScheduleCurveChartPoints(section.curveSeries),
      },
    });
  }

  return tables;
}

function buildWorkScheduleGanttRows(section: WorkScheduleViewRecord, includeCriticalPath: boolean): PdfGanttChartRow[] {
  return section.groups.flatMap((group) =>
    group.lines
      .filter((line) => line.startDate && line.endDate)
      .map((line) => ({
        durationDays: line.durationDays,
        endDate: line.endDate ?? "",
        group: group.subBudgetName,
        isCritical: includeCriticalPath && (line.criticalPath?.isCritical ?? false),
        label: `${line.itemCode} - ${line.description}`,
        startDate: line.startDate ?? "",
      })),
  );
}

function buildWorkScheduleCurveChartPoints(curveSeries: WorkScheduleCurvePointRecord[]): PdfCurveChartPoint[] {
  return curveSeries.map((point) => ({
    accumulatedAmount: point.accumulatedAmount,
    accumulatedPercentage: point.accumulatedPercentage,
    label: formatPeriod(point),
    monthlyAmount: point.monthlyAmount,
  }));
}

async function createTableExportResult(
  request: NormalizedExportRequest,
  tables: ExportTable[],
  baseFileName: string,
  title: string,
): Promise<ExportResult> {
  if (request.format === "xlsx") {
    return {
      content: await buildExportTablesWorkbook(tables),
      contentType: CONTENT_TYPES.xlsx,
      fileName: request.options.fileName ?? `${baseFileName}.xlsx`,
    };
  }

  if (request.format === "pdf") {
    return {
      content: await createTablesPdf(title, tables),
      contentType: CONTENT_TYPES.pdf,
      fileName: request.options.fileName ?? `${baseFileName}.pdf`,
    };
  }

  return {
    content: buildMultiTableCsv(tables),
    contentType: CONTENT_TYPES.csv,
    fileName: request.options.fileName ?? `${baseFileName}.csv`,
  };
}

async function buildExportTablesWorkbook(tables: ExportTable[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MYC Presupuestos";

  for (const table of tables) {
    const sheet = workbook.addWorksheet(table.title.slice(0, 31));
    sheet.addRow([table.title]);
    sheet.mergeCells(1, 1, 1, Math.max(table.headers.length, 1));
    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
    sheet.addRow(table.headers);
    sheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };

    for (const row of table.rows) {
      sheet.addRow(row);
    }

    sheet.views = [{ state: "frozen", ySplit: 2 }];
    sheet.columns = table.headers.map((header, index) => ({
      width: Math.min(52, Math.max(header.length + 3, ...table.rows.map((row) => row[index]?.length ?? 0), 12)),
    }));
  }

  return workbook.xlsx.writeBuffer();
}

function buildMultiTableCsv(tables: ExportTable[]) {
  return tables
    .flatMap((table) => [[table.title], table.headers, ...table.rows, []])
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
}

async function getBudgetExportContext(budgetId: string, userId: string) {
  const [budget, account, companies, settings] = await Promise.all([
    getBudgetById(budgetId, userId),
    getUserAccount(userId),
    getUserCompanies(userId),
    getUserSettings(userId),
  ]);

  if (!budget) {
    throw new Error("Presupuesto no encontrado");
  }

  const responsible: ReportResponsibleMeta = {
    companyName: companies[0]?.name ?? null,
    companyLogoUrl: companies[0]?.logoUrl ?? null,
    name: account.name,
    avatarUrl: account.avatarUrl,
    jobTitle: account.jobTitle,
    phone: account.phone,
  };

  return { budget, responsible, settings };
}

function buildBudgetCsv(budget: BudgetRecord, decimals: number) {
  const normalized = calculateBudgetRecord(budget);
  const rows = buildDisplayRows(normalized).map((row) => {
    if (row.kind === "level") {
      return [row.level.code, `${levelTypeLabel[row.level.type]}: ${row.level.name}`, "", "", "", ""];
    }

    return [
      row.item.code,
      row.item.description,
      row.item.unit,
      row.item.quantity.toFixed(decimals),
      row.item.unitPrice.toFixed(decimals),
      row.item.partial.toFixed(decimals),
    ];
  });

  rows.push(
    ["", "Costo directo", "", "", "", normalized.totals.totalDirectCost.toFixed(decimals)],
    ["", "Gastos generales", "", "", "", normalized.totals.totalGeneralExpenses.toFixed(decimals)],
    ["", "Utilidad", "", "", "", normalized.totals.totalUtility.toFixed(decimals)],
    ["", "IGV", "", "", "", normalized.totals.totalTax.toFixed(decimals)],
    ["", "Total", "", "", "", normalized.totals.totalAmount.toFixed(decimals)],
  );

  return buildCsvContent(["Codigo", "Descripcion", "Unidad", "Metrado", "Precio unitario", "Parcial"], rows);
}

function buildApuCsv(budget: BudgetRecord, decimals: number) {
  const normalized = calculateBudgetRecord(budget);
  const rows = normalized.items.flatMap((item) =>
    (item.apu?.resources ?? []).map((resource) => [
      item.code,
      item.description,
      resource.resource?.description ?? resource.resourceType,
      resource.resource?.unit ?? "",
      resource.crew != null ? String(resource.crew) : "",
      resource.quantity.toFixed(decimals),
      resource.unitPrice.toFixed(decimals),
      resource.subtotal.toFixed(decimals),
    ]),
  );

  return buildCsvContent(["Codigo partida", "Partida", "Insumo", "Unidad", "Cuadrilla", "Cantidad", "Precio", "Subtotal"], rows);
}

type WorkScheduleExportTable = {
  slug: string;
  title: string;
  headers: string[];
  rows: string[][];
  columnWidths?: number[];
  fontSize?: number;
  headerFontSize?: number;
  sectionRows?: number[];
  emphasisRows?: number[];
  hideHeader?: boolean;
  chart?: PdfExportTable["chart"];
};

function buildWorkScheduleTables(section: WorkScheduleViewRecord, decimals: number, dateFormat: string): Record<string, WorkScheduleExportTable> {
  const lines = section.groups.flatMap((group) => group.lines);
  const overviewRows: string[][] = [];
  const overviewSectionRows: number[] = [];
  let currentSubBudgetName = "";

  for (const line of lines) {
    if (line.subBudgetName !== currentSubBudgetName) {
      currentSubBudgetName = line.subBudgetName;
      overviewSectionRows.push(overviewRows.length);
      overviewRows.push([line.subBudgetName, "", "", "", "", "", "", "", "", ""]);
    }

    overviewRows.push(formatWorkScheduleOverviewRow(line, decimals, dateFormat));
  }

  return {
    overview: {
      slug: "cronograma-partidas",
      title: "Cronograma de partidas",
      headers: ["Codigo", "Descripcion", "Unidad", "Metrado", "PU", "Parcial", "Inicio", "Fin", "Duracion", "Predecesora"],
      columnWidths: [42, 164, 30, 44, 42, 48, 48, 48, 42, 55],
      fontSize: 5.9,
      headerFontSize: 6.1,
      sectionRows: overviewSectionRows,
      rows: overviewRows,
    },
    summary: buildWorkScheduleSummaryTable(lines, decimals),
    monthly: buildWorkScheduleMonthlyTable(section.valuationCalendar.rows, section.valuationCalendar.periods, decimals),
    valuation: buildWorkScheduleValuationTable(section.valuationCalendar.rows, section.valuationCalendar.periods, decimals),
    resources: buildWorkScheduleResourcesTable(section.resourceCalendar.rows, section.resourceCalendar.periods, decimals),
    curve: buildWorkScheduleCurveTable(section.curveSeries, decimals),
  };
}

function selectWorkScheduleTables(preset: ExportPreset, tables: Record<string, WorkScheduleExportTable>) {
  if (preset === "cronograma_ejecutivo") return [tables.summary, tables.monthly, tables.overview];
  if (preset === "calendario_valorizado") return [tables.valuation];
  if (preset === "calendario_insumos") return [tables.resources];
  if (preset === "curva_s") return [tables.curve];
  return [tables.overview];
}

function formatWorkScheduleOverviewRow(line: WorkScheduleLineRecord, decimals: number, dateFormat: string) {
  return [
    line.itemCode,
    line.description,
    line.unit,
    line.quantity.toFixed(decimals),
    line.unitPrice.toFixed(decimals),
    line.partial.toFixed(decimals),
    line.startDate ? formatDate(line.startDate, dateFormat as never) : "",
    line.endDate ? formatDate(line.endDate, dateFormat as never) : "",
    line.durationDays != null ? String(line.durationDays) : "",
    line.predecessor ?? "",
  ];
}

function buildWorkScheduleSummaryTable(lines: WorkScheduleLineRecord[], decimals: number): WorkScheduleExportTable {
  const rowsBySubBudget = new Map<string, { count: number; total: number; scheduled: number }>();
  for (const line of lines) {
    const current = rowsBySubBudget.get(line.subBudgetName) ?? { count: 0, total: 0, scheduled: 0 };
    current.count += 1;
    current.total += line.partial;
    current.scheduled += line.startDate && line.endDate ? 1 : 0;
    rowsBySubBudget.set(line.subBudgetName, current);
  }

  return {
    slug: "resumen-subpresupuesto",
    title: "Resumen por subpresupuesto",
    headers: ["Subpresupuesto", "Partidas", "Programadas", "Total"],
    columnWidths: [275, 70, 78, 100],
    fontSize: 7.4,
    headerFontSize: 7.5,
    rows: [...rowsBySubBudget.entries()].map(([name, row]) => [name, String(row.count), String(row.scheduled), row.total.toFixed(decimals)]),
  };
}

function buildWorkScheduleMonthlyTable(
  valuationRows: WorkScheduleValuationCalendarRow[],
  periods: WorkSchedulePeriodRecord[],
  decimals: number,
): WorkScheduleExportTable {
  let accumulated = 0;
  const total = periods.reduce((sum, period) => sum + valuationRows.reduce((periodSum, row) => periodSum + (row.periodAmounts[period.key] ?? 0), 0), 0);

  return {
    slug: "resumen-mensual",
    title: "Resumen mensual",
    headers: ["Periodo", "Partidas con monto", "Programado mensual", "Acumulado", "% acumulado"],
    columnWidths: [86, 92, 126, 126, 93],
    fontSize: 7.3,
    headerFontSize: 7.4,
    rows: periods.map((period) => {
      const monthlyRows = valuationRows.filter((row) => (row.periodAmounts[period.key] ?? 0) > 0);
      const monthly = monthlyRows.reduce((sum, row) => sum + (row.periodAmounts[period.key] ?? 0), 0);
      accumulated += monthly;
      return [formatPeriod(period), String(monthlyRows.length), monthly.toFixed(decimals), accumulated.toFixed(decimals), formatPercentage(total > 0 ? accumulated / total : 0)];
    }),
  };
}

function buildWorkScheduleValuationTable(
  valuationRows: WorkScheduleValuationCalendarRow[],
  periods: WorkSchedulePeriodRecord[],
  decimals: number,
): WorkScheduleExportTable {
  const periodHeaders = periods.map(formatPeriod);
  const rows: string[][] = [];
  const sectionRows: number[] = [];
  let currentSubBudgetName = "";

  for (const row of valuationRows) {
    if (row.subBudgetName !== currentSubBudgetName) {
      currentSubBudgetName = row.subBudgetName;
      sectionRows.push(rows.length);
      rows.push([row.subBudgetName, "", "", ...periods.map(() => ""), ""]);
    }

    rows.push([
      row.itemCode,
      row.description,
      row.partial.toFixed(decimals),
      ...periods.map((period) => (row.periodAmounts[period.key] ?? 0).toFixed(decimals)),
      row.rowTotal.toFixed(decimals),
    ]);
  }

  return {
    slug: "calendario-valorizado",
    title: "Calendario valorizado",
    headers: ["Codigo", "Descripcion", "Parcial", ...periodHeaders, "Total"],
    columnWidths: [42, 150, 50, ...periods.map(() => 46), 52],
    fontSize: periods.length > 8 ? 5.6 : 6.2,
    headerFontSize: periods.length > 8 ? 5.7 : 6.3,
    sectionRows,
    rows,
  };
}

function buildWorkScheduleResourcesTable(
  resourceRows: WorkScheduleResourceCalendarRow[],
  periods: WorkSchedulePeriodRecord[],
  decimals: number,
): WorkScheduleExportTable {
  return {
    slug: "calendario-insumos",
    title: "Calendario de insumos",
    headers: ["Codigo", "Insumo", "Unidad", "Cantidad", "Precio", "Parcial", ...periods.map(formatPeriod)],
    columnWidths: [42, 142, 32, 48, 46, 48, ...periods.map(() => 45)],
    fontSize: periods.length > 8 ? 5.5 : 6.1,
    headerFontSize: periods.length > 8 ? 5.6 : 6.2,
    rows: resourceRows.map((row) => [
      row.code,
      row.description,
      row.unit,
      row.quantity.toFixed(decimals),
      row.unitPrice.toFixed(decimals),
      row.partial.toFixed(decimals),
      ...periods.map((period) => (row.periodAmounts[period.key] ?? 0).toFixed(decimals)),
    ]),
  };
}

function buildWorkScheduleCurveTable(curveRows: WorkScheduleCurvePointRecord[], decimals: number): WorkScheduleExportTable {
  return {
    slug: "curva-s",
    title: "Curva S",
    headers: ["Periodo", "Programado mensual", "Acumulado", "% acumulado"],
    columnWidths: [100, 150, 150, 123],
    fontSize: 7.5,
    headerFontSize: 7.6,
    rows: curveRows.map((row) => [
      formatPeriod(row),
      row.monthlyAmount.toFixed(decimals),
      row.accumulatedAmount.toFixed(decimals),
      formatPercentage(row.accumulatedPercentage / 100),
    ]),
  };
}

async function buildWorkScheduleWorkbook(tables: WorkScheduleExportTable[]) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MYC Presupuestos";

  for (const table of tables) {
    const sheet = workbook.addWorksheet(table.title.slice(0, 31));
    sheet.addRow([table.title]);
    sheet.mergeCells(1, 1, 1, Math.max(table.headers.length, 1));
    sheet.getRow(1).font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
    sheet.addRow(table.headers);
    sheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    for (const row of table.rows) {
      sheet.addRow(row);
    }
    sheet.views = [{ state: "frozen", ySplit: 2 }];
    sheet.autoFilter = { from: { row: 2, column: 1 }, to: { row: 2, column: table.headers.length } };
    sheet.columns = table.headers.map((header, index) => ({
      width: Math.max(header.length + 3, ...table.rows.map((row) => row[index]?.length ?? 0), 12),
    }));
  }

  return workbook.xlsx.writeBuffer();
}

function buildCsvContent(headers: string[], rows: string[][]) {
  return [headers, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n");
}

function escapeCsvValue(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function normalizeCurrencyDecimals(value: number) {
  if (!Number.isFinite(value)) return 2;
  const normalized = Math.trunc(value);
  if (normalized < 0) return 0;
  if (normalized > 4) return 4;
  return normalized;
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]/g, "-");
}

function formatPeriod(period: { year: number; month: number }) {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

function formatPercentage(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function normalizeZipContent(content: ZipInput["content"]) {
  if (typeof content === "string") return Buffer.from(content, "utf8");
  if (Buffer.isBuffer(content)) return content;
  if (content instanceof ArrayBuffer) return Buffer.from(content);
  return Buffer.from(content);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});
