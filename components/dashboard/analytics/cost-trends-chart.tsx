"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Dot,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CostTrendPoint } from "@/lib/dashboard/analytics";

type TrendDatum = {
  period: string;
  label: string;
  [projectKey: string]: number | string;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <p className="mb-2 text-xs font-medium text-slate-500">{label}</p>
      <div className="space-y-1">
        {payload
          .filter((entry) => entry.value !== undefined && entry.value !== null)
          .map((entry, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-600">{entry.name}:</span>
              <span className="font-mono font-medium text-slate-900">
                K = {(entry.value ?? 0).toFixed(3)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function buildTrendLines(points: CostTrendPoint[]): {
  data: TrendDatum[];
  lines: string[];
} {
  const grouped = new Map<string, Map<string, number>>();

  for (const point of points) {
    if (!grouped.has(point.period)) {
      grouped.set(point.period, new Map());
    }
    const periodMap = grouped.get(point.period)!;
    periodMap.set(point.projectName, point.kValue);
  }

  const sortedPeriods = [...grouped.keys()].sort();
  const projectNames = [...new Set(points.map((p) => p.projectName))];

  const data: TrendDatum[] = sortedPeriods.map((period) => {
      const [year, month] = period.split("-");
      const datum: TrendDatum = {
        period,
        label: `${month}/${year}`,
      };
    const periodMap = grouped.get(period)!;
    for (const projectName of projectNames) {
      datum[projectName] = periodMap.get(projectName) ?? 0;
    }
    return datum;
  });

  return { data, lines: projectNames };
}

const PROJECT_COLORS = [
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#DC2626",
  "#0891B2",
  "#E11D48",
  "#65A30D",
];

export function CostTrendsChart({
  data,
}: {
  data: CostTrendPoint[];
}) {
  const { data: chartData, lines } = useMemo(() => buildTrendLines(data), [data]);

  if (data.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="px-5 py-3">
          <CardTitle className="text-base">Tendencias de K históricas</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">
            Registra reajustes en la fórmula polinómica para ver la evolución del coeficiente K.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">Tendencias de K históricas</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <ResponsiveContainer height={280} width="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
              domain={[0.9, "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />
            {lines.map((projectName, index) => {
              const hasData = chartData.some((d) => (d[projectName] as number) > 0);
              if (!hasData) return null;
              return (
                <Line
                  key={projectName}
                  dataKey={projectName}
                  name={projectName}
                  stroke={PROJECT_COLORS[index % PROJECT_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 1.5 }}
                  activeDot={{ r: 5, strokeWidth: 2 }}
                  type="monotone"
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>

        {lines.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {lines.map((name, i) => (
              <div key={name} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PROJECT_COLORS[i % PROJECT_COLORS.length] }}
                />
                <span>{name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
