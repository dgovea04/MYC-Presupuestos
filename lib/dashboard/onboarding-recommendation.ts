export type AhaMomentSummary = {
  eventName: string;
  users: number;
  activationRate: number;
  shareOfActivated: number;
};

export type OnboardingRecommendation = {
  title: string;
  description: string;
  href: string;
};

export function getOnboardingRecommendation(ahaMoment: AhaMomentSummary | undefined): OnboardingRecommendation | null {
  if (!ahaMoment) {
    return null;
  }

  const recommendations: Record<string, OnboardingRecommendation> = {
    project_created: {
      title: "Prioriza crear el primer proyecto",
      description: "El primer proyecto es la acción que más usuarios lleva hacia la activación.",
      href: "/projects/new",
    },
    budget_created: {
      title: "Prioriza crear el primer presupuesto",
      description: "El primer presupuesto debe aparecer como el siguiente paso principal del onboarding.",
      href: "/budgets/new",
    },
    budget_imported: {
      title: "Prioriza importar un presupuesto",
      description: "La importación puede llevar más rápido a los usuarios al valor técnico del producto.",
      href: "/imports/mcp",
    },
    excel_paste_used: {
      title: "Prioriza el flujo Excel",
      description: "El pegado desde Excel puede ser el camino de menor fricción hacia la activación.",
      href: "/budgets/new",
    },
    apu_created: {
      title: "Prioriza crear el primer APU",
      description: "El primer APU puede convertirse en el paso central de la guía técnica.",
      href: "/budgets/new",
    },
    formula_created: {
      title: "Prioriza generar la fórmula",
      description: "La fórmula polinómica aparece como el paso técnico con mayor señal de activación.",
      href: "/projects",
    },
    export_completed: {
      title: "Prioriza la primera exportación",
      description: "La exportación puede cerrar el primer ciclo de valor del usuario.",
      href: "/projects",
    },
  };

  return recommendations[ahaMoment.eventName] ?? null;
}
