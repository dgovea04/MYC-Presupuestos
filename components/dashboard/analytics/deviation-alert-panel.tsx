"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneBadge } from "@/components/ui/context-badges";
import { formatCurrency, cn } from "@/lib/utils";
import type { DeviationAlert } from "@/lib/dashboard/analytics";

function getDeviationSeverityTone(severity: DeviationAlert["severity"]) {
  if (severity === "high") return "rose" as const;
  if (severity === "medium") return "amber" as const;
  return "sky" as const;
}

function getDeviationSeverityLabel(severity: DeviationAlert["severity"]) {
  if (severity === "high") return "Critica";
  if (severity === "medium") return "Moderada";
  return "Leve";
}

export function DeviationAlertPanel({
  data,
  currencyDecimals,
}: {
  data: DeviationAlert[];
  currencyDecimals: number;
}) {
  const highCount = data.filter((a) => a.severity === "high").length;
  const mediumCount = data.filter((a) => a.severity === "medium").length;
  const lowCount = data.filter((a) => a.severity === "low").length;

  if (data.length === 0) {
    return (
      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardHeader className="px-5 py-4">
          <CardTitle className="text-base font-medium">Alertas de desviacion</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex h-48 items-center justify-center text-sm text-[var(--app-text-muted)]">
            Registra reajustes para detectar desviaciones en el presupuesto.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="px-5 py-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Alertas de desviacion</CardTitle>
          {data.length > 0 && (
            <span className="dashboard-deviation-alert-total inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
              <AlertTriangle className="h-3 w-3" />
              {data.length} alerta{data.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-5 pt-0">
        <div className="grid grid-cols-3 gap-2">
          <div className="dashboard-deviation-severity dashboard-deviation-severity-high rounded-xl border border-rose-200 bg-rose-50/60 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-rose-700">{highCount}</p>
            <p className="text-xs text-rose-600">Criticas</p>
          </div>
          <div className="dashboard-deviation-severity dashboard-deviation-severity-medium rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-amber-700">{mediumCount}</p>
            <p className="text-xs text-amber-600">Moderadas</p>
          </div>
          <div className="dashboard-deviation-severity dashboard-deviation-severity-low rounded-xl border border-sky-200 bg-sky-50/60 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-sky-700">{lowCount}</p>
            <p className="text-xs text-sky-600">Leves</p>
          </div>
        </div>

        {data.slice(0, 5).map((alert) => {
          const isUpward = alert.adjustedAmount > alert.originalAmount;
          const TrendIcon = isUpward ? TrendingUp : TrendingDown;

          return (
            <Link
              key={alert.id}
              href={alert.href}
              className="dashboard-deviation-item group block rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-3 transition hover:border-rose-300 hover:bg-rose-50/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-[var(--app-text-strong)]">
                      {alert.projectName}
                    </span>
                    <ToneBadge
                      label={getDeviationSeverityLabel(alert.severity)}
                      tone={getDeviationSeverityTone(alert.severity)}
                    />
                  </div>
                  <p className="text-sm text-[var(--app-text-muted)]">{alert.budgetName}</p>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-[var(--app-text-muted)]">Periodo {alert.period}</span>
                    <span
                      className={cn(
                        "dashboard-deviation-trend inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                        isUpward
                          ? "bg-rose-50 text-rose-700"
                          : "bg-emerald-50 text-emerald-700",
                      )}
                    >
                      <TrendIcon className="h-3 w-3" />
                      {isUpward ? "+" : "-"}
                      {formatCurrency(
                        alert.deviationAmount,
                        alert.currency,
                        currencyDecimals,
                      )}
                    </span>
                    <span className="font-medium text-[var(--app-text-strong)]">
                      {alert.deviationPercent}%
                    </span>
                  </div>
                </div>
                <span className="dashboard-deviation-arrow mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] transition group-hover:bg-rose-100 group-hover:text-rose-700">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          );
        })}

        {data.length > 5 && (
          <p className="text-center text-xs text-[var(--app-text-muted)]">
            Mostrando 5 de {data.length} alertas
          </p>
        )}
      </CardContent>
    </Card>
  );
}
