import Decimal from "decimal.js";
import type { ApuRecord, ApuResourceRecord } from "@/types/apu";
import type { BudgetItemRecord, BudgetLevelRecord, BudgetRecord } from "@/types/budget";
import type { ResourceCategory, ResourceRecord } from "@/types/resource";
import { calculateBudgetItemApu, calculateBudgetRecord } from "@/lib/calculations/budget";
import { calculateBudgetFooterBuilder } from "@/lib/calculations/budget-footer-builder";
import type { BudgetFooterRowRecord } from "@/lib/budget-footer/types";

export type S10PresupuestoRow = {
  CodPresupuesto: string;
  Descripcion: string;
  Moneda?: string | null;
  CostoOferta1?: number | null;
};

export type S10SubpresupuestoRow = {
  CodPresupuesto: string;
  CodSubpresupuesto: string;
  Descripcion: string;
};

export type S10PartidaRow = {
  CodPresupuesto: string;
  CodSubpresupuesto: string;
  CodPartida: string;
  Descripcion: string;
  CodUnidad?: string | null;
  Precio1?: number | null;
  RendimientoMO?: number | null;
  RendimientoEQ?: number | null;
};

export type S10SubpresupuestoDetalleRow = {
  CodPresupuesto: string;
  CodSubpresupuesto: string;
  Tipo?: number | null;
  Item?: string | null;
  Orden?: string | null;
  Secuencial?: number | null;
  Descripcion: string;
  Unidad?: string | null;
  Metrado?: number | null;
  MetradoBase?: number | null;
  Precio1?: number | null;
  Parcial1?: number | null;
  ManoDeObra1?: number | null;
  Material1?: number | null;
  Equipo1?: number | null;
  Subcontrato1?: number | null;
  Subpartida1?: number | null;
  Nivel?: number | null;
  CodPartida?: string | null;
  CodPresupuestoPartida?: string | null;
  PropioPartida?: string | null;
  LevelCode?: string | null;
};

export type S10BudgetLevelRow = {
  CodPresupuesto: string;
  CodSubpresupuesto: string;
  Codigo: string;
  Descripcion: string;
  Nivel?: number | null;
  Tipo?: BudgetLevelRecord["type"] | null;
  ParentCodigo?: string | null;
  Orden?: string | null;
  SortOrder?: number | null;
};

export type S10ApuDetalleRow = {
  CodPresupuesto: string;
  CodSubpresupuesto: string;
  CodPartida: string;
  CodPresupuestoPartida?: string | null;
  PropioPartida?: string | null;
  CodInsumo: string;
  Descripcion: string;
  CodUnidad?: string | null;
  CodIndiceUnificado?: string | null;
  Cantidad?: number | null;
  Precio1?: number | null;
  Parcial1?: number | null;
  Tipo?: string | null;
};

export type S10PieSubpresupuestoRow = {
  CodPresupuesto: string;
  CodSubpresupuesto: string;
  Linea: string;
  Descripcion?: string | null;
  Variable?: string | null;
  Formula?: string | null;
  Omitido?: boolean | number | null;
};

export type S10ResultadoPieSubpresupuestoRow = {
  CodPresupuesto: string;
  CodSubpresupuesto: string;
  Linea: string;
  Descripcion?: string | null;
  Formula?: string | null;
  Valor1?: number | null;
  Valor2?: number | null;
  ValorConFactor?: number | null;
};

export type S10ExportSnapshot = {
  presupuestos: S10PresupuestoRow[];
  subpresupuestos: S10SubpresupuestoRow[];
  partidas: S10PartidaRow[];
  apuDetalles: S10ApuDetalleRow[];
  budgetLevels?: S10BudgetLevelRow[];
  subpresupuestoDetalles?: S10SubpresupuestoDetalleRow[];
  pieSubpresupuestos?: S10PieSubpresupuestoRow[];
  resultadoPieSubpresupuestos?: S10ResultadoPieSubpresupuestoRow[];
};

export type ImportSourceSystem = "S10" | "RW7" | "DELPHIN" | "DB";

export type S10ImportMapperOptions = {
  budgetCode?: string;
  companyId?: string;
  projectId?: string;
  defaultRates?: S10ImportDefaultRates;
  sourceSystem?: ImportSourceSystem;
};

export type S10ImportDefaultRates = {
  igvRate: number;
  generalExpensesRate: number;
  utilityRate: number;
};

export type MycS10ImportDraft = {
  source: ImportSourceSystem;
  sourceBudgetCode: string;
  project: {
    id: string;
    name: string;
    sourceCode: string;
  };
  resources: ResourceRecord[];
  budgets: BudgetRecord[];
  budgetFooterRows: S10BudgetFooterRowsDraft[];
  itemMetadata: S10ItemImportMetadata[];
  warnings: string[];
};

export type S10BudgetFooterRowsDraft = {
  budgetId: string;
  rows: S10BudgetFooterRowDraft[];
};

export type S10BudgetFooterRowDraft = {
  variable: string;
  description: string;
  formula?: string | null;
  manualValue: number;
  highlight: boolean;
  sortOrder: number;
};

export type S10ApuImportStatus = "OK" | "MISSING" | "PRICE_MISMATCH";

export type S10ItemImportMetadata = {
  budgetItemId: string;
  apuStatus: S10ApuImportStatus;
  s10UnitPrice: number;
  calculatedApuUnitPrice?: number;
  unitPriceDifference?: number;
};

const solCurrency = "PEN";
const moneyDecimals = 4;
const apuUnitPriceAbsoluteTolerance = new Decimal(0.05);
const apuUnitPriceRelativeTolerance = new Decimal(0.01);

const knownS10Units = new Map<string, string>([
  ["004", "%MO"],
  ["005", "%MT"],
  ["006", "bal"],
  ["011", "ciento"],
  ["015", "gal"],
  ["021", "kg"],
  ["024", "m"],
  ["025", "m2"],
  ["026", "m3"],
  ["030", "pie2"],
  ["032", "plancha"],
  ["034", "punto"],
  ["035", "pza"],
  ["037", "saco"],
  ["040", "u"],
  ["041", "varilla"],
  ["045", "bl"],
  ["047", "bolsa"],
  ["048", "cartucho"],
  ["049", "conjunto"],
  ["053", "gal"],
  ["054", "glb"],
  ["055", "hh"],
  ["056", "hm"],
  ["065", "m"],
  ["070", "pulg2"],
  ["082", "pie2"],
  ["101", "u"],
  ["103", "ciento"],
  ["201", "m"],
  ["202", "km"],
  ["301", "kg"],
  ["302", "t"],
  ["404", "dia"],
  ["405", "mes"],
  ["501", "m2"],
  ["503", "ha"],
  ["507", "pie2"],
  ["601", "m3"],
  ["603", "cm3"],
  ["604", "l"],
  ["605", "gal"],
  ["701", "%"],
  ["705", "%EQ"],
  ["707", "%MO"],
  ["708", "%MT"],
  ["901", "bolsa"],
  ["903", "plancha"],
  ["904", "punto"],
  ["906", "hh"],
  ["907", "hm"],
  ["909", "m3-km"],
  ["917", "est"],
  ["919", "glb"],
  ["920", "h-eq"],
  ["922", "hja"],
  ["923", "jgo"],
  ["931", "pza"],
  ["937", "tubo"],
  ["939", "viaje"],
]);

