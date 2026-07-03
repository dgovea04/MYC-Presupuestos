import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Decimal from "decimal.js";
import type {
  S10ApuDetalleRow,
  S10BudgetLevelRow,
  S10ExportSnapshot,
  S10PartidaRow,
  S10PieSubpresupuestoRow,
  S10PresupuestoRow,
  S10ResultadoPieSubpresupuestoRow,
  S10SubpresupuestoDetalleRow,
  S10SubpresupuestoRow,
} from "@/lib/s10/import-mapper";

type DelphinWorkbookInput = {
  buffer: Buffer;
  fileName?: string;
};

type DelphinDecodedProject = {
  project: {
    id?: string | null;
    name?: string | null;
  };
  units: DelphinUnit[];
  budgets: DelphinBudget[];
};

type DelphinUnit = {
  id?: string | null;
  description?: string | null;
  abbreviation?: string | null;
};

type DelphinBudget = {
  id?: string | null;
  name?: string | null;
  directCost?: number | null;
  total?: number | null;
  generalExpensesRate?: number | null;
  utilityRate?: number | null;
  taxRate?: number | null;
  generalExpensesAmount?: number | null;
  utilityAmount?: number | null;
  taxAmount?: number | null;
  subtotal?: number | null;
  costs: DelphinCost[];
};

type DelphinCost = {
  id?: string | null;
  description?: string | null;
  unitId?: string | null;
  code?: string | null;
  productivity?: number | null;
  unitPrice?: number | null;
  quantity?: number | null;
  partial?: number | null;
  analysisId?: string | null;
  analysis?: DelphinAnalysis | null;
  subtotals: DelphinSubtotal[];
  children: DelphinCost[];
};

type DelphinAnalysis = {
  productivity?: number | null;
  subtotals: DelphinSubtotal[];
};

type DelphinSubtotal = {
  typeId?: string | null;
  subtotal?: number | null;
  compositions: DelphinComposition[];
};

type DelphinComposition = {
  id?: string | null;
  description?: string | null;
  unitId?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  partial?: number | null;
  resourceCode?: string | null;
  listPriceId?: string | null;
};

type DelphinBudgetAccumulator = {
  subpresupuesto: S10SubpresupuestoRow;
  partidas: S10PartidaRow[];
  detalles: S10SubpresupuestoDetalleRow[];
  levels: S10BudgetLevelRow[];
  apuDetalles: S10ApuDetalleRow[];
};

type DelphinSubbudgetRoot = {
  code: string;
  description: string;
  children: DelphinCost[];
  partida?: DelphinCost;
};

const sourceBudgetCode = "DELPHIN";
const moneyDecimals = 4;
const rateDecimals = 4;

export function parseDelphinDprjToS10Snapshot(input: DelphinWorkbookInput): S10ExportSnapshot {
  const decoded = decodeDelphinDprj(input.buffer);
  const unitById = new Map(decoded.units.map((unit) => [cleanText(unit.id), unit]));
  const projectName = cleanOptionalText(decoded.project.name) ?? cleanFileName(input.fileName) ?? "Proyecto Delphin Express";
  const accumulators = decoded.budgets.flatMap((budget, budgetIndex) =>
    createBudgetAccumulators({
      budget,
      budgetIndex,
      projectName,
      unitById,
    }),
  );
  const total = decoded.budgets.reduce((sum, budget) => sum.plus(budget.total ?? budget.directCost ?? 0), new Decimal(0));
  const directCost = decoded.budgets.reduce((sum, budget) => sum.plus(budget.directCost ?? 0), new Decimal(0));
  const footerRows = createDelphinFooterRows(decoded.budgets, accumulators);

  if (accumulators.length === 0) {
    throw new Error("El archivo Delphin no contiene presupuestos importables.");
  }

  return {
    presupuestos: [
      {
        CodPresupuesto: sourceBudgetCode,
        Descripcion: projectName,
        Moneda: "S/.",
        CostoOferta1: roundMoney(total.gt(0) ? total : directCost),
      } satisfies S10PresupuestoRow,
    ],
    subpresupuestos: accumulators.map((entry) => entry.subpresupuesto),
    partidas: accumulators.flatMap((entry) => entry.partidas),
    budgetLevels: accumulators.flatMap((entry) => entry.levels),
    subpresupuestoDetalles: accumulators.flatMap((entry) => entry.detalles),
    apuDetalles: accumulators.flatMap((entry) => entry.apuDetalles),
    pieSubpresupuestos: footerRows.pieRows,
    resultadoPieSubpresupuestos: footerRows.resultadoRows,
  };
}

function createBudgetAccumulators(input: {
  budget: DelphinBudget;
  budgetIndex: number;
  projectName: string;
  unitById: Map<string, DelphinUnit>;
}) {
  const subbudgetRoots = createSubbudgetRoots(input.budget, input.budgetIndex, input.projectName);

  return subbudgetRoots.map((root) => {
    const accumulator: DelphinBudgetAccumulator = {
      subpresupuesto: {
        CodPresupuesto: sourceBudgetCode,
        CodSubpresupuesto: root.code,
        Descripcion: root.description,
      },
      partidas: [],
      detalles: [],
      levels: [],
      apuDetalles: [],
    };

    for (const child of root.children) {
      collectCostNode({
        node: child,
        subpresupuestoCode: root.code,
        parentLevelCode: null,
        depth: 1,
        accumulator,
        unitById: input.unitById,
      });
    }

    if (root.partida) {
      collectPartida({
        node: root.partida,
        subpresupuestoCode: root.code,
        levelCode: null,
        accumulator,
        unitById: input.unitById,
      });
    }

    return accumulator;
  });
}

