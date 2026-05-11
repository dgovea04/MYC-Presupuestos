import ExcelJS from "exceljs";

type CodeNameRow = {
  code: string;
  name: string;
};

type DictionaryRow = {
  code: string;
  element: string;
  note: string | null;
};

type UnifiedIndexSourceRow = {
  code: string;
  name: string;
  geographicArea: string;
  month: number;
  year: number;
  value: string;
  sourceSheet: string;
};

type UnifiedIndexWorkbookSource = {
  monthSheets: string[];
  baseSheets: string[];
  codeNameRows: CodeNameRow[];
  dictionaryEntries: DictionaryRow[];
  baseRows: UnifiedIndexSourceRow[];
  indexRows: UnifiedIndexSourceRow[];
};

const MONTH_SHEET_PATTERN =
  /^(ene|feb|mar|abr|may|jun|jul|ago|set|sep|oct|nov|dic)_\d{4}$/i;
const BASE_SHEET_PATTERN = /\(base .*?= ?100\)/i;
const SPANISH_MONTHS = new Map<string, number>([
  ["ene", 1],
  ["feb", 2],
  ["mar", 3],
  ["abr", 4],
  ["may", 5],
  ["jun", 6],
  ["jul", 7],
  ["ago", 8],
  ["set", 9],
  ["sep", 9],
  ["oct", 10],
  ["nov", 11],
  ["dic", 12],
]);

const normalizeHeader = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const cleanText = (value: string): string => value.replace(/\s+/g, " ").trim();

const isCode = (value: string): boolean => /^\d+(?:-\d+)?$/.test(value);

const isNumericValue = (value: string): boolean => /^\d+(?:\.\d+)?$/.test(value);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const getCellText = (cell: ExcelJS.Cell): string => {
  try {
    const cellText = cleanText(cell.text);
    if (cellText) {
      return cellText;
    }
  } catch {
    // Merged cells in this workbook can expose null-backed text values.
  }

  const { value } = cell;

  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return cleanText(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return cleanText(String(value));
  }

  if (value instanceof Date) {
    return cleanText(value.toISOString());
  }

  if (isObjectRecord(value)) {
    const maybeText = value.text;
    if (typeof maybeText === "string") {
      return cleanText(maybeText);
    }

    const maybeResult = value.result;
    if (
      typeof maybeResult === "string" ||
      typeof maybeResult === "number" ||
      typeof maybeResult === "boolean"
    ) {
      return cleanText(String(maybeResult));
    }

    const maybeRichText = value.richText;
    if (Array.isArray(maybeRichText)) {
      return cleanText(
        maybeRichText
          .map((segment) =>
            isObjectRecord(segment) && typeof segment.text === "string"
              ? segment.text
              : "",
          )
          .join(""),
      );
    }
  }

  return cleanText(String(value));
};

const findWorksheet = (
  workbook: ExcelJS.Workbook,
  matcher: (normalizedName: string) => boolean,
): ExcelJS.Worksheet => {
  const worksheet = workbook.worksheets.find((sheet) =>
    matcher(normalizeHeader(sheet.name)),
  );

  if (!worksheet) {
    throw new Error("Required workbook sheet was not found");
  }

  return worksheet;
};

const findHeaderRow = (
  worksheet: ExcelJS.Worksheet,
  matcher: (cells: string[]) => boolean,
): number => {
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const cells = Array.from({ length: worksheet.columnCount }, (_, index) =>
      getCellText(worksheet.getRow(rowNumber).getCell(index + 1)),
    );

    if (matcher(cells)) {
      return rowNumber;
    }
  }

  throw new Error(`Header row not found in sheet "${worksheet.name}"`);
};

const parseCodeNameRows = (worksheet: ExcelJS.Worksheet): CodeNameRow[] => {
  const headerRowNumber = findHeaderRow(worksheet, (cells) => {
    const normalizedCells = cells.map(normalizeHeader);

    return (
      normalizedCells[0] === "codigo" &&
      normalizedCells[1] === "elemento" &&
      normalizedCells[2] === "codigo" &&
      normalizedCells[3] === "elemento"
    );
  });

  const rows: CodeNameRow[] = [];

  for (
    let rowNumber = headerRowNumber + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const leftCode = getCellText(row.getCell(1));
    const leftName = getCellText(row.getCell(2));
    const rightCode = getCellText(row.getCell(3));
    const rightName = getCellText(row.getCell(4));

    if (normalizeHeader(leftCode) === "notas:") {
      break;
    }

    if (isCode(leftCode) && leftName) {
      rows.push({ code: leftCode, name: leftName });
    }

    if (isCode(rightCode) && rightName) {
      rows.push({ code: rightCode, name: rightName });
    }
  }

  return rows;
};

const parseDictionaryRows = (worksheet: ExcelJS.Worksheet): DictionaryRow[] => {
  const headerRowNumber = findHeaderRow(worksheet, (cells) => {
    const normalizedCells = cells.map(normalizeHeader);

    return (
      normalizedCells[1] === "elemento" &&
      normalizedCells[3] === "iupc" &&
      normalizedCells[5] === "elemento" &&
      normalizedCells[7] === "iupc"
    );
  });

  const rows: DictionaryRow[] = [];

  const pushDictionaryRow = (element: string, note: string, code: string) => {
    if (!element || !isCode(code)) {
      return;
    }

    rows.push({
      code,
      element,
      note: note || null,
    });
  };

  for (
    let rowNumber = headerRowNumber + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const leftElement = getCellText(row.getCell(2));
    const leftNote = getCellText(row.getCell(3));
    const leftCode = getCellText(row.getCell(4));
    const rightElement = getCellText(row.getCell(6));
    const rightNote = getCellText(row.getCell(7));
    const rightCode = getCellText(row.getCell(8));

    if (normalizeHeader(leftElement) === "notas:") {
      break;
    }

    pushDictionaryRow(leftElement, leftNote, leftCode);
    pushDictionaryRow(rightElement, rightNote, rightCode);
  }

  return rows;
};

