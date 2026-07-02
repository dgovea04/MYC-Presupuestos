"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarRange, Pencil, Route, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { buildWorkScheduleExposureSummary } from "@/lib/risk/statistics";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";
import type {
  RiskVariableDraftKey,
  RiskVariableRecord,
  RiskWorkScheduleSummary,
} from "@/types/risk";

export function RiskWorkSchedulePanel({
  disabled = false,
  onEditDurationVariable,
  summary,
  variables,
}: {
  disabled?: boolean;
  onEditDurationVariable?: (draftKey: RiskVariableDraftKey) => void;
  summary: RiskWorkScheduleSummary | null;
  variables: RiskVariableRecord[];
}) {
  if (!summary) {
    return (
      <Card className="theme-surface-card">
        <CardContent className="p-5">
          <h2 className="theme-strong-text text-sm font-semibold">Cronograma</h2>
          <p className="theme-muted-text mt-2 text-sm">
            Este analisis de riesgo no tiene un cronograma general vinculado para cruzar ruta critica y variables.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeVariableCountByItemId = new Map<string, number>();
  for (const variable of variables) {
    if (!variable.enabled) {
      continue;
    }

    activeVariableCountByItemId.set(
      variable.budgetItemId,
      (activeVariableCountByItemId.get(variable.budgetItemId) ?? 0) + 1,
    );
  }

  const criticalExposureCount = summary.criticalItems.filter(
    (item) => (activeVariableCountByItemId.get(item.budgetItemId) ?? 0) > 0,
  ).length;
  const exposureSummary = buildWorkScheduleExposureSummary(summary, variables);

  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="theme-strong-text text-sm font-semibold">Cronograma</h2>
            <p className="theme-muted-text mt-1 text-xs">
              Cruce de variables de riesgo activas con la ruta critica del cronograma general.
            </p>
          </div>
          <Link
            className="theme-strong-text inline-flex items-center gap-1 text-sm font-medium hover:underline"
            href={`/budgets/${summary.budgetId}/work-schedule`}
          >
            Ver cronograma
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            icon={<CalendarRange className="h-4 w-4" />}
            label="Ventana"
            value={`${formatOptionalDate(summary.timeline.startDate)} - ${formatOptionalDate(summary.timeline.endDate)}`}
          />
          <MetricCard
            icon={<Route className="h-4 w-4" />}
            label="Duracion CPM"
            value={summary.criticalPath ? `${summary.criticalPath.projectDurationDays} dias` : "Sin calcular"}
          />
          <MetricCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Partidas criticas"
            value={summary.criticalPath ? String(summary.criticalPath.criticalItemCount) : "0"}
          />
          <MetricCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Criticas con riesgo"
            value={String(criticalExposureCount)}
          />
          <MetricCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Cobertura critica"
            value={exposureSummary ? `${formatNumber(exposureSummary.exposedCriticalShare * 100, 1)}%` : "-"}
          />
          <MetricCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Costo critico expuesto"
            value={exposureSummary ? formatCurrency(exposureSummary.exposedCriticalCost, summary.currency, 2) : "-"}
          />
          <MetricCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Costo critico descubierto"
            value={exposureSummary ? formatCurrency(exposureSummary.uncoveredCriticalCost, summary.currency, 2) : "-"}
          />
        </div>

        {summary.criticalPath?.issues.length ? (
          <div className="theme-status-error rounded-xl border px-3 py-2 text-sm">
            {summary.criticalPath.issues.join(" ")}
          </div>
        ) : null}

        <div className="space-y-2">
          <p className="theme-muted-text text-[11px] font-semibold uppercase tracking-wide">Ruta critica expuesta</p>
          {summary.criticalItems.length === 0 ? (
            <p className="theme-muted-text text-sm">No hay partidas criticas calculadas en el cronograma actual.</p>
          ) : (
            <div className="space-y-2">
              {summary.criticalItems.slice(0, 6).map((item) => {
                const activeRiskCount = activeVariableCountByItemId.get(item.budgetItemId) ?? 0;
                const durationVariable = variables.find(
                  (variable) => variable.budgetItemId === item.budgetItemId && variable.variableType === "DURATION",
                );
                return (
                  <div key={item.budgetItemId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--app-border)] px-3 py-3">
                    <div className="min-w-0">
                      <p className="theme-strong-text text-sm font-medium">
                        {item.itemCode} {item.description}
                      </p>
                      <p className="theme-muted-text mt-1 text-xs">
                        {item.subBudgetName} | {item.durationDays ?? 0} dias | {formatOptionalDate(item.startDate)} - {formatOptionalDate(item.endDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={
                          activeRiskCount > 0
                            ? "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"
                            : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"
                        }
                      >
                        {activeRiskCount > 0 ? `${activeRiskCount} variable${activeRiskCount === 1 ? "" : "s"} activa${activeRiskCount === 1 ? "" : "s"}` : "Sin variable activa"}
                      </span>
                      <Button
                        disabled={disabled || !onEditDurationVariable}
                        onClick={() => onEditDurationVariable?.(`${item.budgetItemId}:DURATION`)}
                        size="sm"
                        type="button"
                        variant={durationVariable ? "outline" : "ghost"}
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        {durationVariable ? "Editar duracion" : "Agregar duracion"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] p-3">
      <div className="theme-muted-text flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className="theme-strong-text mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function formatOptionalDate(value: string | null) {
  return value ? formatDate(value, "DD_MM_YYYY") : "Sin fecha";
}
