import { metradoTemplates } from "@/lib/metrados/templates";
import type { BudgetTemplateSnapshot } from "@/lib/templates/budget-template-snapshot";

export type TemplateLibraryModule = "BUDGET" | "APU" | "GENERAL_EXPENSES" | "METRADOS" | "FOOTER";

export type TemplateLibraryItem = {
  id: string;
  module: TemplateLibraryModule;
  name: string;
  description: string;
  tags: string[];
  status: "AVAILABLE" | "BASELINE";
  source: "SYSTEM" | "WORKBOOK" | "USER";
  actionLabel: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TemplateLibrarySource = TemplateLibraryItem["source"];

export type TemplateLibraryFilterCriteria = {
  module?: TemplateLibraryModule | "ALL";
  source?: TemplateLibrarySource | "ALL";
  query?: string;
};

const staticTemplateItems: TemplateLibraryItem[] = [
  {
    id: "budget-edificacion-base",
    module: "BUDGET",
    name: "Presupuesto de edificacion base",
    description: "Estructura inicial con presupuesto general y subpresupuestos de obra separados por especialidad.",
    tags: ["General", "Subpresupuestos", "Edificacion"],
    status: "BASELINE",
    source: "SYSTEM",
    actionLabel: "Usar al crear proyecto",
  },
  {
    id: "apu-cuadrilla-estandar",
    module: "APU",
    name: "APU con cuadrilla estandar",
    description: "Base para mano de obra, materiales, equipos y herramientas con rendimiento revisable.",
    tags: ["APU", "Rendimiento", "Cuadrilla"],
    status: "BASELINE",
    source: "SYSTEM",
    actionLabel: "Aplicar desde editor APU",
  },
  {
    id: "general-expenses-fixed-workbook",
    module: "GENERAL_EXPENSES",
    name: "Gastos generales fijos",
    description: "Estructura base para costos indirectos permanentes de obra cargada desde el workbook operativo.",
    tags: ["Fijos", "Administracion", "Workbook"],
    status: "AVAILABLE",
    source: "WORKBOOK",
    actionLabel: "Se copia por presupuesto",
  },
  {
    id: "general-expenses-variable-workbook",
    module: "GENERAL_EXPENSES",
    name: "Gastos generales variables",
    description: "Estructura base para costos indirectos proporcionales al plazo y operacion de obra.",
    tags: ["Variables", "Operacion", "Workbook"],
    status: "AVAILABLE",
    source: "WORKBOOK",
    actionLabel: "Se copia por presupuesto",
  },
  {
    id: "budget-footer-workbook",
    module: "FOOTER",
    name: "Pie de presupuesto base",
    description: "Variables de cierre, observaciones, firma y datos documentarios del presupuesto.",
    tags: ["Cierre", "Firma", "Exportacion"],
    status: "AVAILABLE",
    source: "WORKBOOK",
    actionLabel: "Editar en pie de presupuesto",
  },
];

export function listTemplateLibraryItems(customItems: TemplateLibraryItem[] = []): TemplateLibraryItem[] {
  return [...staticTemplateItems, ...buildMetradoTemplateItems(), ...customItems].sort(compareTemplateLibraryItems);
}

export function getTemplateLibraryItem(id: string): TemplateLibraryItem | null {
  return listTemplateLibraryItems().find((item) => item.id === id) ?? null;
}

export function buildTemplateActionHref(item: TemplateLibraryItem) {
  if (item.id.startsWith("budget-template-")) {
    return `/templates/budget/${encodeURIComponent(item.id.replace("budget-template-", ""))}`;
  }

  if (item.id === "budget-edificacion-base") {
    return `/projects/new?template=${encodeURIComponent(item.id)}`;
  }

  if (item.id === "general-expenses-fixed-workbook" || item.id === "general-expenses-variable-workbook") {
    return `/budgets?template=${encodeURIComponent(item.id)}`;
  }

  if (item.module === "METRADOS") {
    return `/metrados-avanzados?template=${encodeURIComponent(item.id)}`;
  }

  if (item.module === "APU") {
    return "/partidas";
  }

  return "/budgets";
}

export function getTemplateLibrarySummary(items: TemplateLibraryItem[] = listTemplateLibraryItems()) {
  const modules = new Set(items.map((item) => item.module));
  const workbookTemplates = items.filter((item) => item.source === "WORKBOOK").length;
  const userTemplates = items.filter((item) => item.source === "USER").length;

  return {
    total: items.length,
    modules: modules.size,
    workbookTemplates,
    systemTemplates: items.length - workbookTemplates - userTemplates,
    userTemplates,
  };
}

export function filterTemplateLibraryItems(
  items: TemplateLibraryItem[],
  module: TemplateLibraryModule | "ALL",
) {
  return module === "ALL" ? items : items.filter((item) => item.module === module);
}

export function filterTemplateLibraryItemsByCriteria(
  items: TemplateLibraryItem[],
  criteria: TemplateLibraryFilterCriteria,
) {
  const selectedModule = criteria.module ?? "ALL";
  const source = criteria.source ?? "ALL";
  const normalizedQuery = normalizeTemplateSearch(criteria.query ?? "");

  return filterTemplateLibraryItems(items, selectedModule).filter((item) => {
    const matchesSource = source === "ALL" || item.source === source;
    if (!matchesSource) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return normalizeTemplateSearch([item.name, item.description, item.module, item.source, ...item.tags].join(" ")).includes(
      normalizedQuery,
    );
  });
}

export function buildBudgetSnapshotTemplateLibraryItem(
  snapshot: BudgetTemplateSnapshot,
  templateId = snapshot.source.budgetId,
  metadata: { createdAt?: string; updatedAt?: string } = {},
): TemplateLibraryItem {
  return {
    id: `budget-template-${templateId}`,
    module: "BUDGET",
    name: snapshot.name,
    description: snapshot.description || `Plantilla capturada desde ${snapshot.source.budgetName}.`,
    tags: [
      snapshot.budget.kind === "GENERAL" ? "General" : "Subpresupuesto",
      snapshot.summary.currency,
      `${snapshot.summary.itemCount} partidas`,
    ],
    status: "AVAILABLE",
    source: "USER",
    actionLabel: "Ver plantilla",
    ...(metadata.createdAt ? { createdAt: metadata.createdAt } : {}),
    ...(metadata.updatedAt ? { updatedAt: metadata.updatedAt } : {}),
  };
}

function buildMetradoTemplateItems(): TemplateLibraryItem[] {
  return metradoTemplates.map((template) => ({
    id: `metrado-${template.type.toLowerCase()}`,
    module: "METRADOS" as const,
    name: template.name,
    description: template.description,
    tags: [template.defaultUnit, ...template.formulas.map((formula) => formula.label)],
    status: "AVAILABLE" as const,
    source: "SYSTEM" as const,
    actionLabel: "Crear hoja de metrado",
  }));
}

function compareTemplateLibraryItems(left: TemplateLibraryItem, right: TemplateLibraryItem) {
  const moduleComparison = getModuleSortOrder(left.module) - getModuleSortOrder(right.module);
  if (moduleComparison !== 0) {
    return moduleComparison;
  }

  return left.name.localeCompare(right.name);
}

function getModuleSortOrder(module: TemplateLibraryModule) {
  const order: Record<TemplateLibraryModule, number> = {
    BUDGET: 0,
    APU: 1,
    GENERAL_EXPENSES: 2,
    METRADOS: 3,
    FOOTER: 4,
  };

  return order[module];
}

function normalizeTemplateSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