function createDelphinFooterRows(budgets: DelphinBudget[], accumulators: DelphinBudgetAccumulator[]) {
  const pieRows: S10PieSubpresupuestoRow[] = [];
  const resultadoRows: S10ResultadoPieSubpresupuestoRow[] = [];

  for (let index = 0; index < budgets.length; index += 1) {
    const budget = budgets[index];
    const accumulator = accumulators[index];
    if (!budget || !accumulator || !hasDelphinFooterData(budget)) {
      continue;
    }

    const rows = createFooterRowsForSubbudget(accumulator.subpresupuesto.CodSubpresupuesto, budget);
    pieRows.push(...rows.pieRows);
    resultadoRows.push(...rows.resultadoRows);
  }

  if (resultadoRows.length > 0) {
    const generalRows = createGeneralFooterRows(resultadoRows);
    pieRows.push(...generalRows.pieRows);
    resultadoRows.push(...generalRows.resultadoRows);
  }

  return { pieRows, resultadoRows };
}

function createFooterRowsForSubbudget(subpresupuestoCode: string, budget: DelphinBudget) {
  const directCost = roundMoney(budget.directCost ?? 0);
  const generalExpenses = roundMoney(budget.generalExpensesAmount ?? new Decimal(directCost).times(ratePercentToDecimal(budget.generalExpensesRate)).toNumber());
  const utility = roundMoney(budget.utilityAmount ?? new Decimal(directCost).times(ratePercentToDecimal(budget.utilityRate)).toNumber());
  const subtotal = roundMoney(budget.subtotal ?? new Decimal(directCost).plus(generalExpenses).plus(utility).toNumber());
  const tax = roundMoney(budget.taxAmount ?? new Decimal(subtotal).times(ratePercentToDecimal(budget.taxRate)).toNumber());
  const total = roundMoney(budget.total ?? new Decimal(subtotal).plus(tax).toNumber());
  const generalExpensesRate = roundRate(ratePercentToDecimal(budget.generalExpensesRate));
  const utilityRate = roundRate(ratePercentToDecimal(budget.utilityRate));
  const taxRate = roundRate(ratePercentToDecimal(budget.taxRate));

  return createStandardFooterRows(subpresupuestoCode, [
    { line: "01", description: "COSTO DIRECTO", variable: "CD", formula: "CD", value: directCost },
    {
      line: "02",
      description: `GASTOS GENERALES (${formatRatePercent(generalExpensesRate)}%)`,
      variable: "PGG",
      formula: `CD*${generalExpensesRate}`,
      value: generalExpenses,
    },
    {
      line: "03",
      description: `UTILIDAD (${formatRatePercent(utilityRate)}%)`,
      variable: "UTI",
      formula: `CD*${utilityRate}`,
      value: utility,
    },
    { line: "04", description: "SUBTOTAL", variable: "ST", formula: "CD+PGG+UTI", value: subtotal },
    {
      line: "05",
      description: `IGV (${formatRatePercent(taxRate)}%)`,
      variable: "IGV",
      formula: `ST*${taxRate}`,
      value: tax,
    },
    { line: "06", description: "TOTAL PRESUPUESTO", variable: "P_T", formula: "ST+IGV", value: total },
  ]);
}

function createGeneralFooterRows(rows: S10ResultadoPieSubpresupuestoRow[]) {
  const directCost = sumFooterValue(rows, "01");
  const generalExpenses = sumFooterValue(rows, "02");
  const utility = sumFooterValue(rows, "03");
  const subtotal = sumFooterValue(rows, "04");
  const tax = sumFooterValue(rows, "05");
  const total = sumFooterValue(rows, "06");
  const generalExpensesRate = roundRate(new Decimal(generalExpenses).dividedBy(directCost || 1));
  const utilityRate = roundRate(new Decimal(utility).dividedBy(directCost || 1));
  const taxRate = roundRate(new Decimal(tax).dividedBy(subtotal || 1));

  return createStandardFooterRows("999", [
    { line: "01", description: "COSTO DIRECTO", variable: "CD", formula: "CD", value: directCost },
    {
      line: "02",
      description: `GASTOS GENERALES (${formatRatePercent(generalExpensesRate)}%)`,
      variable: "PGG",
      formula: `CD*${generalExpensesRate}`,
      value: generalExpenses,
    },
    {
      line: "03",
      description: `UTILIDAD (${formatRatePercent(utilityRate)}%)`,
      variable: "UTI",
      formula: `CD*${utilityRate}`,
      value: utility,
    },
    { line: "04", description: "SUBTOTAL", variable: "ST", formula: "CD+PGG+UTI", value: subtotal },
    {
      line: "05",
      description: `IGV (${formatRatePercent(taxRate)}%)`,
      variable: "IGV",
      formula: `ST*${taxRate}`,
      value: tax,
    },
    { line: "06", description: "TOTAL PRESUPUESTO", variable: "P_T", formula: "ST+IGV", value: total },
  ]);
}

