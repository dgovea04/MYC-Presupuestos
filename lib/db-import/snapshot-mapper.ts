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
import type { DbImportedBudgetItem, DbImportedProject, DbImportedSubBudget } from "@/lib/db-import/types";

const sourceBudgetCode = "DB";
const moneyDecimals = 4;
const rateDecimals = 8;

export function convertDbProjectToS10Snapshot(project: DbImportedProject): S10ExportSnapshot {
  const subBudgets = project.subBudgets.length > 0
    ? project.subBudgets
    : [{ id: "general", name: "GENERAL", order: 0, items: [] } satisfies DbImportedSubBudget];
  const warnings = new Set(project.warnings);
  const normalizedSubBudgets = subBudgets.map((subBudget) => normalizeSubBudget(subBudget, warnings));
  const budgetRows: S10SubpresupuestoRow[] = [];
  const partidaRows: S10PartidaRow[] = [];
  const detailRows: S10SubpresupuestoDetalleRow[] = [];
  const levelRows: S10BudgetLevelRow[] = [];
  const apuRows: S10ApuDetalleRow[] = [];

  for (const [subBudgetIndex, subBudget] of normalizedSubBudgets.entries()) {
    const subBudgetCode = createSubBudgetCode(subBudget, subBudgetIndex);
    budgetRows.push({
      CodPresupuesto: sourceBudgetCode,
      CodSubpresupuesto: subBudgetCode,
      Descripcion: subBudget.name,
    });

    const levels = createLevelRows(subBudget.items, subBudgetCode, warnings);
    levelRows.push(...levels);
    const levelByItemId = createLevelLookup(subBudget.items, levels);

    for (const [itemIndex, item] of subBudget.items.entries()) {
      if (item.isTitle) {
        continue;
      }

      const partidaCode = `DB-${item.id}`;
      const quantity = toDecimal(item.quantity);
      const unitPrice = toDecimal(item.unitPrice);
      const partial = toDecimal(item.partial).equals(0) && !quantity.equals(0) && !unitPrice.equals(0)
        ? quantity.times(unitPrice)
        : toDecimal(item.partial);
      const levelCode = levelByItemId.get(item.id) ?? null;
      const itemCode = item.code || partidaCode;

      partidaRows.push({
        CodPresupuesto: sourceBudgetCode,
        CodSubpresupuesto: subBudgetCode,
        CodPartida: partidaCode,
        Descripcion: item.description,
        CodUnidad: item.unit,
        Precio1: roundMoney(unitPrice),
        RendimientoMO: roundRate(item.productivity ?? "1"),
        RendimientoEQ: 0,
      });
      detailRows.push({
        CodPresupuesto: sourceBudgetCode,
        CodSubpresupuesto: subBudgetCode,
        Tipo: 1,
        Item: itemCode,
        Orden: itemCode,
        Secuencial: itemIndex + 1,
        Descripcion: item.description,
        Unidad: item.unit,
        Metrado: roundRate(quantity),
        MetradoBase: roundRate(quantity),
        Precio1: roundMoney(unitPrice),
        Parcial1: roundMoney(partial),
        Nivel: item.level,
        CodPartida: partidaCode,
        CodPresupuestoPartida: sourceBudgetCode,
        PropioPartida: "01",
        LevelCode: levelCode,
      });

      for (const [apuIndex, apu] of item.apuRows.entries()) {
        apuRows.push({
          CodPresupuesto: sourceBudgetCode,
          CodSubpresupuesto: subBudgetCode,
          CodPartida: partidaCode,
          CodPresupuestoPartida: sourceBudgetCode,
          PropioPartida: "01",
          CodInsumo: apu.code || `DB-RESOURCE-${apu.resourceId}`,
          Descripcion: apu.description,
          CodUnidad: apu.unit,
          CodIndiceUnificado: findResourceIndex(project, apu.resourceId),
          Cantidad: roundRate(apu.quantity),
          Precio1: roundMoney(apu.unitPrice),
          Parcial1: roundMoney(apu.partial),
          Tipo: normalizeResourceType(apu.type, apu.unit, apu.description),
        });

        if (apuRows[apuRows.length - 1]?.CodInsumo.length === 0) {
          warnings.add(`La partida ${itemCode} contiene una fila APU sin codigo de recurso; se uso un identificador temporal.`);
        }

        void apuIndex;
      }
    }
  }

  if (partidaRows.length === 0) {
    throw new Error(`El proyecto ${project.name} no contiene partidas importables.`);
  }

  const footer = createFooterRows(normalizedSubBudgets, project, warnings);
  warnings.add("Los totales del pie se reconstruyeron a partir de los parciales de las partidas porque el schema .db no expone totales oficiales del proyecto.");
  const directCost = normalizedSubBudgets.reduce(
    (sum, subBudget) => sum.plus(subBudget.items.filter((item) => !item.isTitle).reduce((itemSum, item) => itemSum.plus(toDecimal(item.partial)), new Decimal(0))),
    new Decimal(0),
  );
  const totalRow = footer.resultadoRows.find((row) => row.CodSubpresupuesto === "999" && row.Linea === "06")
    ?? (normalizedSubBudgets.length === 1
      ? footer.resultadoRows.find((row) => row.CodSubpresupuesto === createSubBudgetCode(normalizedSubBudgets[0]!, 0) && row.Linea === "06")
      : undefined);
  const total = totalRow?.Valor1 ?? roundMoney(directCost);
  project.warnings.splice(0, project.warnings.length, ...warnings);

  return {
    presupuestos: [{
      CodPresupuesto: sourceBudgetCode,
      Descripcion: project.name,
      Moneda: project.currency ?? "S/.",
      CostoOferta1: total,
    } satisfies S10PresupuestoRow],
    subpresupuestos: budgetRows,
    partidas: partidaRows,
    budgetLevels: levelRows,
    subpresupuestoDetalles: detailRows,
    apuDetalles: apuRows,
    pieSubpresupuestos: footer.pieRows,
    resultadoPieSubpresupuestos: footer.resultadoRows,
  };
}

