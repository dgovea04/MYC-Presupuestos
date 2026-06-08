import Decimal from "decimal.js";
import ExcelJS from "exceljs";
import type {
  S10ApuDetalleRow,
  S10BudgetLevelRow,
  S10ExportSnapshot,
  S10PartidaRow,
  S10PieSubpresupuestoRow,
  S10ResultadoPieSubpresupuestoRow,
  S10SubpresupuestoDetalleRow,
} from "@/lib/s10/import-mapper";

type Rw7WorkbookInput = {
  buffer: Buffer;
  fileName?: string;
};

type Rw7Resource = {
  code: string;
  iu?: string | null;
  type?: string | null;
  description: string;
  unit: string;
  unitPrice: number;
};

type Rw7ApuHeader = {
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  performance: number;
};

type Rw7BudgetLevel = {
  subpresupuestoCode: string;
  code: string;
  description: string;
  depth: number;
  parentCode: string | null;
  sortOrder: number;
};

type Rw7BudgetItem = {
  subpresupuestoCode: string;
  item: string;
  partidaCode: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  partial: number;
  levelCode: string | null;
};

type Rw7BudgetStructure = {
  subpresupuestos: Rw7Subbudget[];
  levels: Rw7BudgetLevel[];
  items: Rw7BudgetItem[];
};

type Rw7Subbudget = {
  code: string;
  description: string;
  sortOrder: number;
};

type Rw7ParsedLevel = {
  code: string;
  description: string;
  depth: number;
};

const presupuestoCode = "RW7";
const subpresupuestoCode = "001";
const moneyDecimals = 4;
const rateDecimals = 4;

export async function parseRw7WorkbookToS10Snapshot(input: Rw7WorkbookInput): Promise<S10ExportSnapshot> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(input.buffer);

  const budgetSheet = getRequiredWorksheet(workbook, "Pto");
  const apuSheet = getRequiredWorksheet(workbook, "ApuB");
  const resourceSheet = getRequiredWorksheet(workbook, "InsB");
  const dataSheet = workbook.getWorksheet("Datos");
  const projectName = readProjectName(budgetSheet, dataSheet, input.fileName);
  const currency = readCurrency(dataSheet);
  const budgetStructure = readBudgetStructure(budgetSheet);
  const budgetRows = budgetStructure.items;
  const resourcesByCode = readResourceRows(resourceSheet);
  const apuHeadersByCode = readApuHeaders(apuSheet);
  const apuDetalles = readApuDetails(apuSheet, resourcesByCode);
  const partidas = budgetRows.map((row): S10PartidaRow => {
    const apuHeader = apuHeadersByCode.get(row.partidaCode);

    return {
      CodPresupuesto: presupuestoCode,
      CodSubpresupuesto: row.subpresupuestoCode,
      CodPartida: row.partidaCode,
      Descripcion: row.description,
      CodUnidad: row.unit || apuHeader?.unit,
      Precio1: row.unitPrice,
      RendimientoMO: apuHeader?.performance,
      RendimientoEQ: 0,
    };
  });
  const subpresupuestoDetalles = budgetRows.map((row, index): S10SubpresupuestoDetalleRow => ({
    CodPresupuesto: presupuestoCode,
    CodSubpresupuesto: row.subpresupuestoCode,
    Tipo: 1,
    Item: row.item,
    Orden: row.item,
    Secuencial: index + 1,
    Descripcion: row.description,
    Unidad: row.unit,
    Metrado: row.quantity,
    MetradoBase: row.quantity,
    Precio1: row.unitPrice,
    Parcial1: row.partial,
    Nivel: row.item.split(".").length,
    CodPartida: row.partidaCode,
    CodPresupuestoPartida: presupuestoCode,
    PropioPartida: "01",
    LevelCode: row.levelCode,
  }));
  const budgetLevels = budgetStructure.levels.map((row): S10BudgetLevelRow => ({
    CodPresupuesto: presupuestoCode,
    CodSubpresupuesto: row.subpresupuestoCode,
    Codigo: row.code,
    Descripcion: row.description,
    Nivel: row.depth,
    Tipo: row.depth <= 1 ? "TITLE" : "SUBTITLE",
    ParentCodigo: row.parentCode,
    Orden: row.code,
    SortOrder: row.sortOrder,
  }));
  const footer = readFooterRows(budgetSheet);
  const total = footer.resultadoRows.find((row) => normalizeText(row.Descripcion).includes("TOTAL"))?.Valor1;
  const directCost = footer.resultadoRows.find((row) => classifyFooterVariable(row.Descripcion) === "CD")?.Valor1;

  return {
    presupuestos: [
      {
        CodPresupuesto: presupuestoCode,
        Descripcion: projectName,
        Moneda: currency,
        CostoOferta1: total ?? directCost ?? sumBudgetRows(budgetRows),
      },
    ],
    subpresupuestos: [
      ...budgetStructure.subpresupuestos.map((row) => ({
        CodPresupuesto: presupuestoCode,
        CodSubpresupuesto: row.code,
        Descripcion: row.description,
      })),
    ],
    partidas,
    budgetLevels,
    subpresupuestoDetalles,
    apuDetalles: expandApuDetailsBySubbudget(apuDetalles, budgetRows),
    pieSubpresupuestos: footer.pieRows,
    resultadoPieSubpresupuestos: footer.resultadoRows,
  };
}