function createStandardFooterRows(
  subpresupuestoCode: string,
  rows: Array<{ line: string; description: string; variable: string; formula: string; value: number }>,
) {
  return {
    pieRows: rows.map((row): S10PieSubpresupuestoRow => ({
      CodPresupuesto: sourceBudgetCode,
      CodSubpresupuesto: subpresupuestoCode,
      Linea: row.line,
      Descripcion: row.description,
      Variable: row.variable,
      Formula: row.formula,
      Omitido: false,
    })),
    resultadoRows: rows.map((row): S10ResultadoPieSubpresupuestoRow => ({
      CodPresupuesto: sourceBudgetCode,
      CodSubpresupuesto: subpresupuestoCode,
      Linea: row.line,
      Descripcion: row.description,
      Formula: row.formula,
      Valor1: roundMoney(row.value),
    })),
  };
}

function hasDelphinFooterData(budget: DelphinBudget) {
  return (
    budget.directCost != null ||
    budget.total != null ||
    budget.generalExpensesRate != null ||
    budget.utilityRate != null ||
    budget.taxRate != null ||
    budget.generalExpensesAmount != null ||
    budget.utilityAmount != null ||
    budget.taxAmount != null ||
    budget.subtotal != null
  );
}

function sumFooterValue(rows: S10ResultadoPieSubpresupuestoRow[], line: string) {
  return roundMoney(
    rows
      .filter((row) => row.Linea === line && row.CodSubpresupuesto !== "999")
      .reduce((sum, row) => sum.plus(row.Valor1 ?? 0), new Decimal(0)),
  );
}

function ratePercentToDecimal(value: number | null | undefined) {
  return new Decimal(value ?? 0).dividedBy(100).toNumber();
}

function formatRatePercent(rate: number) {
  return new Decimal(rate).times(100).toDecimalPlaces(4).toString();
}

function createSubbudgetRoots(budget: DelphinBudget, budgetIndex: number, projectName: string): DelphinSubbudgetRoot[] {
  if (budget.costs.length === 0) {
    return [createSyntheticSubbudgetRoot(budget, budgetIndex, projectName)];
  }

  if (budget.costs.length === 1) {
    const [root] = budget.costs;
    if (!root) {
      return [createSyntheticSubbudgetRoot(budget, budgetIndex, projectName)];
    }

    const rootName = normalizeText(root.description);
    const budgetName = normalizeText(budget.name);
    const project = normalizeText(projectName);
    const isGenericBudget = budgetName.includes("PROYECTO") || budgetName === project || rootName === budgetName;

    if (root.children.length > 0 && !isPartidaNode(root) && isGenericBudget) {
      return [
        {
          code: createSubbudgetCodeFromCost(root, budgetIndex, 0),
          description: cleanOptionalText(root.description) ?? cleanOptionalText(budget.name) ?? projectName,
          children: root.children,
        },
      ];
    }

    if (isPartidaNode(root)) {
      return [
        {
          code: createSubbudgetCodeFromCost(root, budgetIndex, 0),
          description: cleanOptionalText(budget.name) ?? projectName,
          children: [],
          partida: root,
        },
      ];
    }
  }

  return [
    {
      code: createSubbudgetCodeFromBudget(budget, budgetIndex),
      description: cleanOptionalText(budget.name) ?? projectName,
      children: budget.costs,
    },
  ];
}

function collectCostNode(input: {
  node: DelphinCost;
  subpresupuestoCode: string;
  parentLevelCode: string | null;
  depth: number;
  accumulator: DelphinBudgetAccumulator;
  unitById: Map<string, DelphinUnit>;
}) {
  if (isPartidaNode(input.node)) {
    collectPartida({
      node: input.node,
      subpresupuestoCode: input.subpresupuestoCode,
      levelCode: input.parentLevelCode,
      accumulator: input.accumulator,
      unitById: input.unitById,
    });
    return;
  }

  const levelCode = cleanOptionalText(input.node.code) ?? input.node.id ?? `nivel-${input.accumulator.levels.length + 1}`;
  input.accumulator.levels.push({
    CodPresupuesto: sourceBudgetCode,
    CodSubpresupuesto: input.subpresupuestoCode,
    Codigo: levelCode,
    Descripcion: cleanOptionalText(input.node.description) ?? levelCode,
    Nivel: input.depth,
    Tipo: input.depth <= 1 ? "TITLE" : "SUBTITLE",
    ParentCodigo: input.parentLevelCode,
    Orden: levelCode,
    SortOrder: input.accumulator.levels.length + 1,
  });

  for (const child of input.node.children) {
    collectCostNode({
      node: child,
      subpresupuestoCode: input.subpresupuestoCode,
      parentLevelCode: levelCode,
      depth: input.depth + 1,
      accumulator: input.accumulator,
      unitById: input.unitById,
    });
  }
}

