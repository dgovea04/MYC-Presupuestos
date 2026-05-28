export type ExportTarget =
  | "budget"
  | "apu"
  | "resources"
  | "budget_resources"
  | "general_expenses"
  | "budget_footer"
  | "polynomial_formula"
  | "work_schedule";
export type ExportFormat = "xlsx" | "pdf" | "csv" | "zip";
export type ExportScope = "current_view" | "full_module" | "visible_filtered";
export type PdfOrientation = "portrait" | "landscape";
export type ExportPreset =
  | "presupuesto_detallado"
  | "apu_consolidado"
  | "catalogo_insumos"
  | "lista_insumos_derivada"
  | "gastos_generales_detallado"
  | "pie_presupuesto_detallado"
  | "formula_polinomica_detallada"
  | "cronograma_ejecutivo"
  | "cronograma_partidas"
  | "calendario_valorizado"
  | "calendario_insumos"
  | "curva_s";

export type ExportOptions = {
  scope: ExportScope;
  columns: string[];
  sections: string[];
  includeSubtotals: boolean;
  includeTotals: boolean;
  useVisibleFilters: boolean;
  currencyDecimals: number;
  includeSignature: boolean;
  includeGanttChart: boolean;
  includeCurveChart: boolean;
  includeCriticalPath: boolean;
  pdfOrientation: PdfOrientation;
  fileName?: string;
};

export type ExportRequest = {
  target: ExportTarget;
  targetId: string;
  format: ExportFormat;
  preset: ExportPreset;
  options?: Partial<ExportOptions>;
};

export type NormalizedExportRequest = Omit<ExportRequest, "options"> & {
  options: ExportOptions;
};

export type ExportPresetDefinition = {
  id: ExportPreset;
  label: string;
  description: string;
  formats: ExportFormat[];
  defaultFormat: ExportFormat;
  defaultOptions: Partial<ExportOptions>;
};

export type ExportDefinition = {
  target: ExportTarget;
  label: string;
  presets: ExportPresetDefinition[];
};

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  scope: "full_module",
  columns: [],
  sections: [],
  includeSubtotals: true,
  includeTotals: true,
  useVisibleFilters: false,
  currencyDecimals: 2,
  includeSignature: true,
  includeGanttChart: true,
  includeCurveChart: true,
  includeCriticalPath: false,
  pdfOrientation: "portrait",
};

export const EXPORT_DEFINITIONS: Record<ExportTarget, ExportDefinition> = {
  budget: {
    target: "budget",
    label: "Presupuesto",
    presets: [
      {
        id: "presupuesto_detallado",
        label: "Presupuesto detallado",
        description: "Partidas, niveles y totales del presupuesto.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["levels", "items", "totals"], columns: ["code", "description", "unit", "quantity", "unitPrice", "partial"] },
      },
    ],
  },
  apu: {
    target: "apu",
    label: "Analisis de precios unitarios",
    presets: [
      {
        id: "apu_consolidado",
        label: "APU consolidado",
        description: "Analisis de costos unitarios con recursos por partida.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["items", "resources", "totals"], columns: ["itemCode", "description", "resource", "unit", "quantity", "unitPrice", "subtotal"] },
      },
    ],
  },
  resources: {
    target: "resources",
    label: "Catalogo de insumos",
    presets: [
      {
        id: "catalogo_insumos",
        label: "Catalogo completo",
        description: "Lista de insumos con categoria, unidad, IU, moneda y precio.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["resources"], columns: ["code", "description", "category", "unit", "iu", "currency", "unitPrice"] },
      },
    ],
  },
  budget_resources: {
    target: "budget_resources",
    label: "Lista de insumos",
    presets: [
      {
        id: "lista_insumos_derivada",
        label: "Lista derivada",
        description: "Consolidado de insumos derivado desde los APU de los sub presupuestos.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["resources", "totals"], columns: ["code", "description", "category", "unit", "unitPrice", "quantity", "totalCost", "usageCount", "budgets"] },
      },
    ],
  },
  general_expenses: {
    target: "general_expenses",
    label: "Gastos generales",
    presets: [
      {
        id: "gastos_generales_detallado",
        label: "Gastos generales detallado",
        description: "Grupos, titulos, items, subtotales y total operativo.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["groups", "titles", "items", "totals"], columns: ["code", "description", "unit", "quantity", "percentage", "unitPrice", "partial"] },
      },
    ],
  },
  budget_footer: {
    target: "budget_footer",
    label: "Pie de presupuesto",
    presets: [
      {
        id: "pie_presupuesto_detallado",
        label: "Pie detallado",
        description: "Variables, formulas, valores calculados, IU y resaltados.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["rows", "amountInWords"], columns: ["variable", "description", "formula", "value", "iu", "highlight"] },
      },
    ],
  },
  polynomial_formula: {
    target: "polynomial_formula",
    label: "Formula polinomica",
    presets: [
      {
        id: "formula_polinomica_detallada",
        label: "Formula detallada",
        description: "Monomios, coeficientes a 3 decimales e indices base/reajuste.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["monomials", "summary"], columns: ["code", "name", "costGroup", "amount", "coefficient", "baseIndex", "adjustmentIndex"] },
      },
    ],
  },
  work_schedule: {
    target: "work_schedule",
    label: "Cronograma de obra",
    presets: [
      {
        id: "cronograma_ejecutivo",
        label: "Paquete ejecutivo",
        description: "Resumen por subpresupuesto, resumen mensual y cronograma de partidas.",
        formats: ["xlsx", "pdf", "csv", "zip"],
        defaultFormat: "zip",
        defaultOptions: { sections: ["summary", "monthly", "overview"], columns: [] },
      },
      {
        id: "cronograma_partidas",
        label: "Cronograma de partidas",
        description: "Detalle programado por partida.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["overview"], columns: [] },
      },
      {
        id: "calendario_valorizado",
        label: "Calendario valorizado",
        description: "Montos programados por periodo.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["valuation"], columns: [] },
      },
      {
        id: "calendario_insumos",
        label: "Calendario de insumos",
        description: "Cantidades y montos de insumos por periodo.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["resources"], columns: [] },
      },
      {
        id: "curva_s",
        label: "Curva S",
        description: "Programado mensual, acumulado y porcentaje acumulado.",
        formats: ["xlsx", "pdf", "csv"],
        defaultFormat: "xlsx",
        defaultOptions: { sections: ["curve"], columns: [] },
      },
    ],
  },
};

export function getExportDefinition(target: ExportTarget) {
  return EXPORT_DEFINITIONS[target];
}

export function getExportDefinitions() {
  return Object.values(EXPORT_DEFINITIONS);
}