function getRequiredWorksheet(workbook: ExcelJS.Workbook, name: string) {
  const worksheet = workbook.getWorksheet(name);
  if (!worksheet) {
    throw new Error(`El archivo RW7 no contiene la hoja ${name}.`);
  }

  return worksheet;
}

function readBudgetStructure(worksheet: ExcelJS.Worksheet): Rw7BudgetStructure {
  const headerRowNumber = findRow(
    worksheet,
    (rowNumber) => normalizeText(readString(worksheet, rowNumber, 9)) === "CODIGO" && normalizeText(readString(worksheet, rowNumber, 10)) === "ITEM",
  );
  if (headerRowNumber == null) {
    throw new Error("No se encontro la tabla de partidas en la hoja Pto.");
  }

  const items: Rw7BudgetItem[] = [];
  const subpresupuestos: Rw7Subbudget[] = [];
  const levels: Rw7BudgetLevel[] = [];
  const levelCodes = new Set<string>();
  const currentLevelByDepth = new Map<number, Rw7BudgetLevel>();
  let currentSubbudget: Rw7Subbudget | null = null;

  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const footerLabel = normalizeText(readString(worksheet, rowNumber, 3));
    if (footerLabel.includes("COSTO DIRECTO")) {
      break;
    }

    const marker = readString(worksheet, rowNumber, 9);
    const item = readString(worksheet, rowNumber, 10);
    const titleDescription = readOptionalString(worksheet, rowNumber, 11) ?? stripLeadingItem(readString(worksheet, rowNumber, 2), item);
    const subbudget = parseSubbudgetRow(marker, item, titleDescription);
    if (subbudget) {
      currentSubbudget = {
        ...subbudget,
        sortOrder: subpresupuestos.length + 1,
      };
      subpresupuestos.push(currentSubbudget);
      currentLevelByDepth.clear();
      continue;
    }

    const titleLevel = parseBudgetLevelRow(marker, item, titleDescription);
    if (titleLevel && currentSubbudget) {
      const parentLevel = findParentLevel(currentLevelByDepth, titleLevel.depth);
      const level: Rw7BudgetLevel = {
        subpresupuestoCode: currentSubbudget.code,
        ...titleLevel,
        parentCode: parentLevel?.code ?? null,
        sortOrder: levels.length + 1,
      };
      const levelKey = `${level.subpresupuestoCode}:${level.code}`;

      if (!levelCodes.has(levelKey)) {
        levels.push(level);
        levelCodes.add(levelKey);
      }

      currentLevelByDepth.set(level.depth, level);
      pruneDeeperLevels(currentLevelByDepth, level.depth);
      continue;
    }

    const partidaCode = readOptionalCode(worksheet, rowNumber, 9);
    const unit = readString(worksheet, rowNumber, 4);
    const description = stripLeadingItem(readString(worksheet, rowNumber, 2), item);
    const quantity = readNumber(worksheet, rowNumber, 5);
    const unitPrice = readNumber(worksheet, rowNumber, 6);
    const partial = readNumber(worksheet, rowNumber, 7);

    if (!partidaCode || !item || !description || !unit) {
      continue;
    }

    const itemSubbudget = currentSubbudget ?? createFallbackSubbudget(projectNameFallback(worksheet), subpresupuestos);
    if (!currentSubbudget) {
      currentSubbudget = itemSubbudget;
      subpresupuestos.push(currentSubbudget);
    }

    items.push({
      subpresupuestoCode: itemSubbudget.code,
      item,
      partidaCode,
      description,
      unit,
      quantity: roundRate(quantity),
      unitPrice: roundMoney(unitPrice),
      partial: roundMoney(partial),
      levelCode: findItemLevel(currentLevelByDepth, item)?.code ?? null,
    });
  }

  if (items.length === 0) {
    throw new Error("No se encontraron partidas importables en la hoja Pto.");
  }

  return { subpresupuestos, levels, items };
}