function collectPartida(input: {
  node: DelphinCost;
  subpresupuestoCode: string;
  levelCode: string | null;
  accumulator: DelphinBudgetAccumulator;
  unitById: Map<string, DelphinUnit>;
}) {
  const partidaCode = cleanOptionalText(input.node.id) ?? `DE-${input.accumulator.partidas.length + 1}`;
  const itemCode = cleanOptionalText(input.node.code) ?? partidaCode;
  const description = cleanOptionalText(input.node.description) ?? partidaCode;
  const unit = normalizeDelphinUnit(input.unitById.get(cleanText(input.node.unitId)), input.node.unitId);
  const quantity = roundRate(input.node.quantity ?? 0);
  const unitPrice = roundMoney(input.node.unitPrice ?? 0);
  const partial = roundMoney(input.node.partial ?? new Decimal(quantity).times(unitPrice));

  input.accumulator.partidas.push({
    CodPresupuesto: sourceBudgetCode,
    CodSubpresupuesto: input.subpresupuestoCode,
    CodPartida: partidaCode,
    Descripcion: description,
    CodUnidad: unit,
    Precio1: unitPrice,
    RendimientoMO: roundRate(input.node.productivity ?? input.node.analysis?.productivity ?? 1),
    RendimientoEQ: 0,
  });
  input.accumulator.detalles.push({
    CodPresupuesto: sourceBudgetCode,
    CodSubpresupuesto: input.subpresupuestoCode,
    Tipo: 1,
    Item: itemCode,
    Orden: itemCode,
    Secuencial: input.accumulator.detalles.length + 1,
    Descripcion: description,
    Unidad: unit,
    Metrado: quantity,
    MetradoBase: quantity,
    Precio1: unitPrice,
    Parcial1: partial,
    Nivel: itemCode.split(".").filter(Boolean).length,
    CodPartida: partidaCode,
    CodPresupuestoPartida: sourceBudgetCode,
    PropioPartida: "01",
    LevelCode: input.levelCode,
  });

  for (const apuDetalle of createApuDetalles(input.node, input.subpresupuestoCode, partidaCode, input.unitById)) {
    input.accumulator.apuDetalles.push(apuDetalle);
  }
}

function createApuDetalles(
  node: DelphinCost,
  subpresupuestoCode: string,
  partidaCode: string,
  unitById: Map<string, DelphinUnit>,
): S10ApuDetalleRow[] {
  const detalles: S10ApuDetalleRow[] = [];
  const subtotals = node.subtotals.length > 0 ? node.subtotals : node.analysis?.subtotals ?? [];
  if (subtotals.length === 0) {
    return detalles;
  }

  for (const subtotal of subtotals) {
    for (const composition of subtotal.compositions) {
      const resourceCode = cleanOptionalText(composition.listPriceId) ?? cleanOptionalText(composition.resourceCode) ?? cleanOptionalText(composition.id);
      const description = cleanOptionalText(composition.description);
      if (!resourceCode || !description) {
        continue;
      }

      detalles.push({
        CodPresupuesto: sourceBudgetCode,
        CodSubpresupuesto: subpresupuestoCode,
        CodPartida: partidaCode,
        CodPresupuestoPartida: sourceBudgetCode,
        PropioPartida: "01",
        CodInsumo: resourceCode,
        Descripcion: description,
        CodUnidad: normalizeDelphinUnit(unitById.get(cleanText(composition.unitId)), composition.unitId),
        CodIndiceUnificado: null,
        Cantidad: roundRate(composition.quantity ?? 0),
        Precio1: roundMoney(composition.unitPrice ?? 0),
        Parcial1: roundMoney(composition.partial ?? 0),
        Tipo: mapDelphinResourceType(subtotal.typeId, description, composition.unitId),
      });
    }
  }

  return detalles;
}

function decodeDelphinDprj(buffer: Buffer): DelphinDecodedProject {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "myc-delphin-"));
  const inputPath = path.join(tempDir, "project.dprj");
  const scriptPath = path.join(tempDir, "decode.ps1");

  fs.writeFileSync(inputPath, buffer);
  fs.writeFileSync(scriptPath, delphinDecoderPowerShell, "utf8");

  try {
    const result = spawnSync(resolvePowerShellExecutable(), ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-InputPath", inputPath], {
      encoding: "utf8",
      maxBuffer: 40 * 1024 * 1024,
      windowsHide: true,
    });

    if (result.error) {
      throw new Error(`No se pudo ejecutar el decoder Delphin: ${result.error.message}`);
    }

    if (result.status !== 0) {
      const rawMessage = [result.stderr.trim(), result.stdout.trim()].filter(Boolean).join("\n");
      throw new Error(formatDelphinDecodeFailure(rawMessage, "archivo .dprj"));
    }

    return parseDecodedProjectJson(result.stdout);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function parseDecodedProjectJson(json: string): DelphinDecodedProject {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed) || !isRecord(parsed.project) || !Array.isArray(parsed.budgets) || !Array.isArray(parsed.units)) {
    throw new Error("El archivo DPRJ no devolvio una estructura Delphin valida.");
  }

  return parsed as DelphinDecodedProject;
}

function isPartidaNode(node: DelphinCost) {
  return cleanOptionalText(node.unitId) != null || cleanOptionalText(node.analysisId) != null || node.analysis != null;
}