export function createMycImportDraftFromS10(snapshot: S10ExportSnapshot, options: S10ImportMapperOptions = {}): MycS10ImportDraft {
  const warnings = new Set<string>();
  const itemMetadata: S10ItemImportMetadata[] = [];
  const sourceSystem = options.sourceSystem ?? "S10";
  const sourcePrefix = sourceSystem.toLowerCase();
  const presupuesto = selectPresupuesto(snapshot.presupuestos, options.budgetCode);
  const sourceBudgetCode = presupuesto.CodPresupuesto;
  const projectId = options.projectId ?? createId(`${sourcePrefix}-project`, sourceBudgetCode);
  const currency = normalizeCurrency(presupuesto.Moneda);
  const subpresupuestos = snapshot.subpresupuestos
    .filter((subpresupuesto) => subpresupuesto.CodPresupuesto === sourceBudgetCode)
    .filter((subpresupuesto) => subpresupuesto.CodSubpresupuesto !== "999")
    .sort((left, right) => left.CodSubpresupuesto.localeCompare(right.CodSubpresupuesto));
  const partidas = snapshot.partidas.filter((partida) => partida.CodPresupuesto === sourceBudgetCode);
  const apuDetalles = snapshot.apuDetalles.filter((detalle) => detalle.CodPresupuesto === sourceBudgetCode);
  const budgetLevels = (snapshot.budgetLevels ?? []).filter((level) => level.CodPresupuesto === sourceBudgetCode);
  const subpresupuestoDetalles = (snapshot.subpresupuestoDetalles ?? []).filter(
    (detalle) => detalle.CodPresupuesto === sourceBudgetCode && isImportableSubpresupuestoDetalle(detalle),
  );
  const pieSubpresupuestos = (snapshot.pieSubpresupuestos ?? []).filter((row) => row.CodPresupuesto === sourceBudgetCode);
  const resultadoPieSubpresupuestos = (snapshot.resultadoPieSubpresupuestos ?? []).filter(
    (row) => row.CodPresupuesto === sourceBudgetCode,
  );
  const resources = createResources(apuDetalles, {
    companyId: options.companyId,
    currency,
    sourceSystem,
    sourcePrefix,
    warnings,
  });
  const { budgets, budgetFooterRows } = createBudgets({
    presupuesto,
    projectId,
    currency,
    subpresupuestos,
    partidas,
    budgetLevels,
    subpresupuestoDetalles,
    apuDetalles,
    pieSubpresupuestos,
    resultadoPieSubpresupuestos,
    defaultRates: options.defaultRates,
    sourceSystem,
    sourcePrefix,
    itemMetadata,
    warnings,
  });

  if (partidas.length > 0 && subpresupuestoDetalles.length === 0) {
    warnings.add(`No se encontraron metrados directos de partida en el snapshot ${sourceSystem}; se uso cantidad 1 en cada item importado.`);
  }

  return {
    source: sourceSystem,
    sourceBudgetCode,
    project: {
      id: projectId,
      name: cleanText(presupuesto.Descripcion),
      sourceCode: sourceBudgetCode,
    },
    resources,
    budgets,
    budgetFooterRows,
    itemMetadata,
    warnings: Array.from(warnings),
  };
}

export function normalizeS10Unit(value: string | number | null | undefined) {
  const raw = String(value ?? "").trim();
  if (raw.length === 0) {
    return "";
  }

  return knownS10Units.get(raw) ?? raw;
}

function selectPresupuesto(presupuestos: S10PresupuestoRow[], budgetCode?: string) {
  if (budgetCode) {
    const selected = presupuestos.find((presupuesto) => presupuesto.CodPresupuesto === budgetCode);
    if (!selected) {
      throw new Error(`No se encontro el presupuesto S10 ${budgetCode}.`);
    }
    return selected;
  }

  const [selected] = [...presupuestos].sort((left, right) => {
    const rightCost = toDecimal(right.CostoOferta1).toNumber();
    const leftCost = toDecimal(left.CostoOferta1).toNumber();
    return rightCost - leftCost;
  });

  if (!selected) {
    throw new Error("El snapshot S10 no contiene presupuestos.");
  }

  return selected;
}

function createResources(
  apuDetalles: S10ApuDetalleRow[],
  options: { companyId?: string; currency: string; sourceSystem: ImportSourceSystem; sourcePrefix: string; warnings: Set<string> },
) {
  const resourcesByCode = new Map<string, ResourceRecord>();

  for (const detalle of apuDetalles) {
    const code = cleanText(detalle.CodInsumo);
    if (resourcesByCode.has(code)) {
      continue;
    }

    const unit = normalizeKnownUnit(detalle.CodUnidad, options.warnings);
    const category = inferResourceCategory(detalle, unit);
    resourcesByCode.set(code, {
      id: createId(`${options.sourcePrefix}-resource`, code),
      companyId: options.companyId ?? null,
      code,
      description: cleanText(detalle.Descripcion),
      category,
      iu: cleanOptionalText(detalle.CodIndiceUnificado),
      unit,
      unitPrice: roundMoney(detalle.Precio1),
      currency: options.currency,
      source: options.sourceSystem,
    });
  }

  return Array.from(resourcesByCode.values()).sort((left, right) => left.code.localeCompare(right.code));
}