function normalizeSubBudget(subBudget: DbImportedSubBudget, warnings: Set<string>) {
  const items = subBudget.items.slice().sort((left, right) => left.order - right.order);
  if (items.some((item) => item.isTitle && item.level <= 0)) {
    warnings.add(`El subpresupuesto ${subBudget.name} contiene titulos sin nivel valido.`);
  }

  return { ...subBudget, items };
}

function createLevelRows(items: DbImportedBudgetItem[], subBudgetCode: string, warnings: Set<string>) {
  const titles = items.filter((item) => item.isTitle);
  const levels: S10BudgetLevelRow[] = [];
  const previousLevels: Array<{ code: string; level: number }> = [];

  for (const [index, title] of titles.entries()) {
    const code = title.code || `${subBudgetCode}.${index + 1}`;
    const parent = [...previousLevels].reverse().find((candidate) => candidate.level < title.level);
    levels.push({
      CodPresupuesto: sourceBudgetCode,
      CodSubpresupuesto: subBudgetCode,
      Codigo: code,
      Descripcion: title.description,
      Nivel: Math.max(1, title.level),
      Tipo: title.level <= 1 ? "TITLE" : "SUBTITLE",
      ParentCodigo: parent?.code ?? null,
      Orden: code,
      SortOrder: title.order,
    });
    previousLevels.push({ code, level: title.level });
    while (previousLevels.length > 0 && (previousLevels[previousLevels.length - 1]?.level ?? 0) > title.level) {
      previousLevels.pop();
    }
  }

  if (levels.length === 0) {
    warnings.add(`El subpresupuesto ${subBudgetCode} no contiene titulos; MC creara un nivel raiz.`);
  }

  return levels;
}

