"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltipContent, Tooltip } from "@/components/ui/chart";
import type { CostTrendPoint } from "@/lib/dashboard/analytics";

type TrendDatum = {
  period: string;
  label: string;
  [projectKey: string]: number | string;
};

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

// Chart colors defined in globals.css --chart-1 … --chart-8
const PROJECT_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export function CostTrendsChart({
  data,
}: {
  data: CostTrendPoint[];
}) {
  const { data: chartData, lines } = useMemo(() => buildTrendLines(data), [data]);

  if (data.length === 0) {
    return (
      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardHeader className="px-5 py-4">
          <CardTitle className="text-base font-medium">Tendencias de K históricas</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex h-48 items-center justify-center text-sm text-[var(--app-text-muted)]">
            Registra reajustes en la fórmula polinómica para ver la evolución del coeficiente K.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-base font-medium">Tendencias de K históricas</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <ResponsiveContainer height={260} width="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid stroke="var(--app-border-soft)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--app-text-muted)" }}
              interval="preserveStartEnd"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--app-text-muted)" }}
              tickFormatter={(value) => `${(value * 100).toFixed(1)}%`}
              domain={[0.9, "auto"]}
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
                            <span className="text-[var(--app-text-muted)]">{entry.name}:</span>
                            <span className="font-mono font-medium tabular-nums text-[var(--app-text-strong)]">
                              K = {Number(entry.value ?? 0).toFixed(3)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </ChartTooltipContent>
                );
              }}
            />
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
                  dot={{ r: 3, strokeWidth: 0, fill: PROJECT_COLORS[index % PROJECT_COLORS.length] }}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  type="monotone"
                  connectNulls
                  isAnimationActive={false}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>

        {lines.length > 1 && (
          <div className="mt-3 flex flex-wrap gap-3">
            {lines.map((name, i) => (
              <div key={name} className="flex items-center gap-1.5 text-xs text-[var(--app-text-muted)]">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
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