function createBudgets(input: {
  presupuesto: S10PresupuestoRow;
  projectId: string;
  currency: string;
  subpresupuestos: S10SubpresupuestoRow[];
  partidas: S10PartidaRow[];
  budgetLevels: S10BudgetLevelRow[];
  subpresupuestoDetalles: S10SubpresupuestoDetalleRow[];
  apuDetalles: S10ApuDetalleRow[];
  pieSubpresupuestos: S10PieSubpresupuestoRow[];
  resultadoPieSubpresupuestos: S10ResultadoPieSubpresupuestoRow[];
  defaultRates?: S10ImportDefaultRates;
  sourceSystem: ImportSourceSystem;
  sourcePrefix: string;
  itemMetadata: S10ItemImportMetadata[];
  warnings: Set<string>;
}) {
  const budgetFooterRows: S10BudgetFooterRowsDraft[] = [];
  const subBudgets = input.subpresupuestos.map((subpresupuesto, index) =>
    createSubBudgetRecord({
      presupuesto: input.presupuesto,
      subpresupuesto,
      projectId: input.projectId,
      currency: input.currency,
      partidas: input.partidas.filter((partida) => partida.CodSubpresupuesto === subpresupuesto.CodSubpresupuesto),
      budgetLevels: input.budgetLevels.filter((level) => level.CodSubpresupuesto === subpresupuesto.CodSubpresupuesto),
      subpresupuestoDetalles: input.subpresupuestoDetalles.filter(
        (detalle) => detalle.CodSubpresupuesto === subpresupuesto.CodSubpresupuesto,
      ),
      apuDetalles: input.apuDetalles.filter((detalle) => detalle.CodSubpresupuesto === subpresupuesto.CodSubpresupuesto),
      pieSubpresupuestos: input.pieSubpresupuestos.filter((row) => row.CodSubpresupuesto === subpresupuesto.CodSubpresupuesto),
      resultadoPieSubpresupuestos: input.resultadoPieSubpresupuestos.filter(
        (row) => row.CodSubpresupuesto === subpresupuesto.CodSubpresupuesto,
      ),
      fallbackPieSubpresupuestos: input.pieSubpresupuestos.filter((row) => row.CodSubpresupuesto === "999"),
      itemMetadata: input.itemMetadata,
      sortOrderOffset: index * 100000,
      defaultRates: input.defaultRates,
      sourceSystem: input.sourceSystem,
      sourcePrefix: input.sourcePrefix,
      warnings: input.warnings,
    }),
  );

  const generalPieRows = selectGeneralPieRows({
    presupuesto: input.presupuesto,
    subBudgets,
    pieSubpresupuestos: input.pieSubpresupuestos,
    resultadoPieSubpresupuestos: input.resultadoPieSubpresupuestos,
  });
  const generalRates = inferRatesFromResultadoPie(generalPieRows.resultadoRows, input.defaultRates, generalPieRows.pieRows);
  const generalBudget = calculateBudgetRecord({
    id: createId(`${input.sourcePrefix}-budget`, input.presupuesto.CodPresupuesto),
    projectId: input.projectId,
    parentBudgetId: null,
    kind: "GENERAL",
    name: cleanText(input.presupuesto.Descripcion),
    currency: input.currency,
    igvRate: generalRates.igvRate,
    generalExpensesRate: generalRates.generalExpensesRate,
    utilityRate: generalRates.utilityRate,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels: input.subpresupuestos.map((subpresupuesto, index) => ({
      id: createId(`${input.sourcePrefix}-level`, input.presupuesto.CodPresupuesto, subpresupuesto.CodSubpresupuesto),
      budgetId: createId(`${input.sourcePrefix}-budget`, input.presupuesto.CodPresupuesto),
      parentId: null,
      type: "TITLE",
      code: subpresupuesto.CodSubpresupuesto,
      name: cleanText(subpresupuesto.Descripcion),
      sortOrder: index + 1,
    })),
    items: subBudgets.flatMap((budget, index) =>
      budget.items.map((item, itemIndex) => ({
        ...item,
        id: createId(`${input.sourcePrefix}-general-item`, input.presupuesto.CodPresupuesto, item.code, String(index), String(itemIndex)),
        budgetId: createId(`${input.sourcePrefix}-budget`, input.presupuesto.CodPresupuesto),
        levelId: createId(`${input.sourcePrefix}-level`, input.presupuesto.CodPresupuesto, input.subpresupuestos[index]?.CodSubpresupuesto ?? "0"),
        apu: null,
        sortOrder: index * 100000 + itemIndex + 1,
      })),
    ),
  });

  budgetFooterRows.push(createFooterRowsDraft(generalBudget.id, generalPieRows.pieRows, generalPieRows.resultadoRows, generalBudget));
  for (const budget of subBudgets) {
    budgetFooterRows.push(createFooterRowsDraft(budget.id, budget.__s10PieRows ?? [], budget.__s10ResultadoPieRows ?? [], budget));
    delete budget.__s10PieRows;
    delete budget.__s10ResultadoPieRows;
  }

  return { budgets: [generalBudget, ...subBudgets], budgetFooterRows };
}

type S10SubBudgetRecordWithPie = BudgetRecord & {
  __s10PieRows?: S10PieSubpresupuestoRow[];
  __s10ResultadoPieRows?: S10ResultadoPieSubpresupuestoRow[];
};

function createSubBudgetRecord(input: {
  presupuesto: S10PresupuestoRow;
  subpresupuesto: S10SubpresupuestoRow;
  projectId: string;
  currency: string;
  partidas: S10PartidaRow[];
  budgetLevels: S10BudgetLevelRow[];
  subpresupuestoDetalles: S10SubpresupuestoDetalleRow[];
  apuDetalles: S10ApuDetalleRow[];
  pieSubpresupuestos: S10PieSubpresupuestoRow[];
  resultadoPieSubpresupuestos: S10ResultadoPieSubpresupuestoRow[];
  fallbackPieSubpresupuestos: S10PieSubpresupuestoRow[];
  itemMetadata: S10ItemImportMetadata[];
  sortOrderOffset: number;
  defaultRates?: S10ImportDefaultRates;
  sourceSystem: ImportSourceSystem;
  sourcePrefix: string;
  warnings: Set<string>;
}): S10SubBudgetRecordWithPie {
  const budgetId = createId(`${input.sourcePrefix}-subbudget`, input.presupuesto.CodPresupuesto, input.subpresupuesto.CodSubpresupuesto);
  const levels = createSubBudgetLevels({
    budgetId,
    presupuesto: input.presupuesto,
    subpresupuesto: input.subpresupuesto,
    budgetLevels: input.budgetLevels,
    sourcePrefix: input.sourcePrefix,
  });
  const levelIdsByCode = new Map(levels.map((level) => [level.code, level.id]));
  const items =
    input.subpresupuestoDetalles.length > 0
      ? input.subpresupuestoDetalles
          .slice()
          .sort(compareSubpresupuestoDetalleRows)
          .map((detalle, index) =>
            createBudgetItemFromSubpresupuestoDetalle({
              detalle,
              partida: findPartidaForDetalle(input.partidas, detalle),
              budgetId,
              levelId: resolveLevelIdForDetalle(detalle, levelIdsByCode, levels[0]?.id ?? null),
              apuDetalles: input.apuDetalles.filter((apuDetalle) => matchesApuDetalleForSubpresupuestoDetalle(apuDetalle, detalle)),
              itemMetadata: input.itemMetadata,
              sortOrder: input.sortOrderOffset + index + 1,
              currency: input.currency,
              sourceSystem: input.sourceSystem,
              sourcePrefix: input.sourcePrefix,
              warnings: input.warnings,
            }),
          )
      : input.partidas.map((partida, index) =>
          createBudgetItem({
            partida,
            budgetId,
            levelId: levels[0]?.id ?? null,
            apuDetalles: input.apuDetalles.filter((detalle) => detalle.CodPartida === partida.CodPartida),
            itemMetadata: input.itemMetadata,
            sortOrder: input.sortOrderOffset + index + 1,
            currency: input.currency,
            sourceSystem: input.sourceSystem,
            sourcePrefix: input.sourcePrefix,
            warnings: input.warnings,
          }),
        );

  const footerPieRows = selectEffectivePieRows(input.pieSubpresupuestos, input.resultadoPieSubpresupuestos, input.fallbackPieSubpresupuestos);
  const rates = inferRatesFromResultadoPie(input.resultadoPieSubpresupuestos, input.defaultRates, footerPieRows);
  return {
    ...calculateBudgetRecord({
    id: budgetId,
    projectId: input.projectId,
    parentBudgetId: createId(`${input.sourcePrefix}-budget`, input.presupuesto.CodPresupuesto),
    kind: "SUB_BUDGET",
    name: cleanText(input.subpresupuesto.Descripcion),
    currency: input.currency,
    igvRate: rates.igvRate,
    generalExpensesRate: rates.generalExpensesRate,
    utilityRate: rates.utilityRate,
    totalDirectCost: 0,
    totalGeneralExpenses: 0,
    totalUtility: 0,
    totalTax: 0,
    totalAmount: 0,
    levels,
    items,
    }),
    __s10PieRows: footerPieRows,
    __s10ResultadoPieRows: input.resultadoPieSubpresupuestos,
  };
}

