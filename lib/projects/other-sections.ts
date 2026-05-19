export type ProjectOtherSection = {
  title: string;
  detail: string;
  href: string;
};

export function getProjectOtherSections(generalBudgetId: string | null): ProjectOtherSection[] {
  if (!generalBudgetId) {
    return [];
  }

  return [
    {
      title: "Programacion de obra",
      detail: "Cronograma valorizado consolidado, calendario de insumos y curva S del presupuesto general.",
      href: `/budgets/${generalBudgetId}/work-schedule`,
    },
    {
      title: "Lista de insumos",
      detail: "Consolidado funcional de insumos derivado desde los APUs del presupuesto general del proyecto.",
      href: `/budgets/${generalBudgetId}/resources`,
    },
    {
      title: "Gastos generales",
      detail: "Gestion operativa persistente de gastos generales conectada al presupuesto general del proyecto.",
      href: `/budgets/${generalBudgetId}/general-expenses`,
    },
    {
      title: "Pie de presupuesto",
      detail: "Seccion base del presupuesto general para observaciones, alcances y cierre documental.",
      href: `/budgets/${generalBudgetId}/footer`,
    },
    {
      title: "Formula polinomica",
      detail: "Acceso a la vista base de formula polinomica dentro del flujo funcional del presupuesto general.",
      href: `/budgets/${generalBudgetId}/polynomial-formula`,
    },
  ];
}
