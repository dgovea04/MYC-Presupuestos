export type GeneralBudgetTraceabilityInput = {
  subBudgetCount: number;
  detailCount: number;
  latestUpdatedAt: string | null;
};

export type GeneralBudgetTraceability = {
  sourceLabel: string;
  coverageLabel: string;
  calculationLabel: string;
  latestUpdatedAt: string | null;
  warning: string | null;
};

export function buildGeneralBudgetTraceability(input: GeneralBudgetTraceabilityInput): GeneralBudgetTraceability {
  const hasSubBudgets = input.subBudgetCount > 0;
  const hasCompleteDetail = hasSubBudgets && input.detailCount >= input.subBudgetCount;

  return {
    sourceLabel: hasSubBudgets ? `${input.subBudgetCount} Sub Presupuestos conectados` : "Sin Sub Presupuestos conectados",
    coverageLabel: hasCompleteDetail ? "Detalle completo para recalculo" : "Detalle pendiente de completar",
    calculationLabel: "Partidas + APU + tasas del presupuesto",
    latestUpdatedAt: input.latestUpdatedAt,
    warning: hasCompleteDetail ? null : "El consolidado se actualiza mejor cuando todos los Sub Presupuestos tienen detalle disponible.",
  };
}