function createSubBudgetLevels(input: {
  budgetId: string;
  presupuesto: S10PresupuestoRow;
  subpresupuesto: S10SubpresupuestoRow;
  budgetLevels: S10BudgetLevelRow[];
  sourcePrefix: string;
}) {
  if (input.budgetLevels.length === 0) {
    return [
      {
        id: createId(`${input.sourcePrefix}-subbudget-level`, input.presupuesto.CodPresupuesto, input.subpresupuesto.CodSubpresupuesto),
        budgetId: input.budgetId,
        parentId: null,
        type: "TITLE",
        code: input.subpresupuesto.CodSubpresupuesto,
        name: cleanText(input.subpresupuesto.Descripcion),
        sortOrder: 1,
      },
    ] satisfies BudgetLevelRecord[];
  }

  const sortedLevels = input.budgetLevels.slice().sort(compareBudgetLevelRows);
  const levelIdsByCode = new Map(
    sortedLevels.map((level) => [
      cleanText(level.Codigo),
      createId(
        `${input.sourcePrefix}-subbudget-level`,
        input.presupuesto.CodPresupuesto,
        input.subpresupuesto.CodSubpresupuesto,
        cleanText(level.Codigo),
      ),
    ]),
  );

  return sortedLevels.map((level, index): BudgetLevelRecord => {
    const code = cleanText(level.Codigo);
    const parentCode = cleanOptionalText(level.ParentCodigo);
    const depth = toDecimal(level.Nivel).toNumber();

    return {
      id: levelIdsByCode.get(code) ?? createId(`${input.sourcePrefix}-subbudget-level`, input.presupuesto.CodPresupuesto, input.subpresupuesto.CodSubpresupuesto, code),
      budgetId: input.budgetId,
      parentId: parentCode == null ? null : levelIdsByCode.get(parentCode) ?? null,
      type: level.Tipo ?? (depth <= 1 ? "TITLE" : "SUBTITLE"),
      code,
      name: cleanText(level.Descripcion),
      sortOrder: toDecimal(level.SortOrder ?? index + 1).toNumber(),
    };
  });
}

function compareBudgetLevelRows(left: S10BudgetLevelRow, right: S10BudgetLevelRow) {
  const sortComparison = toDecimal(left.SortOrder).comparedTo(toDecimal(right.SortOrder));
  if (sortComparison !== 0) {
    return sortComparison;
  }

  const orderComparison = cleanText(left.Orden ?? "").localeCompare(cleanText(right.Orden ?? ""), "es", { numeric: true });
  if (orderComparison !== 0) {
    return orderComparison;
  }

  return cleanText(left.Codigo).localeCompare(cleanText(right.Codigo), "es", { numeric: true });
}

function resolveLevelIdForDetalle(detalle: S10SubpresupuestoDetalleRow, levelIdsByCode: Map<string, string>, fallbackLevelId: string | null) {
  const exactCode = cleanOptionalText(detalle.LevelCode);
  if (exactCode != null) {
    return levelIdsByCode.get(exactCode) ?? fallbackLevelId;
  }

  const item = cleanText(detalle.Item ?? "");
  const parts = item.split(".").filter(Boolean);
  for (let depth = parts.length - 1; depth >= 1; depth -= 1) {
    const candidate = parts.slice(0, depth).join(".");
    const levelId = levelIdsByCode.get(candidate);
    if (levelId) {
      return levelId;
    }
  }

  return fallbackLevelId;
}

function createBudgetItemFromSubpresupuestoDetalle(input: {
  detalle: S10SubpresupuestoDetalleRow;
  partida?: S10PartidaRow;
  budgetId: string;
  levelId: string | null;
  apuDetalles: S10ApuDetalleRow[];
  itemMetadata: S10ItemImportMetadata[];
  sortOrder: number;
  currency: string;
  sourceSystem: ImportSourceSystem;
  sourcePrefix: string;
  warnings: Set<string>;
}): BudgetItemRecord {
  const codPartida = cleanText(input.detalle.CodPartida ?? "");
  const description = cleanOptionalText(input.detalle.Descripcion) ?? cleanOptionalText(input.partida?.Descripcion) ?? codPartida;
  const unit = normalizeKnownUnit(cleanOptionalText(input.detalle.Unidad) ?? input.partida?.CodUnidad, input.warnings);
  const partida = {
    CodPresupuesto: input.detalle.CodPresupuesto,
    CodSubpresupuesto: input.detalle.CodSubpresupuesto,
    CodPartida: codPartida,
    Descripcion: description,
    CodUnidad: unit,
    Precio1: input.detalle.Precio1 ?? input.partida?.Precio1,
    RendimientoMO: input.partida?.RendimientoMO,
    RendimientoEQ: input.partida?.RendimientoEQ,
  };
  const item = createBudgetItem({
    partida,
    budgetId: input.budgetId,
    levelId: input.levelId,
    apuDetalles: input.apuDetalles,
    sortOrder: input.sortOrder,
    currency: input.currency,
    sourceSystem: input.sourceSystem,
    sourcePrefix: input.sourcePrefix,
    warnings: input.warnings,
    quantity: roundRate(input.detalle.Metrado),
  });
  const partial = roundMoney(input.detalle.Parcial1 ?? new Decimal(item.quantity).times(item.unitPrice));
  let apuResolution = resolveApuImportStatus(item.apu, item.unitPrice, input.warnings, { suppressWarning: true });
  const legacyComponentApu = createLegacyComponentApuForDetalle({
    item,
    detalle: input.detalle,
    partida,
    unit,
    currency: input.currency,
    sourceSystem: input.sourceSystem,
    sourcePrefix: input.sourcePrefix,
  });
  if (apuResolution.status !== "OK" && legacyComponentApu) {
    apuResolution = resolveApuImportStatus(legacyComponentApu, item.unitPrice, input.warnings, { suppressWarning: true });
  }
  if (apuResolution.status !== "OK") {
    apuResolution = resolveApuImportStatus(apuResolution.apu ?? legacyComponentApu ?? item.apu, item.unitPrice, input.warnings);
  }
  input.itemMetadata.push({
    budgetItemId: item.id,
    apuStatus: apuResolution.status,
    s10UnitPrice: item.unitPrice,
    calculatedApuUnitPrice: apuResolution.calculatedApuUnitPrice,
    unitPriceDifference: apuResolution.unitPriceDifference,
  });

  return {
    ...item,
    code: cleanText(input.detalle.Item ?? codPartida),
    description,
    apu: apuResolution.apu,
    unitPrice: roundMoney(input.detalle.Precio1 ?? item.unitPrice),
    partial,
  };
}

