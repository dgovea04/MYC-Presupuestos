import type { DashboardPendingItem } from "@/lib/data/dashboard";

export type DashboardOnboardingStats = {
  budgetsCount: number;
  companiesCount: number;
  pendingItems: DashboardPendingItem[];
  projectsCount: number;
};

export type DashboardOnboardingStep = {
  completed: boolean;
  description: string;
  href: string;
  title: string;
};

export function buildDashboardOnboardingSteps(stats: DashboardOnboardingStats): DashboardOnboardingStep[] {
  const missingFormula = stats.pendingItems.find((item) => item.type === "MISSING_POLYNOMIAL_FORMULA");
  const missingAdjustments = stats.pendingItems.find((item) => item.type === "MISSING_ADJUSTMENTS");

  return [
    {
      title: "Empresa",
      description: "Completa los datos que apareceran en reportes y firmas.",
      href: "/settings",
      completed: stats.companiesCount > 0,
    },
    {
      title: "Proyecto",
      description: "Crea la obra y define cliente, ubicacion y estado.",
      href: "/projects/new",
      completed: stats.projectsCount > 0,
    },
    {
      title: "Presupuesto",
      description: "Registra el presupuesto general y sus subpresupuestos.",
      href: "/budgets/new",
      completed: stats.budgetsCount > 0,
    },
    {
      title: "Formula",
      description: "Genera la formula polinomica para habilitar reajustes.",
      href: missingFormula?.href ?? "/projects",
      completed: stats.projectsCount > 0 && stats.budgetsCount > 0 && !missingFormula,
    },
    {
      title: "Seguimiento",
      description: "Registra el primer reajuste o revisa pendientes operativos.",
      href: missingAdjustments?.href ?? "/dashboard?priority=medium",
      completed: stats.projectsCount > 0 && stats.budgetsCount > 0 && !missingAdjustments,
    },
  ];
}