function parseSubbudgetRow(marker: string, item: string, description: string): Omit<Rw7Subbudget, "sortOrder"> | null {
  const normalizedMarker = normalizeText(marker);
  if (normalizedMarker !== "T") {
    return null;
  }

  if (!item || !description) {
    return null;
  }

  return {
    code: item,
    description,
  };
}

function parseBudgetLevelRow(marker: string, item: string, description: string): Rw7ParsedLevel | null {
  const normalizedMarker = normalizeText(marker);
  if (normalizedMarker !== "ST1" && normalizedMarker !== "ST2") {
    return null;
  }

  if (!item || !description) {
    return null;
  }

  return {
    code: item,
    description,
    depth: normalizedMarker === "ST1" ? 1 : 2,
  };
}

function createFallbackSubbudget(description: string, subpresupuestos: Rw7Subbudget[]): Rw7Subbudget {
  return {
    code: subpresupuestoCode,
    description,
    sortOrder: subpresupuestos.length + 1,
  };
}

function projectNameFallback(worksheet: ExcelJS.Worksheet) {
  return readString(worksheet, 3, 3) || "Presupuesto RW7";
}

function expandApuDetailsBySubbudget(apuDetalles: S10ApuDetalleRow[], budgetRows: Rw7BudgetItem[]) {
  const subbudgetCodesByPartida = new Map<string, Set<string>>();

  for (const row of budgetRows) {
    const subbudgetCodes = subbudgetCodesByPartida.get(row.partidaCode) ?? new Set<string>();
    subbudgetCodes.add(row.subpresupuestoCode);
    subbudgetCodesByPartida.set(row.partidaCode, subbudgetCodes);
  }

  return apuDetalles.flatMap((detalle) => {
    const subbudgetCodes = subbudgetCodesByPartida.get(detalle.CodPartida);
    if (!subbudgetCodes || subbudgetCodes.size === 0) {
      return [detalle];
    }

    return Array.from(subbudgetCodes).map((subbudgetCode) => ({
      ...detalle,
      CodSubpresupuesto: subbudgetCode,
    }));
  });
}

function findParentLevel(levelsByDepth: Map<number, Rw7BudgetLevel>, depth: number) {
  for (let parentDepth = depth - 1; parentDepth >= 1; parentDepth -= 1) {
    const parent = levelsByDepth.get(parentDepth);
    if (parent) {
      return parent;
    }
  }

  return null;
}

function findItemLevel(levelsByDepth: Map<number, Rw7BudgetLevel>, item: string) {
  const itemDepth = item.split(".").filter(Boolean).length;
  return findParentLevel(levelsByDepth, itemDepth);
}