function createLegacyComponentApuForDetalle(input: {
  item: BudgetItemRecord;
  detalle: S10SubpresupuestoDetalleRow;
  partida: S10PartidaRow;
  unit: string;
  currency: string;
  sourceSystem: ImportSourceSystem;
  sourcePrefix: string;
}): ApuRecord | null {
  const quantity = toDecimal(input.detalle.Metrado);
  if (quantity.lessThanOrEqualTo(0)) {
    return null;
  }

  const components = [
    { key: "labor", label: "MANO DE OBRA S10", category: "LABOR", value: input.detalle.ManoDeObra1 },
    { key: "material", label: "MATERIALES S10", category: "MATERIAL", value: input.detalle.Material1 },
    { key: "equipment", label: "EQUIPOS S10", category: "EQUIPMENT", value: input.detalle.Equipo1 },
    { key: "subcontract", label: "SUBCONTRATOS S10", category: "SUBCONTRACT", value: input.detalle.Subcontrato1 },
    { key: "subpartida", label: "SUBPARTIDAS S10", category: "SUBPARTIDA", value: input.detalle.Subpartida1 },
  ] as const;
  const apuId = createId(
    `${input.sourcePrefix}-apu-component`,
    input.detalle.CodPresupuesto,
    input.detalle.CodSubpresupuesto,
    cleanText(input.detalle.Item ?? input.partida.CodPartida),
  );
  const resources: ApuResourceRecord[] = [];

  for (const component of components) {
    const subtotal = toDecimal(component.value);
    if (subtotal.equals(0)) {
      continue;
    }

    const unitAmount = roundMoney(subtotal.dividedBy(quantity));
    resources.push({
      id: createId(`${input.sourcePrefix}-apu-component-row`, apuId, component.key),
      apuId,
      resourceId: null,
      resourceType: component.category,
      description: component.label,
      unit: input.unit,
      crew: null,
      quantity: 1,
      unitPrice: unitAmount,
      subtotal: unitAmount,
    });
  }

  if (resources.length === 0) {
    return null;
  }

  return {
    id: apuId,
    budgetItemId: input.item.id,
    name: input.partida.Descripcion,
    unit: input.unit,
    performance: resolvePerformance(input.partida),
    totalUnitCost: roundMoney(resources.reduce((sum, row) => sum.plus(row.subtotal), new Decimal(0))),
    resources,
  };
}

function createBudgetItem(input: {
  partida: S10PartidaRow;
  budgetId: string;
  levelId: string | null;
  apuDetalles: S10ApuDetalleRow[];
  itemMetadata?: S10ItemImportMetadata[];
  sortOrder: number;
  currency: string;
  sourceSystem: ImportSourceSystem;
  sourcePrefix: string;
  warnings: Set<string>;
  quantity?: number;
}): BudgetItemRecord {
  const itemId = createId(
    `${input.sourcePrefix}-item`,
    input.partida.CodPresupuesto,
    input.partida.CodSubpresupuesto,
    input.partida.CodPartida,
    String(input.sortOrder),
  );
  const unit = normalizeKnownUnit(input.partida.CodUnidad, input.warnings);
  const quantity = input.quantity ?? 1;
  const unitPrice = roundMoney(input.partida.Precio1);
  const apu = createApu({
    itemId,
    partida: input.partida,
    unit,
    detalles: input.apuDetalles,
    currency: input.currency,
    sourceSystem: input.sourceSystem,
    sourcePrefix: input.sourcePrefix,
    warnings: input.warnings,
  });
  input.itemMetadata?.push({
    budgetItemId: itemId,
    apuStatus: apu.resources.length > 0 ? "OK" : "MISSING",
    s10UnitPrice: unitPrice,
    calculatedApuUnitPrice: apu.resources.length > 0 ? apu.totalUnitCost : undefined,
    unitPriceDifference: apu.resources.length > 0 ? 0 : undefined,
  });

  return {
    id: itemId,
    budgetId: input.budgetId,
    levelId: input.levelId,
    code: cleanText(input.partida.CodPartida),
    description: cleanText(input.partida.Descripcion),
    unit,
    quantity,
    unitPrice,
    partial: roundMoney(new Decimal(quantity).times(unitPrice)),
    sortOrder: input.sortOrder,
    apu,
  };
}

function findPartidaForDetalle(partidas: S10PartidaRow[], detalle: S10SubpresupuestoDetalleRow) {
  const codPartida = cleanText(detalle.CodPartida ?? "");
  const codPresupuestoPartida = cleanOptionalText(detalle.CodPresupuestoPartida);
  const exact = partidas.find(
    (partida) =>
      partida.CodPartida === codPartida &&
      (codPresupuestoPartida == null || partida.CodPresupuesto === codPresupuestoPartida),
  );

  return exact ?? partidas.find((partida) => partida.CodPartida === codPartida);
}

function matchesApuDetalleForSubpresupuestoDetalle(apuDetalle: S10ApuDetalleRow, detalle: S10SubpresupuestoDetalleRow) {
  if (apuDetalle.CodPartida !== detalle.CodPartida) {
    return false;
  }

  const detalleCodPresupuestoPartida = cleanOptionalText(detalle.CodPresupuestoPartida);
  const apuCodPresupuestoPartida = cleanOptionalText(apuDetalle.CodPresupuestoPartida);
  if (detalleCodPresupuestoPartida != null && apuCodPresupuestoPartida != null && apuCodPresupuestoPartida !== detalleCodPresupuestoPartida) {
    return false;
  }

  const detallePropioPartida = cleanOptionalText(detalle.PropioPartida);
  const apuPropioPartida = cleanOptionalText(apuDetalle.PropioPartida);
  if (detallePropioPartida != null && apuPropioPartida != null) {
    return apuPropioPartida === detallePropioPartida;
  }

  return true;
}

function resolveApuImportStatus(
  apu: ApuRecord | null | undefined,
  s10UnitPrice: number,
  warnings: Set<string>,
  options: { suppressWarning?: boolean } = {},
): {
  status: S10ApuImportStatus;
  apu: ApuRecord | null;
  calculatedApuUnitPrice?: number;
  unitPriceDifference?: number;
} {
  if (!apu) {
    return { status: "MISSING", apu: null };
  }

  const calculatedApu = calculateBudgetItemApu(apu);
  const difference = roundMoney(new Decimal(calculatedApu.totalUnitCost).minus(s10UnitPrice).abs());
  if (isWithinApuUnitPriceTolerance(difference, s10UnitPrice)) {
    return {
      status: "OK",
      apu: calculatedApu,
      calculatedApuUnitPrice: calculatedApu.totalUnitCost,
      unitPriceDifference: difference,
    };
  }

  if (!options.suppressWarning) {
    warnings.add("Algunos APUs no cuadran con el precio unitario del presupuesto; se preservo el PU/metrado/parcial de origen y se omitio el APU en esas partidas.");
  }
  return {
    status: "PRICE_MISMATCH",
    apu: null,
    calculatedApuUnitPrice: calculatedApu.totalUnitCost,
    unitPriceDifference: difference,
  };
}

function isWithinApuUnitPriceTolerance(difference: number, s10UnitPrice: number) {
  const absoluteDifference = new Decimal(difference);
  if (absoluteDifference.lessThanOrEqualTo(apuUnitPriceAbsoluteTolerance)) {
    return true;
  }

  const unitPrice = new Decimal(s10UnitPrice).abs();
  if (unitPrice.equals(0)) {
    return false;
  }

  return absoluteDifference.dividedBy(unitPrice).lessThanOrEqualTo(apuUnitPriceRelativeTolerance);
}