function createLevelLookup(items: DbImportedBudgetItem[], levels: S10BudgetLevelRow[]) {
  const lookup = new Map<string, string>();
  const titles = items.filter((item) => item.isTitle).sort((left, right) => left.order - right.order);
  let titleIndex = 0;
  let current: S10BudgetLevelRow | undefined;

  for (const item of items.slice().sort((left, right) => left.order - right.order)) {
    if (item.isTitle) {
      current = levels[titleIndex];
      titleIndex += 1;
      continue;
    }

    const title = [...titles].reverse().find((candidate) => candidate.order < item.order && candidate.level < item.level + 1);
    const matchingLevel = title ? levels.find((level) => level.Codigo === title.code) : current;
    if (matchingLevel) {
      lookup.set(item.id, matchingLevel.Codigo);
    }
  }

  return lookup;
}

function createSubBudgetCode(subBudget: DbImportedSubBudget, index: number) {
  const numericId = String(subBudget.id).match(/\d+/)?.[0];
  return numericId ? `DB-${numericId}` : `DB-${index + 1}`;
}

function createFooterRows(subBudgets: DbImportedSubBudget[], project: DbImportedProject, warnings: Set<string>) {
  const pieRows: S10PieSubpresupuestoRow[] = [];
  const resultadoRows: S10ResultadoPieSubpresupuestoRow[] = [];
  const generalRows: Array<{ direct: Decimal; generalExpenses: Decimal; utility: Decimal; subtotal: Decimal; tax: Decimal; total: Decimal }> = [];

  for (const [index, subBudget] of subBudgets.entries()) {
    const code = createSubBudgetCode(subBudget, index);
    const direct = subBudget.items.filter((item) => !item.isTitle).reduce((sum, item) => sum.plus(toDecimal(item.partial)), new Decimal(0));
    const rates = createRates(project);
    const generalExpenses = direct.times(rates.generalExpensesRate);
    const utility = direct.times(rates.utilityRate);
    const subtotal = direct.plus(generalExpenses).plus(utility);
    const tax = subtotal.times(rates.taxRate);
    const total = subtotal.plus(tax);
    generalRows.push({ direct, generalExpenses, utility, subtotal, tax, total });
    appendFooterRows({ code, direct, generalExpenses, utility, subtotal, tax, total, rates, pieRows, resultadoRows });
  }

  if (subBudgets.length > 1) {
    const totals = generalRows.reduce(
      (sum, row) => ({
        direct: sum.direct.plus(row.direct),
        generalExpenses: sum.generalExpenses.plus(row.generalExpenses),
        utility: sum.utility.plus(row.utility),
        subtotal: sum.subtotal.plus(row.subtotal),
        tax: sum.tax.plus(row.tax),
        total: sum.total.plus(row.total),
      }),
      { direct: new Decimal(0), generalExpenses: new Decimal(0), utility: new Decimal(0), subtotal: new Decimal(0), tax: new Decimal(0), total: new Decimal(0) },
    );
    const rates = createRates(project);
    appendFooterRows({ code: "999", ...totals, rates, pieRows, resultadoRows });
  } else if (subBudgets.length === 1) {
    const only = generalRows[0];
    if (only && !project.generalExpensesRate && !project.utilityRate && !project.taxRate) {
      warnings.add("La base no contiene tasas de gastos generales, utilidad o IGV; se uso 0% para el pie del presupuesto.");
    }
  }

  return { pieRows, resultadoRows };
}

