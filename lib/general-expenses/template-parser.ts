import ExcelJS from "exceljs";
import type {
  GeneralExpenseGroupKind,
  GeneralExpenseItemCategory,
  GeneralExpenseGroupRecord,
  GeneralExpenseTitleRecord,
} from "@/lib/general-expenses/types";

type ParsedTemplateGroup = GeneralExpenseGroupRecord & {
  code: string;
  titles: Array<GeneralExpenseTitleRecord>;
};

type ParsedTemplateTitle = GeneralExpenseTitleRecord;

export async function parseGeneralExpensesTemplate(filePath: string): Promise<{
  groups: ParsedTemplateGroup[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const worksheet = workbook.getWorksheet("Gastos Generales") ?? workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("No se encontro la hoja de gastos generales en la plantilla");
  }

  const groups: ParsedTemplateGroup[] = [];
  let currentGroup: ParsedTemplateGroup | null = null;
  let currentTitle: ParsedTemplateTitle | null = null;

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const rawCode = normalizeCode(row.getCell(1).text);
    const description = normalizeText(row.getCell(2).text);

    if (!rawCode || !description) {
      continue;
    }

    if (/^\d+$/.test(rawCode)) {
      currentGroup = {
        id: `template-group-${rawCode}`,
        budgetId: undefined,
        code: rawCode,
        name: description,
        kind: inferGroupKind(description),
        sortOrder: groups.length,
        titles: [],
      };
      currentTitle = null;
      groups.push(currentGroup);
      continue;
    }

    if (/^\d+\.\d+$/.test(rawCode)) {
      if (!currentGroup) {
        continue;
      }

      currentTitle = {
        id: `template-title-${rawCode}`,
        groupId: currentGroup.id,
        code: rawCode,
        name: description,
        category: inferTitleCategory(description),
        sortOrder: currentGroup.titles.length,
        items: [],
      };
      currentGroup.titles.push(currentTitle);
      continue;
    }

    if (/^\d+\.\d+\.\d+$/.test(rawCode)) {
      if (!currentGroup || !currentTitle) {
        continue;
      }

      currentTitle.items.push({
        id: `template-item-${rawCode}`,
        titleId: currentTitle.id,
        code: rawCode,
        description,
        category: inferItemCategory(description, currentTitle.name),
        unit: normalizeText(row.getCell(3).text) || "UND",
        quantityDescription: normalizeText(row.getCell(4).text) || "-",
        quantity: normalizeNumber(row.getCell(5).value),
        participationPercentage: normalizePercentage(row.getCell(6).value),
        unitPrice: normalizeNumber(row.getCell(7).value),
        sortOrder: currentTitle.items.length,
      });
    }
  }

  return {
    groups,
  };
}

function inferGroupKind(description: string): GeneralExpenseGroupKind {
  return description.includes("VARIABLE") ? "VARIABLE" : "FIXED";
}

function inferItemCategory(description: string, titleName: string): GeneralExpenseItemCategory {
  const normalizedDescription = stripAccents(description);
  const normalizedTitle = stripAccents(titleName);
  const source = `${normalizedTitle} ${normalizedDescription}`;

  if (source.includes("GASTOS FINANCIEROS") || source.includes("TRIBUTOS") || source.includes("SEGUROS")) {
    return "DIRECT_COST_BASED";
  }

  if (source.includes("PERSONAL")) {
    return "PERSONAL";
  }

  if (source.includes("ENSAYO")) {
    return "TESTING";
  }

  return "STANDARD";
}

function inferTitleCategory(titleName: string): GeneralExpenseItemCategory {
  const normalizedTitle = stripAccents(titleName);

  if (normalizedTitle.includes("PERSONAL")) {
    return "PERSONAL";
  }

  if (normalizedTitle.includes("ENSAYO")) {
    return "TESTING";
  }

  if (
    normalizedTitle.includes("GASTOS FINANCIEROS") ||
    normalizedTitle.includes("TRIBUTOS") ||
    normalizedTitle.includes("SEGUROS")
  ) {
    return "DIRECT_COST_BASED";
  }

  return "STANDARD";
}

function normalizeCode(value: string) {
  return value.trim();
}

function normalizeText(value: string) {
  return stripAccents(value).replace(/\s+/g, " ").trim();
}

function normalizeNumber(value: ExcelJS.CellValue) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "" || trimmed === "-") return 0;
    const normalized = trimmed.replace(/,/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object" && "result" in value) {
    return normalizeNumber(value.result ?? 0);
  }

  return 0;
}

function normalizePercentage(value: ExcelJS.CellValue) {
  return normalizeNumber(value);
}

function stripAccents(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\u00A0/g, " ")
    .toUpperCase();
}