function selectGeneralPieRows(input: {
  presupuesto: S10PresupuestoRow;
  subBudgets: BudgetRecord[];
  pieSubpresupuestos: S10PieSubpresupuestoRow[];
  resultadoPieSubpresupuestos: S10ResultadoPieSubpresupuestoRow[];
}) {
  const comodinResultadoRows = input.resultadoPieSubpresupuestos.filter((row) => row.CodSubpresupuesto === "999");
  const comodinPieRows = input.pieSubpresupuestos.filter((row) => row.CodSubpresupuesto === "999");
  const comodinTotal = findPieValueByKind(comodinResultadoRows, "total");
  const presupuestoTotal = roundMoney(input.presupuesto.CostoOferta1);

  if (comodinResultadoRows.length > 0 && Math.abs(roundMoney(comodinTotal) - presupuestoTotal) <= 0.1) {
    return { pieRows: comodinPieRows, resultadoRows: comodinResultadoRows };
  }

  if (input.subBudgets.length === 1) {
    const sourceSubBudgetCode = selectSingleFooterSubbudgetCode(input.resultadoPieSubpresupuestos, input.pieSubpresupuestos);
    return {
      pieRows: input.pieSubpresupuestos.filter((row) => row.CodSubpresupuesto === sourceSubBudgetCode),
      resultadoRows: input.resultadoPieSubpresupuestos.filter((row) => row.CodSubpresupuesto === sourceSubBudgetCode),
    };
  }

  return { pieRows: comodinPieRows, resultadoRows: comodinResultadoRows };
}

function selectSingleFooterSubbudgetCode(resultadoRows: S10ResultadoPieSubpresupuestoRow[], pieRows: S10PieSubpresupuestoRow[]) {
  const codes = [...resultadoRows, ...pieRows]
    .map((row) => cleanText(row.CodSubpresupuesto))
    .filter((code) => code.length > 0 && code !== "999");
  const uniqueCodes = [...new Set(codes)];

  return uniqueCodes[0] ?? "";
}

function inferRatesFromResultadoPie(
  rows: S10ResultadoPieSubpresupuestoRow[],
  defaultRates?: S10ImportDefaultRates,
  pieRows: S10PieSubpresupuestoRow[] = [],
) {
  const directCost = findPieValueByKind(rows, "direct");
  const subtotal = findPieValueByKind(rows, "subtotal");
  const generalExpenses = findOptionalPieValueByKind(rows, "generalExpenses");
  const utility = findOptionalPieValueByKind(rows, "utility");
  const igv = findOptionalPieValueByKind(rows, "igv");
  const generalExpensesFormulaRate = findFormulaRateByKind(pieRows, "generalExpenses");
  const utilityFormulaRate = findFormulaRateByKind(pieRows, "utility");
  const igvFormulaRate = findFormulaRateByKind(pieRows, "igv");

  return {
    generalExpensesRate:
      generalExpenses == null ? generalExpensesFormulaRate ?? defaultRates?.generalExpensesRate ?? 0 : divideRate(generalExpenses, directCost),
    utilityRate: utility == null ? utilityFormulaRate ?? defaultRates?.utilityRate ?? 0 : divideRate(utility, directCost),
    igvRate: igv == null ? igvFormulaRate ?? defaultRates?.igvRate ?? 0.18 : divideRate(igv, subtotal) || (defaultRates?.igvRate ?? 0.18),
  };
}

function createFooterRowsDraft(
  budgetId: string,
  pieRows: S10PieSubpresupuestoRow[],
  resultadoRows: S10ResultadoPieSubpresupuestoRow[],
  budget?: Pick<BudgetRecord, "totalDirectCost" | "totalGeneralExpenses" | "totalUtility" | "totalTax" | "totalAmount">,
): S10BudgetFooterRowsDraft {
  const pieRowsByLine = new Map(pieRows.map((row) => [cleanText(row.Linea), row]));
  const hasOfficialResults = resultadoRows.length > 0;
  const sourceRows = hasOfficialResults ? resultadoRows : createResultadoRowsFromPie(pieRows, budget);

  return {
    budgetId,
    rows: sourceRows
      .slice()
      .sort((left, right) => cleanText(left.Linea).localeCompare(cleanText(right.Linea), "es", { numeric: true }))
      .map((row, index) => {
        const pieRow = pieRowsByLine.get(cleanText(row.Linea));
        const description = cleanOptionalText(row.Descripcion) ?? cleanOptionalText(pieRow?.Descripcion) ?? "";
        const sourceFormula = cleanOptionalText(pieRow?.Formula) ?? cleanOptionalText(row.Formula);
        const formula = hasOfficialResults ? null : sourceFormula;
        const variable = cleanOptionalText(pieRow?.Variable) ?? inferFooterVariable(description, formula, row.Linea);

        return {
          variable,
          description,
          formula,
          manualValue: roundMoney(row.Valor1),
          highlight: shouldHighlightFooterRow(description, variable, formula),
          sortOrder: index,
        };
      }),
  };
}

function createResultadoRowsFromPie(
  rows: S10PieSubpresupuestoRow[],
  budget?: Pick<BudgetRecord, "totalDirectCost" | "totalGeneralExpenses" | "totalUtility" | "totalTax" | "totalAmount">,
): S10ResultadoPieSubpresupuestoRow[] {
  if (!budget || rows.length === 0) {
    return rows.map((row) => ({
      CodPresupuesto: row.CodPresupuesto,
      CodSubpresupuesto: row.CodSubpresupuesto,
      Linea: row.Linea,
      Descripcion: row.Descripcion,
      Formula: row.Formula,
      Valor1: 0,
    }));
  }

  const builderRows = rows.map((row, index): BudgetFooterRowRecord => {
    const description = cleanOptionalText(row.Descripcion) ?? "";
    const sourceFormula = cleanOptionalText(row.Formula);
    const variable = cleanOptionalText(row.Variable) ?? inferFooterVariable(description, sourceFormula, row.Linea);
    const kind = classifyFooterRow(description, sourceFormula);
    const isSeparator = sourceFormula != null && /^[=\-]+$/.test(cleanText(sourceFormula));

    return {
      id: `s10-footer-${cleanText(row.CodPresupuesto)}-${cleanText(row.CodSubpresupuesto)}-${cleanText(row.Linea)}-${index}`,
      variable,
      description,
      formula: kind === "direct" || isSeparator ? null : sourceFormula,
      manualValue: kind === "direct" ? roundMoney(budget.totalDirectCost) : 0,
      iu: null,
      highlight: shouldHighlightFooterRow(description, variable, sourceFormula),
      sortOrder: index,
    };
  });
  const calculated = calculateBudgetFooterBuilder({
    rows: builderRows,
    totalDirectCost: budget.totalDirectCost,
    totalGeneralExpenses: budget.totalGeneralExpenses,
    totalUtility: budget.totalUtility,
    totalTax: budget.totalTax,
    totalAmount: budget.totalAmount,
    currencyDecimals: moneyDecimals,
  });
  const calculatedById = new Map(calculated.rows.map((row) => [row.id, row]));

  return rows.map((row, index) => {
    const id = `s10-footer-${cleanText(row.CodPresupuesto)}-${cleanText(row.CodSubpresupuesto)}-${cleanText(row.Linea)}-${index}`;
    const calculatedRow = calculatedById.get(id);

    return {
      CodPresupuesto: row.CodPresupuesto,
      CodSubpresupuesto: row.CodSubpresupuesto,
      Linea: row.Linea,
      Descripcion: row.Descripcion,
      Formula: row.Formula,
      Valor1: calculatedRow?.error ? 0 : calculatedRow?.value ?? 0,
    };
  });
}