function createSyntheticSubbudgetRoot(budget: DelphinBudget, budgetIndex: number, projectName: string): DelphinSubbudgetRoot {
  return {
    code: createFallbackSubbudgetCode(budgetIndex, 0),
    description: cleanOptionalText(budget.name) ?? projectName,
    children: [],
  };
}

function createSubbudgetCodeFromBudget(budget: DelphinBudget, budgetIndex: number) {
  const firstCostCode = cleanOptionalText(budget.costs[0]?.code);
  const firstSegment = firstCostCode?.match(/^\d+/)?.[0];
  if (firstSegment) {
    return firstSegment;
  }

  return createFallbackSubbudgetCode(budgetIndex, 0);
}

function createSubbudgetCodeFromCost(root: DelphinCost, budgetIndex: number, rootIndex: number) {
  const numericCode = cleanOptionalText(root.code)?.match(/\d+(?:\.\d+)*/)?.[0];
  if (numericCode) {
    return numericCode;
  }

  return createFallbackSubbudgetCode(budgetIndex, rootIndex);
}

function createFallbackSubbudgetCode(budgetIndex: number, rootIndex: number) {
  return `${budgetIndex + 1}${String(rootIndex + 1).padStart(2, "0")}`;
}

function normalizeDelphinUnit(unit: DelphinUnit | undefined, fallback: string | null | undefined) {
  const source = `${unit?.abbreviation ?? ""} ${unit?.description ?? ""} ${fallback ?? ""}`;
  const rawSymbol = source.toUpperCase();
  const raw = normalizeText(source);
  if (rawSymbol.includes("M³")) return "m3";
  if (rawSymbol.includes("M²")) return "m2";
  if (raw.includes("METRO CUBICO")) return "m3";
  if (raw.includes("METRO CUADRADO")) return "m2";
  if (raw.includes("METRO LINEAL")) return "m";
  if (raw.includes("HORA HOMBRE")) return "hh";
  if (raw.includes("HORA MAQUINA")) return "hm";
  if (raw.includes("KILOGRAMO")) return "kg";
  if (raw.includes("BOLSA")) return "bolsa";
  if (raw.includes("GLOBAL")) return "glb";
  if (raw.includes("%MO")) return "%MO";
  if (raw.includes("%")) return "%";
  if (raw.includes("UNIDAD")) return "und";

  return cleanOptionalText(unit?.abbreviation) ?? cleanOptionalText(unit?.description) ?? (cleanText(fallback) || "und");
}

function mapDelphinResourceType(typeId: string | null | undefined, description: string, unitId: string | null | undefined) {
  const text = normalizeText(`${typeId ?? ""} ${description} ${unitId ?? ""}`);
  if (text.includes("HERRAMIENTA")) return "HE";
  if (text.includes("%")) return "HE";
  if (text.includes("TC0000000001")) return "MO";
  if (text.includes("TC0000000002")) return "MA";
  if (text.includes("TC0000000003")) return "EQ";
  if (text.includes("TC0000000004")) return "SC";
  return "MA";
}

