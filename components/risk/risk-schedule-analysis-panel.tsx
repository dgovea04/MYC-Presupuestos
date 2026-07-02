"use client";

import { Route } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ChartTooltipContent, Tooltip } from "@/components/ui/chart";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";
import type { RiskSimulationSummary } from "@/types/risk";

export function RiskScheduleAnalysisPanel({
  result,
}: {
  result: RiskSimulationSummary | null;
}) {
  const scheduleDuration = result?.scheduleDuration ?? null;

  if (!scheduleDuration) {
    return (
      <Card className="theme-surface-card">
        <CardContent className="p-5">
          <h2 className="theme-strong-text text-sm font-semibold">Analisis de plazo</h2>
          <p className="theme-muted-text mt-2 text-sm">
            Ejecuta una simulacion con variables de duracion activas para ver contingencia, buffer y distribucion de plazo.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="theme-strong-text text-sm font-semibold">Analisis de plazo</h2>
          <p className="theme-muted-text mt-1 text-xs">
            Riesgo probabilistico del cronograma total con base en las variables de duracion simuladas.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Base simulada" value={`${formatNumber(scheduleDuration.baseProjectDurationDays, 0)} dias`} />
          <MetricCard label="Duracion media" value={`${formatNumber(scheduleDuration.meanDurationDays, 1)} dias`} />
          <MetricCard label="P80 plazo" value={`${formatNumber(scheduleDuration.p80DurationDays, 1)} dias`} />
          <MetricCard label="P95 plazo" value={`${formatNumber(scheduleDuration.p95DurationDays, 1)} dias`} />
          <MetricCard
            label="Rango simulado"
            value={`${formatNumber(scheduleDuration.minimumDurationDays, 0)} - ${formatNumber(scheduleDuration.maximumDurationDays, 0)} dias`}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <MetricCard
            label="Buffer recomendado P80"
            value={buildScheduleBufferLabel(scheduleDuration.p80DurationDays, scheduleDuration.baseProjectDurationDays)}
          />
          <MetricCard
            label="Buffer conservador P95"
            value={buildScheduleBufferLabel(scheduleDuration.p95DurationDays, scheduleDuration.baseProjectDurationDays)}
          />
        </div>

        <div className="overflow-auto rounded-2xl border border-[var(--app-border)]">
          <Table className="text-xs">
            <THead className="theme-muted-panel">
              <TR className="theme-muted-panel hover:theme-muted-panel">
                <TH className="px-4 py-2 text-xs uppercase tracking-wide">Escenario</TH>
                <TH className="px-4 py-2 text-xs uppercase tracking-wide">Duracion</TH>
                <TH className="px-4 py-2 text-xs uppercase tracking-wide">Delta vs base</TH>
                <TH className="px-4 py-2 text-xs uppercase tracking-wide">Contingencia plazo</TH>
              </TR>
            </THead>
            <TBody>
              {buildScheduleContingencyRows(scheduleDuration).map((row) => (
                <TR key={row.label}>
                  <TD className="theme-strong-text px-4 py-2 font-medium">{row.label}</TD>
                  <TD className="px-4 py-2">{row.duration}</TD>
                  <TD className="px-4 py-2">{row.delta}</TD>
                  <TD className="px-4 py-2">{row.contingency}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        <div className="grid gap-3 xl:grid-cols-2">
          <div className="rounded-2xl border border-[var(--app-border)] p-4">
            <div className="mb-3">
              <p className="theme-strong-text text-sm font-semibold">Histograma de plazo</p>
              <p className="theme-muted-text mt-1 text-xs">
                Distribucion simulada de duracion total del proyecto en dias.
              </p>
            </div>
            <div className="h-64">
              <ResponsiveContainer height="100%" width="100%">
                <BarChart data={scheduleDuration.histogramBins}>
                  <CartesianGrid stroke="var(--app-border-soft)" strokeDasharray="3 3" />
                  <XAxis
                    axisLine={false}
                    dataKey="midpoint"
                    tick={{ fontSize: 11, fill: "var(--app-text-muted)" }}
                    tickFormatter={(value) => `${formatNumber(Number(value), 0)} d`}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 11, fill: "var(--app-text-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    animationDuration={0}
                    cursor={{ fill: "var(--app-surface-muted)", radius: 4 }}
                    content={({ active, payload, label }) => (
                      <ChartTooltipContent active={active} payload={payload} label={label}>
                        <span className="text-[var(--app-text-muted)]">Frecuencia: </span>
                        <span className="font-medium tabular-nums text-[var(--app-text-strong)]">{payload?.[0]?.value}</span>
                      </ChartTooltipContent>
                    )}
                    labelFormatter={(value) => `${formatNumber(Number(value), 1)} dias`}
                  />
                  <Bar
                    activeBar={{
                      fill: "var(--chart-2)",
                      fillOpacity: 1,
                      stroke: "var(--app-primary-soft)",
                      strokeWidth: 1.5,
                    }}
                    dataKey="frequency"
                    fill="var(--chart-2)"
                    fillOpacity={0.9}
                    isAnimationActive={false}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--app-border)] p-4">
            <div className="mb-3">
              <p className="theme-strong-text text-sm font-semibold">Curva S de plazo</p>
              <p className="theme-muted-text mt-1 text-xs">
                Probabilidad acumulada de terminar el proyecto segun la duracion simulada.
              </p>
            </div>
            <div className="h-64">
              <ResponsiveContainer height="100%" width="100%">
                <LineChart data={scheduleDuration.sCurvePoints}>
                  <CartesianGrid stroke="var(--app-border-soft)" strokeDasharray="3 3" />
                  <XAxis
                    axisLine={false}
                    dataKey="cost"
                    tick={{ fontSize: 11, fill: "var(--app-text-muted)" }}
                    tickFormatter={(value) => `${formatNumber(Number(value), 0)} d`}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--app-text-muted)" }}
                    tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`}
                    tickLine={false}
                  />
                  <Tooltip
                    animationDuration={0}
                    content={({ active, payload, label }) => (
                      <ChartTooltipContent active={active} payload={payload} label={label}>
                        <span className="text-[var(--app-text-muted)]">Probabilidad acumulada: </span>
                        <span className="font-medium tabular-nums text-[var(--app-text-strong)]">
                          {payload?.[0]?.value != null ? `${Math.round(Number(payload[0].value) * 100)}%` : "-"}
                        </span>
                      </ChartTooltipContent>
                    )}
                    labelFormatter={(value) => `${formatNumber(Number(value), 1)} dias`}
                  />
                  <Line
                    dataKey="cumulativeProbability"
                    dot={false}
                    isAnimationActive={false}
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    type="monotone"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--app-border)] p-3">
      <div className="theme-muted-text flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <Route className="h-4 w-4" />
        {label}
      </div>
      <p className="theme-strong-text mt-2 text-sm font-medium">{value}</p>
    </div>
  );
}

function buildScheduleContingencyRows(scheduleDuration: NonNullable<RiskSimulationSummary["scheduleDuration"]>) {
  return [
    { label: "Media", value: scheduleDuration.meanDurationDays },
    { label: "P80", value: scheduleDuration.p80DurationDays },
    { label: "P90", value: scheduleDuration.p90DurationDays },
    { label: "P95", value: scheduleDuration.p95DurationDays },
  ].map((row) => {
    const deltaDays = row.value - scheduleDuration.baseProjectDurationDays;
    const contingencyRatio =
      scheduleDuration.baseProjectDurationDays > 0 ? deltaDays / scheduleDuration.baseProjectDurationDays : 0;

    return {
      label: row.label,
      duration: `${formatNumber(row.value, 1)} dias`,
      delta: `${deltaDays >= 0 ? "+" : ""}${formatNumber(deltaDays, 1)} dias`,
      contingency: `${formatNumber(contingencyRatio * 100, 2)}%`,
    };
  });
}

function buildScheduleBufferLabel(durationDays: number, baseProjectDurationDays: number) {
  const bufferDays = Math.max(0, durationDays - baseProjectDurationDays);
  const bufferRatio = baseProjectDurationDays > 0 ? bufferDays / baseProjectDurationDays : 0;

  return `${formatNumber(bufferDays, 1)} dias (${formatNumber(bufferRatio * 100, 2)}%)`;
}