function selectEffectivePieRows(
  ownPieRows: S10PieSubpresupuestoRow[],
  resultadoRows: S10ResultadoPieSubpresupuestoRow[],
  fallbackPieRows: S10PieSubpresupuestoRow[],
) {
  if (resultadoRows.length > 0 || ownPieRows.length > 1 || fallbackPieRows.length === 0) {
    return ownPieRows;
  }

  return fallbackPieRows.map((row) => ({
    ...row,
    CodSubpresupuesto: ownPieRows[0]?.CodSubpresupuesto ?? row.CodSubpresupuesto,
  }));
}

function findPieValueByKind(rows: S10ResultadoPieSubpresupuestoRow[], kind: "direct" | "generalExpenses" | "utility" | "subtotal" | "igv" | "total") {
  return findOptionalPieValueByKind(rows, kind) ?? 0;
}

function findOptionalPieValueByKind(
  rows: S10ResultadoPieSubpresupuestoRow[],
  kind: "direct" | "generalExpenses" | "utility" | "subtotal" | "igv" | "total",
) {
  const row = rows.find((entry) => classifyFooterRow(entry.Descripcion, entry.Formula) === kind);
  return row ? roundMoney(row.Valor1) : null;
}

function findFormulaRateByKind(
  rows: S10PieSubpresupuestoRow[],
  kind: "generalExpenses" | "utility" | "igv",
) {
  const row = rows.find((entry) => classifyFooterRow(entry.Descripcion, entry.Formula) === kind);
  const formula = cleanOptionalText(row?.Formula);
  if (!formula) {
    return null;
  }

  const match = formula.match(/\*\s*(\d+(?:[.,]\d+)?)/);
  if (!match) {
    return null;
  }

  const value = Number.parseFloat(match[1].replace(",", "."));
  return Number.isFinite(value) ? roundRate(value) : null;
}

function classifyFooterRow(description: string | null | undefined, formula: string | null | undefined) {
  const text = normalizeText(`${description ?? ""} ${formula ?? ""}`);
  if (text.includes("GASTO") || /\bGG\b/.test(text)) return "generalExpenses";
  if (text.includes("UTILIDAD") || /\bUTI?\b/.test(text)) return "utility";
  if (text.includes("IGV") || /I\.?G\.?V/.test(text) || text.includes("IMPUESTO")) return "igv";
  if (text.includes("SUBTOTAL") || /\bST\b/.test(text)) return "subtotal";
  if (text.includes("TOTAL") || text.includes("PRESUPUESTO") || text.includes("P_T")) return "total";
  if (text.includes("DIRECTO") || text.includes("NDIRECTO")) return "direct";
  return "unknown";
}

function inferFooterVariable(description: string, formula: string | null | undefined, line: string) {
  const kind = classifyFooterRow(description, formula);
  if (kind === "direct") return "CD";
  if (kind === "generalExpenses") return "PGG";
  if (kind === "utility") return "UTI";
  if (kind === "subtotal") return "ST";
  if (kind === "igv") return "IGV";
  if (kind === "total") return "P_T";
  return cleanText(line);
}

function shouldHighlightFooterRow(description: string, variable: string, formula: string | null | undefined) {
  const text = normalizeText(`${description} ${variable} ${formula ?? ""}`);
  return text.includes("TOTAL") || text.includes("SUBTOTAL") || text.includes("PRESUPUESTO") || /^[=\-]+$/.test(cleanText(formula));
}

function divideRate(numerator: number, denominator: number) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return 0;
  }

  return roundRate(new Decimal(numerator).dividedBy(denominator));
}

function isImportableSubpresupuestoDetalle(detalle: S10SubpresupuestoDetalleRow) {
  const codPartida = cleanOptionalText(detalle.CodPartida);
  if (codPartida == null || codPartida === "999999999999") {
    return false;
  }

  if (detalle.Tipo === 0) {
    return false;
  }

  return true;
}

function compareSubpresupuestoDetalleRows(left: S10SubpresupuestoDetalleRow, right: S10SubpresupuestoDetalleRow) {
  const orderComparison = cleanText(left.Orden ?? "").localeCompare(cleanText(right.Orden ?? ""));
  if (orderComparison !== 0) {
    return orderComparison;
  }

  const itemComparison = cleanText(left.Item ?? "").localeCompare(cleanText(right.Item ?? ""));
  if (itemComparison !== 0) {
    return itemComparison;
  }

  return toDecimal(left.Secuencial).comparedTo(toDecimal(right.Secuencial));
}

function createApu(input: {
  itemId: string;
  partida: S10PartidaRow;
  unit: string;
  detalles: S10ApuDetalleRow[];
  currency: string;
  sourceSystem: ImportSourceSystem;
  sourcePrefix: string;
  warnings: Set<string>;
}): ApuRecord {
  const apuId = createId(`${input.sourcePrefix}-apu`, input.partida.CodPresupuesto, input.partida.CodSubpresupuesto, input.partida.CodPartida);
  const performance = resolvePerformance(input.partida);
  const normalizedDetalles = resolveCalculatedPercentageApuRows(
    deduplicateApuDetalles(input.detalles),
    input.sourceSystem,
    input.warnings,
  );
  const resources = normalizedDetalles.map((detalle, index) =>
    createApuResource({
      apuId,
      detalle,
      sortOrder: index,
      currency: input.currency,
      sourceSystem: input.sourceSystem,
      sourcePrefix: input.sourcePrefix,
      warnings: input.warnings,
    }),
  );

  return {
    id: apuId,
    budgetItemId: input.itemId,
    name: cleanText(input.partida.Descripcion),
    unit: input.unit,
    performance,
    totalUnitCost: roundMoney(input.partida.Precio1),
    resources,
  };
}

function deduplicateApuDetalles(detalles: S10ApuDetalleRow[]) {
  const byKey = new Map<string, S10ApuDetalleRow>();

  for (const detalle of detalles) {
    const key = [
      cleanText(detalle.CodPresupuesto),
      cleanText(detalle.CodSubpresupuesto),
      cleanText(detalle.CodPartida),
      cleanText(detalle.CodPresupuestoPartida ?? ""),
      cleanText(detalle.PropioPartida ?? ""),
      cleanText(detalle.CodInsumo),
      toDecimal(detalle.Cantidad).toFixed(),
      toDecimal(detalle.Precio1).toFixed(),
    ].join("|");

    if (!byKey.has(key)) {
      byKey.set(key, detalle);
    }
  }

  return Array.from(byKey.values());
}