function cleanFileName(fileName: string | undefined) {
  return fileName
    ?.replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function cleanOptionalText(value: string | null | undefined) {
  const cleaned = cleanText(value);
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function roundMoney(value: Decimal.Value) {
  return new Decimal(value ?? 0).toDecimalPlaces(moneyDecimals, Decimal.ROUND_HALF_UP).toNumber();
}

function roundRate(value: Decimal.Value) {
  return new Decimal(value ?? 0).toDecimalPlaces(rateDecimals, Decimal.ROUND_HALF_UP).toNumber();
}

function resolvePowerShellExecutable() {
  const windowsPowerShell = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe";
  return fs.existsSync(windowsPowerShell) ? windowsPowerShell : "powershell";
}

export function formatDelphinDecodeFailure(rawMessage: string, sourceLabel = "archivo Delphin") {
  const message = rawMessage.trim();
  if (message.includes("objectID cannot be less than or equal to zero")) {
    return [
      `No se pudo decodificar el ${sourceLabel}.`,
      "El archivo .dprj parece usar una variante de serializacion BinaryFormatter que el decoder actual no soporta, o el export esta dañado.",
      "Vuelve a exportarlo desde Delphin Express y, si el problema persiste, comparte ese .dprj para ampliar la compatibilidad del importador.",
      `Detalle tecnico: ${message}`,
    ].join(" ");
  }

  return message || `No se pudo decodificar el ${sourceLabel}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const flexClassName = `FlexDprj${randomUUID().replace(/-/g, "")}`;
const binderClassName = `FlexDprjBinder${randomUUID().replace(/-/g, "")}`;
const probeClassName = `DprjProbe${randomUUID().replace(/-/g, "")}`;

const delphinDecoderPowerShell = `
param([Parameter(Mandatory=$true)][string]$InputPath)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$code = @"
using System;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Formatters.Binary;
using System.Collections.Generic;
using System.Collections;
using System.Globalization;
using System.Text;

[Serializable]
public class ${flexClassName} : ISerializable {
  public string TypeName;
  public Dictionary<string, object> Values = new Dictionary<string, object>();
  public ${flexClassName}() {}
  protected ${flexClassName}(SerializationInfo info, StreamingContext context) {
    TypeName = info.FullTypeName;
    foreach (SerializationEntry entry in info) Values[entry.Name] = entry.Value;
  }
  public void GetObjectData(SerializationInfo info, StreamingContext context) {}
}

public class ${binderClassName} : SerializationBinder {
  public override Type BindToType(string assemblyName, string typeName) {
    if (typeName.StartsWith("System.Collections.Generic.List") && (typeName.Contains("[[Delphin.") || typeName.Contains("[[MyGanttLibrary."))) return typeof(List<${flexClassName}>);
    if (typeName.EndsWith("[]") && (typeName.StartsWith("Delphin.") || typeName.StartsWith("MyGanttLibrary."))) return typeof(${flexClassName}[]);
    if (typeName.StartsWith("Delphin.") || typeName.StartsWith("MyGanttLibrary.")) return typeof(${flexClassName});
    return Type.GetType(typeName + ", " + assemblyName);
  }
}

public static class ${probeClassName} {
  public static object Load(string path) {
    var formatter = new BinaryFormatter();
    formatter.Binder = new ${binderClassName}();
    using (var stream = File.OpenRead(path)) return formatter.Deserialize(stream);
  }

  public static string ExportJson(string path) {
    var root = (${flexClassName})Load(path);
    var project = V(root, "proyecto") as ${flexClassName};
    var sb = new StringBuilder();
    sb.Append("{");
    PObj(sb, "project", delegate {
      PStr(sb, "id", S(V(project, "id_proyecto")), false);
      PStr(sb, "name", S(V(project, "nombre_proyecto")), true);
    }, false);
    PArr(sb, "units", Items(V(root, "unidades")), AppendUnit, true);
    PArr(sb, "budgets", Items(V(project, "Presupuestos")), AppendBudget, true);
    sb.Append("}");
    return sb.ToString();
  }

  static object V(${flexClassName} flex, string key) {
    if (flex == null || !flex.Values.ContainsKey(key)) return null;
    return flex.Values[key];
  }

  static IEnumerable<object> Items(object value) {
    if (value == null) yield break;
    var list = value as IList;
    if (list != null) {
      foreach (var item in list) if (item != null) yield return item;
      yield break;
    }
    var flex = value as ${flexClassName};
    if (flex == null) yield break;
    string itemsKey = null;
    string sizeKey = null;
    foreach (var key in flex.Values.Keys) {
      if (key.EndsWith("_items", StringComparison.Ordinal)) itemsKey = key;
      if (key.EndsWith("_size", StringComparison.Ordinal)) sizeKey = key;
    }
    if (itemsKey == null || sizeKey == null) yield break;
    var size = Convert.ToInt32(flex.Values[sizeKey], CultureInfo.InvariantCulture);
    var array = flex.Values[itemsKey] as IList;
    if (array == null) yield break;
    for (var i = 0; i < size; i++) if (array[i] != null) yield return array[i];
  }

  static void AppendUnit(StringBuilder sb, object value) {
    var unit = value as ${flexClassName};
    sb.Append("{");
    PStr(sb, "id", S(V(unit, "id_unidad")), false);
    PStr(sb, "description", S(V(unit, "descripcion_unidad")), true);
    PStr(sb, "abbreviation", S(V(unit, "abreviatura_unidad")), true);
    sb.Append("}");
  }

  static void AppendBudget(StringBuilder sb, object value) {
    var budget = value as ${flexClassName};
    sb.Append("{");
    PStr(sb, "id", S(V(budget, "id_presupuesto")), false);
    PStr(sb, "name", S(V(budget, "nombre_presupuesto")), true);
    PNum(sb, "directCost", V(budget, "costo_directo"), true);
    PNum(sb, "total", V(budget, "total_presupuesto"), true);
    PNum(sb, "generalExpensesRate", V(budget, "porcentaje_gasto"), true);
    PNum(sb, "utilityRate", V(budget, "porcentaje_utilidad"), true);
    PNum(sb, "taxRate", V(budget, "porcentaje_igv"), true);
    PNum(sb, "generalExpensesAmount", V(budget, "monto_gasto"), true);
    PNum(sb, "utilityAmount", V(budget, "monto_utilidad"), true);
    PNum(sb, "taxAmount", V(budget, "monto_igv"), true);
    PNum(sb, "subtotal", V(budget, "parcial_presupuesto"), true);
    PArr(sb, "costs", Items(V(budget, "Costos")), AppendCost, true);
    sb.Append("}");
  }

  static void AppendCost(StringBuilder sb, object value) {
    var cost = value as ${flexClassName};
    sb.Append("{");
    PStr(sb, "id", S(V(cost, "id_costounitario")), false);
    PStr(sb, "description", S(V(cost, "descripcion_costo")), true);
    PStr(sb, "unitId", S(V(cost, "id_unidad")), true);
    PStr(sb, "code", S(V(cost, "numeracion_costo")), true);
    PNum(sb, "productivity", V(cost, "productividad"), true);
    PNum(sb, "unitPrice", V(cost, "costo_unitario"), true);
    PNum(sb, "quantity", V(cost, "cantidad"), true);
    PNum(sb, "partial", V(cost, "parcial_costo"), true);
    PStr(sb, "analysisId", S(V(cost, "id_analisiscosto")), true);
    PObjOrNull(sb, "analysis", V(cost, "AnalisisCosto") as ${flexClassName}, AppendAnalysis, true);
    PArr(sb, "subtotals", Items(V(cost, "Subtotales")), AppendSubtotal, true);
    PArr(sb, "children", Items(V(cost, "Subcostos")), AppendCost, true);
    sb.Append("}");
  }

  static void AppendAnalysis(StringBuilder sb, ${flexClassName} analysis) {
    PNum(sb, "productivity", V(analysis, "productividad"), false);
    PArr(sb, "subtotals", Items(V(analysis, "Subtotales")), AppendSubtotal, true);
  }

  static void AppendSubtotal(StringBuilder sb, object value) {
    var subtotal = value as ${flexClassName};
    sb.Append("{");
    PStr(sb, "typeId", S(V(subtotal, "id_tipocosto")), false);
    PNum(sb, "subtotal", V(subtotal, "subtotal"), true);
    PArr(sb, "compositions", Items(V(subtotal, "Composiciones")), AppendComposition, true);
    sb.Append("}");
  }

  static void AppendComposition(StringBuilder sb, object value) {
    var composition = value as ${flexClassName};
    sb.Append("{");
    PStr(sb, "id", S(V(composition, "id_composicion")), false);
    PStr(sb, "description", S(V(composition, "descripcion_composicion")), true);
    PStr(sb, "unitId", S(V(composition, "id_unidad")), true);
    PNum(sb, "quantity", V(composition, "cantidad_composicion"), true);
    PNum(sb, "unitPrice", V(composition, "costo_composicion"), true);
    PNum(sb, "partial", V(composition, "parcial_composicion"), true);
    PStr(sb, "resourceCode", S(V(composition, "codigo_crepco")), true);
    PStr(sb, "listPriceId", S(V(composition, "id_listaprecio")), true);
    sb.Append("}");
  }

  delegate void AppendObject(StringBuilder sb, object value);
  delegate void AppendFlexObject(StringBuilder sb, ${flexClassName} value);

  static void PObj(StringBuilder sb, string name, Action write, bool comma) {
    if (comma) sb.Append(",");
    JsonName(sb, name);
    sb.Append("{");
    write();
    sb.Append("}");
  }

  static void PObjOrNull(StringBuilder sb, string name, ${flexClassName} value, AppendFlexObject write, bool comma) {
    if (comma) sb.Append(",");
    JsonName(sb, name);
    if (value == null) {
      sb.Append("null");
      return;
    }
    sb.Append("{");
    write(sb, value);
    sb.Append("}");
  }

  static void PArr(StringBuilder sb, string name, IEnumerable<object> values, AppendObject write, bool comma) {
    if (comma) sb.Append(",");
    JsonName(sb, name);
    sb.Append("[");
    var first = true;
    foreach (var value in values) {
      if (!first) sb.Append(",");
      write(sb, value);
      first = false;
    }
    sb.Append("]");
  }

  static void PStr(StringBuilder sb, string name, string value, bool comma) {
    if (comma) sb.Append(",");
    JsonName(sb, name);
    if (value == null) sb.Append("null");
    else JsonString(sb, value);
  }

  static void PNum(StringBuilder sb, string name, object value, bool comma) {
    if (comma) sb.Append(",");
    JsonName(sb, name);
    if (value == null) {
      sb.Append("null");
      return;
    }
    var convertible = value as IConvertible;
    if (convertible == null) {
      sb.Append("null");
      return;
    }
    sb.Append(convertible.ToString(CultureInfo.InvariantCulture));
  }

  static void JsonName(StringBuilder sb, string name) {
    JsonString(sb, name);
    sb.Append(":");
  }

  static void JsonString(StringBuilder sb, string value) {
    sb.Append('"');
    foreach (var c in value) {
      if (c == '\\\\') {
        sb.Append('\\\\');
        sb.Append('\\\\');
      }
      else if (c == '"') {
        sb.Append('\\\\');
        sb.Append('"');
      }
      else if (c == '\\n') sb.Append("\\\\n");
      else if (c == '\\r') sb.Append("\\\\r");
      else if (c == '\\t') sb.Append("\\\\t");
      else sb.Append(c);
    }
    sb.Append('"');
  }

  static string S(object value) {
    if (value == null) return null;
    return Convert.ToString(value, CultureInfo.InvariantCulture);
  }
}
"@

Add-Type -TypeDefinition $code
[Console]::Write([${probeClassName}]::ExportJson($InputPath))
exit 0

function Value($flex, [string]$name) {
  if ($null -eq $flex) { return $null }
  if ($flex.Values.ContainsKey($name)) { return $flex.Values[$name] }
  return $null
}

function Scalar($value) {
  if ($null -eq $value) { return $null }
  if ($value -is [DateTime]) { return $value.ToString("o") }
  return $value
}

function Items($value) {
  if ($null -eq $value) { return @() }
  if ($value -is [System.Collections.IList]) {
    $result = New-Object 'System.Collections.Generic.List[object]'
    foreach ($item in $value) { $result.Add($item) }
    return $result.ToArray()
  }
  if ($value -is [${flexClassName}]) {
    $itemsKey = $value.Values.Keys | Where-Object { $_ -like '*_items' } | Select-Object -First 1
    $sizeKey = $value.Values.Keys | Where-Object { $_ -like '*_size' } | Select-Object -First 1
    if ($null -eq $itemsKey -or $null -eq $sizeKey) { return @() }
    $size = [int](Value $value $sizeKey)
    $array = Value $value $itemsKey
    $result = New-Object 'System.Collections.Generic.List[object]'
    for ($i = 0; $i -lt $size; $i++) {
      if ($null -ne $array[$i]) { $result.Add($array[$i]) }
    }
    return $result.ToArray()
  }
  return @()
}

function Convert-Unit($unit) {
  [ordered]@{
    id = Scalar (Value $unit "id_unidad")
    description = Scalar (Value $unit "descripcion_unidad")
    abbreviation = Scalar (Value $unit "abreviatura_unidad")
  }
}

function Convert-Composition($composition) {
  [ordered]@{
    id = Scalar (Value $composition "id_composicion")
    description = Scalar (Value $composition "descripcion_composicion")
    unitId = Scalar (Value $composition "id_unidad")
    quantity = Scalar (Value $composition "cantidad_composicion")
    unitPrice = Scalar (Value $composition "costo_composicion")
    partial = Scalar (Value $composition "parcial_composicion")
    resourceCode = Scalar (Value $composition "codigo_crepco")
    listPriceId = Scalar (Value $composition "id_listaprecio")
  }
}

function Convert-Subtotal($subtotal) {
  $compositions = New-Object System.Collections.ArrayList
  foreach ($composition in (Items (Value $subtotal "Composiciones"))) {
    [void]$compositions.Add((Convert-Composition $composition))
  }
  [ordered]@{
    typeId = Scalar (Value $subtotal "id_tipocosto")
    subtotal = Scalar (Value $subtotal "subtotal")
    compositions = $compositions
  }
}

function Convert-Analysis($analysis) {
  if ($null -eq $analysis) { return $null }
  $subtotals = New-Object System.Collections.ArrayList
  foreach ($subtotal in (Items (Value $analysis "Subtotales"))) {
    [void]$subtotals.Add((Convert-Subtotal $subtotal))
  }
  [ordered]@{
    productivity = Scalar (Value $analysis "productividad")
    subtotals = $subtotals
  }
}

function Convert-Cost($cost) {
  $children = New-Object System.Collections.ArrayList
  foreach ($child in (Items (Value $cost "Subcostos"))) {
    [void]$children.Add((Convert-Cost $child))
  }
  [ordered]@{
    id = Scalar (Value $cost "id_costounitario")
    description = Scalar (Value $cost "descripcion_costo")
    unitId = Scalar (Value $cost "id_unidad")
    code = Scalar (Value $cost "numeracion_costo")
    productivity = Scalar (Value $cost "productividad")
    unitPrice = Scalar (Value $cost "costo_unitario")
    quantity = Scalar (Value $cost "cantidad")
    partial = Scalar (Value $cost "parcial_costo")
    analysisId = Scalar (Value $cost "id_analisiscosto")
    analysis = Convert-Analysis (Value $cost "AnalisisCosto")
    children = $children
  }
}

function Convert-Budget($budget) {
  $costs = New-Object System.Collections.ArrayList
  foreach ($cost in (Items (Value $budget "Costos"))) {
    [void]$costs.Add((Convert-Cost $cost))
  }
  [ordered]@{
    id = Scalar (Value $budget "id_presupuesto")
    name = Scalar (Value $budget "nombre_presupuesto")
    directCost = Scalar (Value $budget "costo_directo")
    total = Scalar (Value $budget "total_presupuesto")
    generalExpensesRate = Scalar (Value $budget "porcentaje_gasto")
    utilityRate = Scalar (Value $budget "porcentaje_utilidad")
    taxRate = Scalar (Value $budget "porcentaje_igv")
    generalExpensesAmount = Scalar (Value $budget "monto_gasto")
    utilityAmount = Scalar (Value $budget "monto_utilidad")
    taxAmount = Scalar (Value $budget "monto_igv")
    subtotal = Scalar (Value $budget "parcial_presupuesto")
    costs = $costs
  }
}

$root = [${probeClassName}]::Load($InputPath)
$project = Value $root "proyecto"
$units = New-Object System.Collections.ArrayList
foreach ($unit in (Items (Value $root "unidades"))) {
  [void]$units.Add((Convert-Unit $unit))
}
$budgets = New-Object System.Collections.ArrayList
foreach ($budget in (Items (Value $project "Presupuestos"))) {
  [void]$budgets.Add((Convert-Budget $budget))
}
$result = [ordered]@{
  project = [ordered]@{
    id = Scalar (Value $project "id_proyecto")
    name = Scalar (Value $project "nombre_proyecto")
  }
  units = $units
  budgets = $budgets
}

$result | ConvertTo-Json -Depth 100 -Compress
`;
