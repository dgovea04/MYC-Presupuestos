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

type Rw7FooterSourceRow = {
  description: string;
  variable: string;
  value: number;
};

const presupuestoCode = "RW7";
const subpresupuestoCode = "001";
const moneyDecimals = 4;
const rateDecimals = 4;

export async function parseRw7WorkbookToS10Snapshot(input: Rw7WorkbookInput): Promise<S10ExportSnapshot> {
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = input.buffer as unknown as Parameters<typeof workbook.xlsx.load>[0];
  await workbook.xlsx.load(workbookBuffer);

  const budgetSheet = getRequiredWorksheet(workbook, "Pto");
  const apuSheet = getRequiredWorksheet(workbook, "ApuB");
  const resourceSheet = getRequiredWorksheet(workbook, "InsB");
  const dataSheet = workbook.getWorksheet("Datos");
  const projectName = readProjectName(budgetSheet, dataSheet, input.fileName);
  const currency = readCurrency(dataSheet);
  const budgetStructure = readBudgetStructure(budgetSheet, projectName);
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
  const footer = readFooterRows(budgetSheet, budgetStructure);
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

function readBudgetStructure(worksheet: ExcelJS.Worksheet, fallbackSubbudgetDescription: string): Rw7BudgetStructure {
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
    if (titleLevel) {
      const levelSubbudget: Rw7Subbudget = currentSubbudget ?? createFallbackSubbudget(fallbackSubbudgetDescription, subpresupuestos);
      if (!currentSubbudget) {
        currentSubbudget = levelSubbudget;
        subpresupuestos.push(currentSubbudget);
      }

      const parentLevel = findParentLevel(currentLevelByDepth, titleLevel.depth);
      const level: Rw7BudgetLevel = {
        subpresupuestoCode: levelSubbudget.code,
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

    const itemSubbudget: Rw7Subbudget = currentSubbudget ?? createFallbackSubbudget(fallbackSubbudgetDescription, subpresupuestos);
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
  if (normalizedMarker !== "SP" && normalizedMarker !== "SUBPRESUPUESTO") {
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
  if (!item || !description) {
    return null;
  }

  if (normalizedMarker === "T") {
    return {
      code: item,
      description,
      depth: 1,
    };
  }

  const subtitleMatch = /^ST(\d+)$/.exec(normalizedMarker);
  if (!subtitleMatch) {
    return null;
  }

  return {
    code: item,
    description,
    depth: Number(subtitleMatch[1]) + 1,
  };
}

function createFallbackSubbudget(description: string, subpresupuestos: Rw7Subbudget[]): Rw7Subbudget {
  return {
    code: subpresupuestoCode,
    description,
    sortOrder: subpresupuestos.length + 1,
  };
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
      const sourceUnit = normalizeRw7Unit(resource?.unit ?? "");
      const unit = resolveApuUnit(sourceUnit, rawQuantity, sourceUnitPrice, partial);
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

function resolveApuUnit(unit: string, rawQuantity: number, unitPrice: number, partial: number) {
  if (!normalizeText(unit).startsWith("%")) {
    return unit;
  }

  const percentageSubtotal = new Decimal(rawQuantity).dividedBy(100).times(unitPrice);
  if (percentageSubtotal.minus(partial).abs().lessThanOrEqualTo(0.01)) {
    return unit;
  }

  const directSubtotal = new Decimal(rawQuantity).times(unitPrice);
  if (directSubtotal.minus(partial).abs().lessThanOrEqualTo(0.01)) {
    return "u";
  }

  return unit;
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

function readFooterRows(worksheet: ExcelJS.Worksheet, budgetStructure: Rw7BudgetStructure): {
  pieRows: S10PieSubpresupuestoRow[];
  resultadoRows: S10ResultadoPieSubpresupuestoRow[];
} {
  const directCostRow = findRow(worksheet, (rowNumber) => normalizeText(readString(worksheet, rowNumber, 3)).includes("COSTO DIRECTO"));
  if (directCostRow == null) {
    return { pieRows: [], resultadoRows: [] };
  }

  const pieRows: S10PieSubpresupuestoRow[] = [];
  const resultadoRows: S10ResultadoPieSubpresupuestoRow[] = [];
  const sourceRows = readFooterSourceRows(worksheet, directCostRow);
  const generalRows = createFooterRowsForSubbudget("999", sourceRows);
  pieRows.push(...generalRows.pieRows);
  resultadoRows.push(...generalRows.resultadoRows);

  const directCostsBySubbudget = sumDirectCostsBySubbudget(budgetStructure.items);
  const rates = inferRw7FooterRates(sourceRows);
  for (const subpresupuesto of budgetStructure.subpresupuestos) {
    const directCost = directCostsBySubbudget.get(subpresupuesto.code);
    if (directCost == null) {
      continue;
    }

    const subbudgetSourceRows =
      budgetStructure.subpresupuestos.length === 1
        ? sourceRows
        : calculateSubbudgetFooterSourceRows(sourceRows, directCost, rates);
    const subbudgetRows = createFooterRowsForSubbudget(subpresupuesto.code, subbudgetSourceRows);
    pieRows.push(...subbudgetRows.pieRows);
    resultadoRows.push(...subbudgetRows.resultadoRows);
  }

  return { pieRows, resultadoRows };
}

function readFooterSourceRows(worksheet: ExcelJS.Worksheet, directCostRow: number) {
  const rows: Rw7FooterSourceRow[] = [];
  for (let rowNumber = directCostRow; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const description = readString(worksheet, rowNumber, 3);
    const value = readNumber(worksheet, rowNumber, 7);
    if (!description || (value === 0 && !normalizeText(description).includes("COSTO DIRECTO"))) {
      continue;
    }

    rows.push({
      description,
      variable: classifyFooterVariable(description),
      value: roundMoney(value),
    });

    if (normalizeText(description) === "TOTAL") {
      break;
    }
  }

  return rows;
}

function createFooterRowsForSubbudget(code: string, sourceRows: Rw7FooterSourceRow[]) {
  const pieRows: S10PieSubpresupuestoRow[] = [];
  const resultadoRows: S10ResultadoPieSubpresupuestoRow[] = [];

  for (const [index, sourceRow] of sourceRows.entries()) {
    const line = String(index + 1).padStart(2, "0");
    pieRows.push({
      CodPresupuesto: presupuestoCode,
      CodSubpresupuesto: code,
      Linea: line,
      Descripcion: sourceRow.description,
      Variable: sourceRow.variable,
      Formula: sourceRow.variable,
      Omitido: false,
    });
    resultadoRows.push({
      CodPresupuesto: presupuestoCode,
      CodSubpresupuesto: code,
      Linea: line,
      Descripcion: sourceRow.description,
      Formula: sourceRow.variable,
      Valor1: sourceRow.value,
      Valor2: sourceRow.value,
      ValorConFactor: sourceRow.value,
    });
  }

  return { pieRows, resultadoRows };
}

function sumDirectCostsBySubbudget(items: Rw7BudgetItem[]) {
  const totals = new Map<string, Decimal>();
  for (const item of items) {
    totals.set(item.subpresupuestoCode, (totals.get(item.subpresupuestoCode) ?? new Decimal(0)).plus(item.partial));
  }

  return new Map(Array.from(totals.entries()).map(([code, total]) => [code, roundMoney(total)]));
}

function inferRw7FooterRates(sourceRows: Rw7FooterSourceRow[]) {
  const directCost = findFooterSourceValue(sourceRows, "CD");
  const subtotal = findFooterSourceValue(sourceRows, "ST");
  const referentialValue = findFooterSourceValue(sourceRows, "VR");

  return {
    generalExpensesRate: divideRw7Rate(findFooterSourceValue(sourceRows, "PGG"), directCost),
    utilityRate: divideRw7Rate(findFooterSourceValue(sourceRows, "UTI"), directCost),
    igvRate: divideRw7Rate(findFooterSourceValue(sourceRows, "IGV"), subtotal),
    supervisionRate: divideRw7Rate(findFooterSourceValue(sourceRows, "SU"), referentialValue),
  };
}

function calculateSubbudgetFooterSourceRows(
  sourceRows: Rw7FooterSourceRow[],
  directCost: number,
  rates: ReturnType<typeof inferRw7FooterRates>,
) {
  const calculated = new Map<string, number>();

  calculated.set("CD", roundMoney(directCost));
  calculated.set("PGG", roundMoney(new Decimal(directCost).times(rates.generalExpensesRate)));
  calculated.set("UTI", roundMoney(new Decimal(directCost).times(rates.utilityRate)));
  calculated.set(
    "ST",
    roundMoney(new Decimal(calculated.get("CD") ?? 0).plus(calculated.get("PGG") ?? 0).plus(calculated.get("UTI") ?? 0)),
  );
  calculated.set("IGV", roundMoney(new Decimal(calculated.get("ST") ?? 0).times(rates.igvRate)));
  calculated.set("VR", roundMoney(new Decimal(calculated.get("ST") ?? 0).plus(calculated.get("IGV") ?? 0)));
  calculated.set("SU", roundMoney(new Decimal(calculated.get("VR") ?? 0).times(rates.supervisionRate)));
  calculated.set("P_T", roundMoney(new Decimal(calculated.get("VR") ?? 0).plus(calculated.get("SU") ?? 0)));

  const generalDirectCost = findFooterSourceValue(sourceRows, "CD");
  const scale = generalDirectCost === 0 ? new Decimal(0) : new Decimal(directCost).dividedBy(generalDirectCost);

  return sourceRows.map((row) => ({
    ...row,
    value: calculated.get(row.variable) ?? roundMoney(new Decimal(row.value).times(scale)),
  }));
}

function findFooterSourceValue(sourceRows: Rw7FooterSourceRow[], variable: string) {
  return sourceRows.find((row) => row.variable === variable)?.value ?? 0;
}

function divideRw7Rate(numerator: number, denominator: number) {
  if (denominator === 0) {
    return 0;
  }

  return roundRate(new Decimal(numerator).dividedBy(denominator));
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
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
    return value;
  }

  const record = value as unknown as Record<string, unknown>;
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
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value instanceof Date) {
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
  if (text.includes("GASTOS GENERALES")) return "PGG";
  if (text.includes("UTILIDAD")) return "UTI";
  if (text.includes("SUBTOTAL")) return "ST";
  if (text.includes("IMPUESTO") || text.includes("IGV")) return "IGV";
  if (text.includes("VALOR REFERENCIAL")) return "VR";
  if (text.includes("SUPERVISION")) return "SU";
  if (text === "TOTAL" || text.includes("TOTAL PRESUPUESTO")) return "P_T";
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