function resolveCalculatedPercentageApuRows(
  detalles: S10ApuDetalleRow[],
  sourceSystem: ImportSourceSystem,
  warnings: Set<string>,
): S10ApuDetalleRow[] {
  const totals = {
    labor: new Decimal(0),
    material: new Decimal(0),
    equipment: new Decimal(0),
    tools: new Decimal(0),
    subcontract: new Decimal(0),
  };

  for (const detalle of detalles) {
    const unit = normalizeKnownUnit(detalle.CodUnidad, warnings);
    if (unit.startsWith("%")) {
      continue;
    }

    const subtotal = toDecimal(detalle.Parcial1 ?? new Decimal(detalle.Cantidad ?? 0).times(detalle.Precio1 ?? 0));
    const category = inferResourceCategory(detalle, unit);
    if (category === "LABOR") {
      totals.labor = totals.labor.plus(subtotal);
    } else if (category === "MATERIAL") {
      totals.material = totals.material.plus(subtotal);
    } else if (category === "EQUIPMENT") {
      totals.equipment = totals.equipment.plus(subtotal);
    } else if (category === "TOOLS") {
      totals.tools = totals.tools.plus(subtotal);
    } else if (category === "SUBCONTRACT") {
      totals.subcontract = totals.subcontract.plus(subtotal);
    }
  }

  return detalles.map((detalle) => {
    const unit = normalizeKnownUnit(detalle.CodUnidad, warnings);
    const quantity = toDecimal(detalle.Cantidad);
    const calculatedAmount = toDecimal(detalle.Precio1);
    if (sourceSystem === "DELPHIN" || !unit.startsWith("%") || quantity.greaterThan(0) || calculatedAmount.lessThanOrEqualTo(0)) {
      return detalle;
    }

    const base = getPercentageBaseTotal(unit, totals);
    if (base.lessThanOrEqualTo(0)) {
      return detalle;
    }

    return {
      ...detalle,
      Cantidad: normalizeInferredS10PercentageQuantity(calculatedAmount.dividedBy(base).times(100)),
    };
  });
}

function normalizeInferredS10PercentageQuantity(percent: Decimal) {
  if (percent.greaterThan(0) && percent.lessThanOrEqualTo(1)) {
    return percent.dividedBy(100).toDecimalPlaces(8, Decimal.ROUND_HALF_UP).toNumber();
  }

  return roundRate(percent);
}

function getPercentageBaseTotal(
  unit: string,
  totals: { labor: Decimal; material: Decimal; equipment: Decimal; tools: Decimal; subcontract: Decimal },
) {
  const baseToken = normalizeText(unit.replace("%", ""));

  if (baseToken === "MO" || baseToken === "LABOR") return totals.labor;
  if (baseToken === "MT" || baseToken === "MAT" || baseToken === "MATERIAL") return totals.material;
  if (baseToken === "EQ" || baseToken === "EQUIPO" || baseToken === "EQUIPMENT") return totals.equipment;
  if (baseToken === "TOOLS" || baseToken === "HERRAMIENTAS") return totals.tools;
  if (baseToken === "SUB" || baseToken === "SUBCONTRATO" || baseToken === "SUBCONTRACT") return totals.subcontract;

  return new Decimal(0);
}

function createApuResource(input: {
  apuId: string;
  detalle: S10ApuDetalleRow;
  sortOrder: number;
  currency: string;
  sourceSystem: ImportSourceSystem;
  sourcePrefix: string;
  warnings: Set<string>;
}): ApuResourceRecord {
  const code = cleanText(input.detalle.CodInsumo);
  const unit = normalizeKnownUnit(input.detalle.CodUnidad, input.warnings);
  const category = inferResourceCategory(input.detalle, unit);
  const resource: ResourceRecord = {
    id: createId(`${input.sourcePrefix}-resource`, code),
    companyId: null,
    code,
    description: cleanText(input.detalle.Descripcion),
    category,
    iu: cleanOptionalText(input.detalle.CodIndiceUnificado),
    unit,
    unitPrice: roundMoney(input.detalle.Precio1),
    currency: input.currency,
    source: input.sourceSystem,
  };

  return {
    id: createId(`${input.sourcePrefix}-apu-row`, input.apuId, code, String(input.sortOrder)),
    apuId: input.apuId,
    resourceId: resource.id,
    resourceType: category,
    description: resource.description,
    unit,
    crew: null,
    quantity: normalizeApuQuantity(input.detalle.Cantidad, unit, input.sourceSystem),
    unitPrice: roundRate(input.detalle.Precio1),
    subtotal: roundMoney(input.detalle.Parcial1 ?? new Decimal(input.detalle.Cantidad ?? 0).times(input.detalle.Precio1 ?? 0)),
    resource,
  };
}

function normalizeApuQuantity(quantity: Decimal.Value | null | undefined, unit: string, sourceSystem: ImportSourceSystem) {
  const value = toDecimal(quantity);
  if (sourceSystem === "S10" && unit.startsWith("%") && value.greaterThan(0) && value.lessThanOrEqualTo(1)) {
    return roundRate(value.times(100));
  }

  return roundRate(value);
}

function inferResourceCategory(detalle: Pick<S10ApuDetalleRow, "CodInsumo" | "Descripcion" | "Tipo">, unit: string): ResourceCategory {
  const type = normalizeText(detalle.Tipo ?? "");
  const description = normalizeText(detalle.Descripcion);

  if (type === "MO" || unit.toUpperCase() === "HH" || detalle.CodInsumo.startsWith("0147")) {
    return "LABOR";
  }

  if (type === "EQ" || unit.toUpperCase() === "HM") {
    return "EQUIPMENT";
  }

  if (type === "HE" || unit.toUpperCase().startsWith("%") || description.includes("HERRAMIENTA")) {
    return "TOOLS";
  }

  if (type === "SC" || description.includes("SUBCONTRATO")) {
    return "SUBCONTRACT";
  }

  return "MATERIAL";
}

function normalizeKnownUnit(value: string | number | null | undefined, warnings: Set<string>) {
  const raw = String(value ?? "").trim();
  const unit = normalizeS10Unit(raw);
  if (raw.length > 0 && unit === raw && /^\d+$/.test(raw)) {
    warnings.add(`Unidad S10 desconocida: ${raw}.`);
  }

  return unit;
}

function resolvePerformance(partida: S10PartidaRow) {
  const laborPerformance = toDecimal(partida.RendimientoMO);
  if (laborPerformance.greaterThan(0)) {
    return laborPerformance.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  }

  const equipmentPerformance = toDecimal(partida.RendimientoEQ);
  if (equipmentPerformance.greaterThan(0)) {
    return equipmentPerformance.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
  }

  return 1;
}

function normalizeCurrency(value: string | null | undefined) {
  const normalized = normalizeText(value ?? "");
  if (normalized.includes("S") || normalized.includes("SOL")) {
    return solCurrency;
  }

  if (normalized.includes("US") || normalized.includes("DOLAR")) {
    return "USD";
  }

  return solCurrency;
}

function createId(...parts: string[]) {
  return parts.map((part) => sanitizeIdPart(part)).filter(Boolean).join("-");
}

function sanitizeIdPart(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function cleanText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function cleanOptionalText(value: string | null | undefined) {
  const cleaned = cleanText(value ?? "");
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function toDecimal(value: Decimal.Value | null | undefined) {
  return new Decimal(value ?? 0);
}

function roundMoney(value: Decimal.Value | null | undefined) {
  return toDecimal(value).toDecimalPlaces(moneyDecimals, Decimal.ROUND_HALF_UP).toNumber();
}

function roundRate(value: Decimal.Value | null | undefined) {
  return toDecimal(value).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber();
}
