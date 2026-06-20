"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { FeedbackTrendPoint } from "@/lib/ai/suggestion-feedback";

const TREND_COLORS = {
  acceptanceRate: "#10B981",
  applied: "#10B981",
  edited: "#0EA5E9",
  dismissed: "#F43F5E",
} as const;

type RangeDays = 7 | 30 | 90;

const RANGE_OPTIONS: Array<{ label: string; days: RangeDays }> = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <div className="space-y-1">
        {payload
          .filter((entry) => entry.value !== undefined && entry.value !== null)
          .map((entry, i) => {
            const labelMap: Record<string, string> = {
              acceptanceRate: "Aceptacion",
              applied: "Aplicadas",
              edited: "Editadas",
              dismissed: "Descartadas",
            };
            return (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-slate-600">{labelMap[entry.dataKey ?? ""] ?? entry.dataKey}:</span>
                <span className="font-mono font-medium text-slate-900">
                  {entry.dataKey === "acceptanceRate"
                    ? `${((entry.value ?? 0) * 100).toFixed(0)}%`
                    : String(entry.value)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

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
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Tendencia semanal</p>
            <p className="mt-1 text-sm text-slate-500">
              Evolucion de la tasa de aceptacion de sugerencias semana a semana.
            </p>
          </div>
          <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100/60 p-0.5">
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
                      ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:bg-white/60 hover:text-slate-800",
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
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  domain={[0, 1]}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  dataKey="acceptanceRate"
                  name="acceptanceRate"
                  stroke={TREND_COLORS.acceptanceRate}
                  strokeWidth={2.5}
                  dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                  activeDot={{ r: 6, strokeWidth: 2 }}
                  type="monotone"
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>

            {/* Weekly breakdown mini-table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <th className="pb-1.5 pr-3">Semana</th>
                    <th className="pb-1.5 pr-3 text-right">Total</th>
                    <th className="pb-1.5 pr-3 text-right">
                      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />{" "}
                      Aplicadas
                    </th>
                    <th className="pb-1.5 pr-3 text-right">
                      <span className="inline-block h-2 w-2 rounded-full bg-sky-500 align-middle" />{" "}
                      Editadas
                    </th>
                    <th className="pb-1.5 text-right">
                      <span className="inline-block h-2 w-2 rounded-full bg-rose-400 align-middle" />{" "}
                      Descartadas
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrends
                    .filter((t) => t.total > 0)
                    .map((week) => (
                      <tr key={week.weekKey} className="border-b border-slate-50 last:border-b-0">
                        <td className="py-1.5 pr-3 font-medium text-slate-700">{week.weekLabel}</td>
                        <td className="py-1.5 pr-3 text-right text-slate-600">{week.total}</td>
                        <td className="py-1.5 pr-3 text-right text-emerald-700">{week.applied}</td>
                        <td className="py-1.5 pr-3 text-right text-sky-700">{week.edited}</td>
                        <td className="py-1.5 text-right text-rose-600">{week.dismissed}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No hay suficientes datos en los ultimos {rangeDays} dias para mostrar una tendencia.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