const parseMonthYearFromSheetName = (sheetName: string): {
  month: number;
  year: number;
} => {
  const match = sheetName.match(/^([A-Za-z]+)_(\d{4})$/);

  if (!match) {
    throw new Error(`Cannot parse month/year from sheet "${sheetName}"`);
  }

  const [, monthToken, yearToken] = match;
  const month = SPANISH_MONTHS.get(monthToken.toLowerCase());

  if (!month) {
    throw new Error(`Unsupported month token "${monthToken}"`);
  }

  return {
    month,
    year: Number(yearToken),
  };
};

const parseBaseMonthYearFromSheetName = (sheetName: string): {
  month: number;
  year: number;
} => {
  const match = sheetName.match(/(ene|feb|mar|abr|may|jun|jul|ago|set|sep|oct|nov|dic)[._ ]?(\d{2,4})/i);

  if (!match) {
    throw new Error(`Cannot parse base month/year from sheet "${sheetName}"`);
  }

  const [, monthToken, yearToken] = match;
  const month = SPANISH_MONTHS.get(monthToken.toLowerCase());

  if (!month) {
    throw new Error(`Unsupported month token "${monthToken}"`);
  }

  return {
    month,
    year: yearToken.length === 2 ? Number(`20${yearToken}`) : Number(yearToken),
  };
};

const parseIndexRows = (
  worksheet: ExcelJS.Worksheet,
  codeNameRows: CodeNameRow[],
  sheetDate: {
    month: number;
    year: number;
  },
): UnifiedIndexSourceRow[] => {
  const headerRowNumber = findHeaderRow(worksheet, (cells) => {
    const normalizedCells = cells.map(normalizeHeader);
    const areaLabels = normalizedCells.slice(1).filter(Boolean);

    return (
      normalizedCells[0] === "cod." &&
      areaLabels.length > 0 &&
      areaLabels.every((value, index) => value === String(index + 1))
    );
  });

  const { month, year } = sheetDate;
  const nameByCode = new Map(codeNameRows.map((row) => [row.code, row.name]));
  const geographicAreas = Array.from(
    { length: worksheet.columnCount - 1 },
    (_, index) => {
      const columnNumber = index + 2;
      const geographicArea = getCellText(
        worksheet.getRow(headerRowNumber).getCell(columnNumber),
      );

      return geographicArea ? { columnNumber, geographicArea } : null;
    },
  ).filter(
    (
      area,
    ): area is {
      columnNumber: number;
      geographicArea: string;
    } => area !== null,
  );
  const rows: UnifiedIndexSourceRow[] = [];

  for (
    let rowNumber = headerRowNumber + 1;
    rowNumber <= worksheet.rowCount;
    rowNumber += 1
  ) {
    const row = worksheet.getRow(rowNumber);
    const code = getCellText(row.getCell(1));

    if (!isCode(code)) {
      continue;
    }

    const name = nameByCode.get(code);
    if (!name) {
      throw new Error(`Missing code/name mapping for unified index "${code}"`);
    }

    geographicAreas.forEach(({ geographicArea, columnNumber }) => {
      const rawValue = getCellText(row.getCell(columnNumber));

      if (!isNumericValue(rawValue)) {
        return;
      }

      rows.push({
        code,
        name,
        geographicArea,
        month,
        year,
        value: rawValue,
        sourceSheet: worksheet.name,
      });
    });
  }

  return rows;
};

export const parseUnifiedIndexWorkbook = (
  workbook: ExcelJS.Workbook,
): UnifiedIndexWorkbookSource => {
  const monthSheets = workbook.worksheets
    .map((sheet) => sheet.name)
    .filter((sheetName) => MONTH_SHEET_PATTERN.test(sheetName));

  const baseSheets = workbook.worksheets
    .map((sheet) => sheet.name)
    .filter((sheetName) => BASE_SHEET_PATTERN.test(sheetName));

  const codeNameSheet = findWorksheet(
    workbook,
    (sheetName) => sheetName === "relacion indices base dic 2025",
  );
  const dictionarySheet = findWorksheet(
    workbook,
    (sheetName) => sheetName === "diccionario alfabetico",
  );
  const codeNameRows = parseCodeNameRows(codeNameSheet);
  const dictionaryEntries = parseDictionaryRows(dictionarySheet);
  const baseRows = baseSheets.flatMap((sheetName) => {
    const baseSheet = workbook.getWorksheet(sheetName);

    if (!baseSheet) {
      throw new Error(`Base sheet "${sheetName}" was not found`);
    }

    return parseIndexRows(
      baseSheet,
      codeNameRows,
      parseBaseMonthYearFromSheetName(sheetName),
    );
  });
  const indexRows = monthSheets.flatMap((sheetName) => {
    const monthSheet = workbook.getWorksheet(sheetName);

    if (!monthSheet) {
      throw new Error(`Month sheet "${sheetName}" was not found`);
    }

    return parseIndexRows(
      monthSheet,
      codeNameRows,
      parseMonthYearFromSheetName(sheetName),
    );
  });

  return {
    monthSheets,
    baseSheets,
    codeNameRows,
    dictionaryEntries,
    baseRows,
    indexRows,
  };
};

export const loadUnifiedIndexWorkbook = async (
  workbookPath: string,
): Promise<UnifiedIndexWorkbookSource> => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  return parseUnifiedIndexWorkbook(workbook);
};

export type {
  CodeNameRow,
  DictionaryRow,
  UnifiedIndexSourceRow,
  UnifiedIndexWorkbookSource,
};