function appendFooterRows(input: {
  code: string;
  direct: Decimal;
  generalExpenses: Decimal;
  utility: Decimal;
  subtotal: Decimal;
  tax: Decimal;
  total: Decimal;
  rates: { generalExpensesRate: Decimal; utilityRate: Decimal; taxRate: Decimal };
  pieRows: S10PieSubpresupuestoRow[];
  resultadoRows: S10ResultadoPieSubpresupuestoRow[];
}) {
  const rows = [
    { line: "01", description: "COSTO DIRECTO", variable: "CD", formula: "CD", value: input.direct },
    { line: "02", description: `GASTOS GENERALES (${formatPercent(input.rates.generalExpensesRate)}%)`, variable: "PGG", formula: `CD*${input.rates.generalExpensesRate.toString()}`, value: input.generalExpenses },
    { line: "03", description: `UTILIDAD (${formatPercent(input.rates.utilityRate)}%)`, variable: "UTI", formula: `CD*${input.rates.utilityRate.toString()}`, value: input.utility },
    { line: "04", description: "SUBTOTAL", variable: "ST", formula: "CD+PGG+UTI", value: input.subtotal },
    { line: "05", description: `IGV (${formatPercent(input.rates.taxRate)}%)`, variable: "IGV", formula: `ST*${input.rates.taxRate.toString()}`, value: input.tax },
    { line: "06", description: "TOTAL PRESUPUESTO", variable: "P_T", formula: "ST+IGV", value: input.total },
  ];

  for (const row of rows) {
    input.pieRows.push({
      CodPresupuesto: sourceBudgetCode,
      CodSubpresupuesto: input.code,
      Linea: row.line,
      Descripcion: row.description,
      Variable: row.variable,
      Formula: row.formula,
      Omitido: false,
    });
    input.resultadoRows.push({
      CodPresupuesto: sourceBudgetCode,
      CodSubpresupuesto: input.code,
      Linea: row.line,
      Descripcion: row.description,
      Formula: row.formula,
      Valor1: roundMoney(row.value),
    });
  }
}

function createRates(project: DbImportedProject) {
  return {
    generalExpensesRate: percentageToDecimal(project.generalExpensesRate),
    utilityRate: percentageToDecimal(project.utilityRate),
    taxRate: percentageToDecimal(project.taxRate ?? "18"),
  };
}

function findResourceIndex(project: DbImportedProject, resourceId: string) {
  return project.resources.find((resource) => resource.id === resourceId)?.unifiedIndexCode;
}

function normalizeResourceType(type: string, unit: string, description: string) {
  const normalizedType = type.trim().toUpperCase();
  const normalizedDescription = description.trim().toUpperCase();
  const normalizedUnit = unit.trim().toUpperCase();
  if (["MO", "LABOR", "MANO DE OBRA"].includes(normalizedType) || normalizedDescription.includes("MANO DE OBRA") || normalizedUnit === "HH") return "MO";
  if (["EQ", "EQUIPO", "EQUIPMENT"].includes(normalizedType) || normalizedDescription.includes("EQUIPO") || normalizedUnit === "HM") return "EQ";
  if (["HE", "TOOLS", "HERRAMIENTA"].includes(normalizedType) || normalizedDescription.includes("HERRAMIENTA") || normalizedUnit.startsWith("%")) return "HE";
  if (["SC", "SUBCONTRATO", "SUBCONTRACT"].includes(normalizedType) || normalizedDescription.includes("SUBCONTRAT")) return "SC";
  return "MA";
}

function normalizeUnit(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const upper = raw.toUpperCase();
  if (upper === "M2" || upper === "M²") return "m2";
  if (upper === "M3" || upper === "M³") return "m3";
  if (upper === "GLB" || upper === "GLOBAL") return "glb";
  if (upper === "UND" || upper === "UNIDAD") return "und";
  if (upper === "HH") return "hh";
  if (upper === "HM") return "hm";
  return raw || "und";
}

function formatPercent(value: Decimal) {
  return value.times(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString();
}

function percentageToDecimal(value: string | null | undefined) {
  const decimal = toDecimal(value);
  return decimal.dividedBy(100).toDecimalPlaces(rateDecimals, Decimal.ROUND_HALF_UP);
}

function decimalToNumber(value: string | null | undefined) {
  const decimal = toDecimal(value);
  return decimal.toDecimalPlaces(rateDecimals, Decimal.ROUND_HALF_UP).toNumber();
}

function toDecimal(value: string | number | null | undefined) {
  if (value == null || String(value).trim() === "") return new Decimal(0);
  return new Decimal(value);
}

function roundMoney(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(moneyDecimals, Decimal.ROUND_HALF_UP).toNumber();
}

function roundRate(value: Decimal.Value) {
  return new Decimal(value).toDecimalPlaces(rateDecimals, Decimal.ROUND_HALF_UP).toNumber();
}

void normalizeUnit;
void decimalToNumber;