function pruneDeeperLevels(levelsByDepth: Map<number, Rw7BudgetLevel>, depth: number) {
  for (const levelDepth of Array.from(levelsByDepth.keys())) {
    if (levelDepth > depth) {
      levelsByDepth.delete(levelDepth);
    }
  }
}

function readResourceRows(worksheet: ExcelJS.Worksheet) {
  const resources = new Map<string, Rw7Resource>();
  const headerRowNumber = findRow(worksheet, (rowNumber) => normalizeText(readString(worksheet, rowNumber, 1)) === "COD.");
  const startRow = (headerRowNumber ?? 15) + 1;

  for (let rowNumber = startRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const code = readOptionalCode(worksheet, rowNumber, 1);
    const description = readString(worksheet, rowNumber, 4);
    const unit = readString(worksheet, rowNumber, 5);
    if (!code || !description || !unit) {
      continue;
    }

    resources.set(code, {
      code,
      iu: readOptionalCode(worksheet, rowNumber, 2),
      type: readOptionalString(worksheet, rowNumber, 3),
      description,
      unit,
      unitPrice: roundMoney(readNumber(worksheet, rowNumber, 6)),
    });
  }

  return resources;
}

function readApuHeaders(worksheet: ExcelJS.Worksheet) {
  const headers = new Map<string, Rw7ApuHeader>();

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const code = readOptionalCode(worksheet, rowNumber, 1);
    const description = readString(worksheet, rowNumber, 2);
    const unit = readString(worksheet, rowNumber, 4);
    if (!code || !description || !unit) {
      continue;
    }

    headers.set(code, {
      code,
      description,
      unit,
      unitPrice: roundMoney(readNumber(worksheet, rowNumber, 5)),
      performance: roundRate(readNumber(worksheet, rowNumber, 3) || readNumber(worksheet, rowNumber, 10) || 1),
    });
  }

  return headers;
}

function readApuDetails(worksheet: ExcelJS.Worksheet, resourcesByCode: Map<string, Rw7Resource>) {
  const details: S10ApuDetalleRow[] = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount - 3; rowNumber += 1) {
    const partidaCode = readOptionalCode(worksheet, rowNumber, 1);
    const partidaDescription = readString(worksheet, rowNumber, 2);
    const partidaUnit = readString(worksheet, rowNumber, 4);
    if (!partidaCode || !partidaDescription || !partidaUnit) {
      continue;
    }

    const resourceStartColumn = 15;
    for (let columnNumber = resourceStartColumn; columnNumber <= worksheet.actualColumnCount; columnNumber += 1) {
      const resourceCode = readOptionalCode(worksheet, rowNumber, columnNumber);
      if (!resourceCode) {
        continue;
      }

      const resource = resourcesByCode.get(resourceCode);
      const rawQuantity = readNumber(worksheet, rowNumber + 1, columnNumber);
      const sourceUnitPrice = readNumber(worksheet, rowNumber + 2, columnNumber);
      const partial = readNumber(worksheet, rowNumber + 3, columnNumber);
      const unit = normalizeRw7Unit(resource?.unit ?? "");
      const quantity = resolveApuQuantity(rawQuantity, sourceUnitPrice, partial, unit);

      details.push({
        CodPresupuesto: presupuestoCode,
        CodSubpresupuesto: subpresupuestoCode,
        CodPartida: partidaCode,
        CodPresupuestoPartida: presupuestoCode,
        PropioPartida: "01",
        CodInsumo: resourceCode,
        Descripcion: resource?.description ?? `Insumo RW7 ${resourceCode}`,
        CodUnidad: unit,
        CodIndiceUnificado: resource?.iu ?? null,
        Cantidad: quantity,
        Precio1: resolveApuUnitPrice(quantity, sourceUnitPrice, partial, unit),
        Parcial1: roundMoney(partial),
        Tipo: mapRw7ResourceType(resource, resourceCode),
      });
    }
  }

  return details;
}

