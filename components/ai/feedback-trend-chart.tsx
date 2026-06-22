"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { ChartTooltipContent, Tooltip } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { FeedbackTrendPoint } from "@/lib/ai/suggestion-feedback";

type RangeDays = 7 | 30 | 90;

const RANGE_OPTIONS: Array<{ label: string; days: RangeDays }> = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

const LABEL_MAP: Record<string, string> = {
  acceptanceRate: "Aceptacion",
  applied: "Aplicadas",
  edited: "Editadas",
  dismissed: "Descartadas",
};

export function FeedbackTrendChart({ trends }: { trends: FeedbackTrendPoint[] }) {
  const [rangeDays, setRangeDays] = useState<RangeDays>(90);
  const rangeCutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - rangeDays);
    return d;
  }, [rangeDays]);

  // Parse weekKey (e.g. "2026-W24") into a Date for filtering
  function parseWeekKey(weekKey: string): Date {
    const [yearStr, weekStr] = weekKey.split("-W");
    const year = Number(yearStr);
    const week = Number(weekStr);
    const jan4 = new Date(year, 0, 4);
    const jan4DayOfWeek = jan4.getDay() || 7;
    const daysOffset = (week - 1) * 7 - (jan4DayOfWeek - 4);
    return new Date(year, 0, 4 + daysOffset);
  }

  const filteredTrends = useMemo(() => {
    return trends.filter((t) => {
      const weekDate = parseWeekKey(t.weekKey);
      return weekDate >= rangeCutoff;
    });
  }, [trends, rangeCutoff]);

  const chartData = useMemo(() => {
    return filteredTrends
      .filter((t) => t.total > 0)
      .map((t) => ({
        weekLabel: t.weekLabel,
        acceptanceRate: Number(t.acceptanceRate),
        applied: t.applied,
        edited: t.edited,
        dismissed: t.dismissed,
        total: t.total,
      }));
  }, [filteredTrends]);

  const hasData = chartData.length >= 2;

  if (trends.length === 0) return null;

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--app-text-strong)]">Tendencia semanal</p>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              Evolucion de la tasa de aceptacion de sugerencias semana a semana.
            </p>
          </div>
          <div className="flex gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-0.5">
            {RANGE_OPTIONS.map((option) => {
              const active = option.days === rangeDays;
              return (
                <button
                  key={option.days}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150",
                    active
                      ? "bg-[var(--app-surface)] text-[var(--app-text-strong)] shadow-sm ring-1 ring-[var(--app-border)]"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface)]/60 hover:text-[var(--app-text)]",
                  )}
                  onClick={() => setRangeDays(option.days)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {hasData ? (
          <>
            <ResponsiveContainer height={220} width="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="var(--app-border-soft)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 10, fill: "var(--app-text-muted)" }}
                  interval="preserveStartEnd"
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--app-text-muted)" }}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  domain={[0, 1]}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  animationDuration={0}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <ChartTooltipContent
                        active={active}
                        payload={payload}
                        label={label}
                        labelClassName="mb-1.5 text-xs font-medium text-[var(--app-text-muted)]"
                      >
                        <div className="space-y-0.5">
                          {payload
                            .filter((entry) => entry.value !== undefined && entry.value !== null)
                            .map((entry, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span
                                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: entry.color }}
                                />
                                <span className="text-[var(--app-text-muted)]">
                                  {LABEL_MAP[entry.dataKey as string] ?? entry.dataKey}:
                                </span>
                                <span className="font-mono font-medium tabular-nums text-[var(--app-text-strong)]">
                                  {entry.dataKey === "acceptanceRate"
                                    ? `${(Number(entry.value ?? 0) * 100).toFixed(0)}%`
                                    : String(entry.value)}
                                </span>
                              </div>
                            ))}
                        </div>
                      </ChartTooltipContent>
                    );
                  }}
                />
                <Line
                  dataKey="acceptanceRate"
                  name="acceptanceRate"
                  stroke="var(--chart-2)"
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 0, fill: "var(--chart-2)" }}
                  activeDot={{ r: 5, strokeWidth: 0 }}
                  type="monotone"
                  connectNulls
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Weekly breakdown mini-table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--app-border-soft)] text-left font-semibold uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
                    <th className="pb-1.5 pr-3">Semana</th>
                    <th className="pb-1.5 pr-3 text-right">Total</th>
                    <th className="pb-1.5 pr-3 text-right">
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--chart-2)] align-middle" />{" "}
                      Aplicadas
                    </th>
                    <th className="pb-1.5 pr-3 text-right">
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--chart-6)] align-middle" />{" "}
                      Editadas
                    </th>
                    <th className="pb-1.5 text-right">
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--chart-7)] align-middle" />{" "}
                      Descartadas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrends
                    .filter((t) => t.total > 0)
                    .map((week) => (
                      <tr key={week.weekKey} className="border-b border-[var(--app-border-soft)] last:border-b-0">
                        <td className="py-1.5 pr-3 font-medium text-[var(--app-text)]">{week.weekLabel}</td>
                        <td className="py-1.5 pr-3 text-right text-[var(--app-text-muted)]">{week.total}</td>
                        <td className="py-1.5 pr-3 text-right font-medium text-[var(--chart-2)]">{week.applied}</td>
                        <td className="py-1.5 pr-3 text-right font-medium text-[var(--chart-6)]">{week.edited}</td>
                        <td className="py-1.5 text-right font-medium text-[var(--chart-7)]">{week.dismissed}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-4 py-6 text-center text-sm text-[var(--app-text-muted)]">
            No hay suficientes datos en los ultimos {rangeDays} dias para mostrar una tendencia.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