function resolveApuQuantity(rawQuantity: number, unitPrice: number, partial: number, unit: string) {
  if (normalizeText(unit).startsWith("%") || unitPrice === 0) {
    return roundRate(rawQuantity);
  }

  const rawSubtotal = new Decimal(rawQuantity).times(unitPrice);
  if (rawSubtotal.minus(partial).abs().lessThanOrEqualTo(0.01)) {
    return roundRate(rawQuantity);
  }

  return roundRate(new Decimal(partial).dividedBy(unitPrice));
}

function resolveApuUnitPrice(quantity: number, sourceUnitPrice: number, partial: number, unit: string) {
  if (normalizeText(unit).startsWith("%") || quantity === 0) {
    return roundMoney(sourceUnitPrice);
  }

  const subtotal = new Decimal(quantity).times(sourceUnitPrice);
  if (subtotal.minus(partial).abs().lessThanOrEqualTo(0.01)) {
    return roundMoney(sourceUnitPrice);
  }

  return roundRate(new Decimal(partial).dividedBy(quantity));
}

function readFooterRows(worksheet: ExcelJS.Worksheet): {
  pieRows: S10PieSubpresupuestoRow[];
  resultadoRows: S10ResultadoPieSubpresupuestoRow[];
} {
  const directCostRow = findRow(worksheet, (rowNumber) => normalizeText(readString(worksheet, rowNumber, 3)).includes("COSTO DIRECTO"));
  if (directCostRow == null) {
    return { pieRows: [], resultadoRows: [] };
  }

  const pieRows: S10PieSubpresupuestoRow[] = [];
  const resultadoRows: S10ResultadoPieSubpresupuestoRow[] = [];

  for (let rowNumber = directCostRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const description = readString(worksheet, rowNumber, 3);
    const value = readNumber(worksheet, rowNumber, 7);
    if (!description || value === 0 && !normalizeText(description).includes("COSTO DIRECTO")) {
      continue;
    }

    const line = String(pieRows.length + 1).padStart(2, "0");
    const variable = classifyFooterVariable(description);
    pieRows.push({
      CodPresupuesto: presupuestoCode,
      CodSubpresupuesto: subpresupuestoCode,
      Linea: line,
      Descripcion: description,
      Variable: variable,
      Formula: variable,
      Omitido: false,
    });
    resultadoRows.push({
      CodPresupuesto: presupuestoCode,
      CodSubpresupuesto: subpresupuestoCode,
      Linea: line,
      Descripcion: description,
      Formula: variable,
      Valor1: roundMoney(value),
      Valor2: roundMoney(value),
      ValorConFactor: roundMoney(value),
    });

    if (normalizeText(description) === "TOTAL") {
      break;
    }
  }

  return { pieRows, resultadoRows };
}

function readProjectName(budgetSheet: ExcelJS.Worksheet, dataSheet: ExcelJS.Worksheet | undefined, fileName: string | undefined) {
  const candidates = [
    readString(budgetSheet, 3, 3),
    dataSheet ? readString(dataSheet, 2, 3) : "",
    fileName ? cleanFileName(fileName) : "",
    "Presupuesto RW7",
  ];

  return candidates.find((candidate) => candidate.trim().length > 0) ?? "Presupuesto RW7";
}

function readCurrency(dataSheet: ExcelJS.Worksheet | undefined) {
  const value = dataSheet ? `${readString(dataSheet, 7, 3)} ${readString(dataSheet, 7, 10)}` : "";
  const normalized = normalizeText(value);

  if (normalized.includes("DOLAR") || normalized.includes("US")) {
    return "USD";
  }

  return "S/.";
}

function findRow(worksheet: ExcelJS.Worksheet, predicate: (rowNumber: number) => boolean) {
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    if (predicate(rowNumber)) {
      return rowNumber;
    }
  }

  return null;
}

function readString(worksheet: ExcelJS.Worksheet, rowNumber: number, columnNumber: number) {
  const value = scalarCellValue(worksheet.getRow(rowNumber).getCell(columnNumber).value);
  return value == null ? "" : String(value).replace(/\s+/g, " ").trim();
}

function readOptionalString(worksheet: ExcelJS.Worksheet, rowNumber: number, columnNumber: number) {
  const value = readString(worksheet, rowNumber, columnNumber);
  return value.length > 0 ? value : null;
}

function readOptionalCode(worksheet: ExcelJS.Worksheet, rowNumber: number, columnNumber: number) {
  const value = scalarCellValue(worksheet.getRow(rowNumber).getCell(columnNumber).value);
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Decimal(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0);
  }

  const text = String(value ?? "").trim();
  return /^\d+(?:\.0+)?$/.test(text) ? text.replace(/\.0+$/, "") : null;
}

function readNumber(worksheet: ExcelJS.Worksheet, rowNumber: number, columnNumber: number) {
  return toDecimal(scalarCellValue(worksheet.getRow(rowNumber).getCell(columnNumber).value)).toNumber();
}

function scalarCellValue(value: ExcelJS.CellValue): string | number | boolean | Date | null {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
    return value;
  }

  const record = value as Record<string, unknown>;
  if ("result" in record) {
    return scalarUnknown(record.result);
  }

  if ("text" in record) {
    return scalarUnknown(record.text);
  }

  if ("richText" in record && Array.isArray(record.richText)) {
    return record.richText
      .map((entry) => (isRecord(entry) && typeof entry.text === "string" ? entry.text : ""))
      .join("");
  }

  return null;
}

function scalarUnknown(value: unknown): string | number | boolean | Date | null {
  if (value == null || typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
    return value;
  }

  return null;
}

function mapRw7ResourceType(resource: Rw7Resource | undefined, code: string) {
  const type = normalizeText(resource?.type ?? "");
  const unit = normalizeText(resource?.unit ?? "");
  const description = normalizeText(resource?.description ?? "");

  if (type.startsWith("MO") || unit === "HH" || code.startsWith("1")) return "MO";
  if (type.startsWith("EQ") && unit.startsWith("%")) return "HE";
  if (type.startsWith("EQ") || unit === "HM" || code.startsWith("6")) return "EQ";
  if (type.includes("SERVICIO") || description.includes("SUBCONTRATO")) return "SC";
  if (unit.startsWith("%") || description.includes("HERRAMIENTA")) return "HE";
  return "MA";
}

function normalizeRw7Unit(value: string) {
  const unit = value.trim();
  const normalized = normalizeText(unit);

  if (normalized === "HH") return "hh";
  if (normalized === "HM") return "hm";
  if (normalized === "M2") return "m2";
  if (normalized === "M3") return "m3";
  if (normalized === "%MO") return "%MO";

  return unit;
}

function classifyFooterVariable(description: string | null | undefined) {
  const text = normalizeText(description);
  if (text.includes("COSTO DIRECTO")) return "CD";
  if (text.includes("GASTOS GENERALES")) return "GG";
  if (text.includes("UTILIDAD")) return "UT";
  if (text.includes("SUBTOTAL")) return "ST";
  if (text.includes("IMPUESTO") || text.includes("IGV")) return "IM";
  if (text.includes("VALOR REFERENCIAL")) return "VR";
  if (text.includes("SUPERVISION")) return "SU";
  if (text.includes("TOTAL")) return "P_T";
  return text.slice(0, 12) || "RW7";
}

function stripLeadingItem(description: string, item: string) {
  if (!item) {
    return description;
  }

  return description.replace(new RegExp(`^${escapeRegExp(item)}\\s+`), "").trim();
}

function cleanFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sumBudgetRows(rows: Array<{ partial: number }>) {
  return roundMoney(rows.reduce((sum, row) => sum.plus(row.partial), new Decimal(0)));
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function toDecimal(value: unknown) {
  if (typeof value === "number" || typeof value === "string") {
    const decimal = new Decimal(value || 0);
    return decimal.isFinite() ? decimal : new Decimal(0);
  }

  return new Decimal(0);
}

function roundMoney(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(moneyDecimals, Decimal.ROUND_HALF_UP).toNumber();
}

function roundRate(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(rateDecimals, Decimal.ROUND_HALF_UP).toNumber();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
