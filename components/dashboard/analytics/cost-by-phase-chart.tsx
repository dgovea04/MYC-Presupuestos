"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltipContent, Tooltip } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import type { CostByPhaseItem } from "@/lib/dashboard/analytics";

// Chart colors defined in globals.css --chart-1 … --chart-10
const SUB_BUDGET_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
];

type SubBudgetDatum = {
  name: string;
  total: number;
  fill: string;
};

type ProjectChartDatum = {
  projectName: string;
  projectId: string;
  totalAmount: number;
  currency: string;
  subBudgets: SubBudgetDatum[];
};

function buildChartData(items: CostByPhaseItem[]): ProjectChartDatum[] {
  return items.map((item) => {
    const sortedSubs = [...item.subBudgets].sort((a, b) => b.totalAmount - a.totalAmount);
    return {
      projectName: item.projectName,
      projectId: item.projectId,
      totalAmount: item.generalTotal,
      currency: item.currency,
      subBudgets: sortedSubs.map((sub, i) => ({
        name: sub.subBudgetName,
        total: sub.totalAmount,
        fill: SUB_BUDGET_COLORS[i % SUB_BUDGET_COLORS.length],
      })),
    };
  });
}

export function CostByPhaseChart({
  data,
  currencyDecimals,
}: {
  data: CostByPhaseItem[];
  currencyDecimals: number;
}) {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  const chartData = useMemo(() => buildChartData(data), [data]);

  if (data.length === 0) {
    return (
      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardHeader className="px-5 py-4">
          <CardTitle className="text-base font-medium">Costo por fase / subpresupuesto</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex h-48 items-center justify-center text-sm text-[var(--app-text-muted)]">
            Crea presupuestos con subpresupuestos para ver el desglose por especialidad.
          </div>
        </CardContent>
      </Card>
    );
  }

  const selected = selectedProject
    ? chartData.find((d) => d.projectId === selectedProject)
    : chartData[0];

  if (!selected) return null;

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
        <CardTitle className="text-base font-medium">Costo por fase / subpresupuesto</CardTitle>
        <select
          value={selected.projectId}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-sm text-[var(--app-text)] focus:border-[var(--app-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--app-primary-muted)]"
        >
          {chartData.map((d) => (
            <option key={d.projectId} value={d.projectId}>
              {d.projectName}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[var(--app-surface-muted)] px-4 py-2.5">
          <span className="text-sm text-[var(--app-text-muted)]">Total presupuesto general</span>
          <span className="text-lg font-semibold tabular-nums text-[var(--app-text-strong)]">
            {formatCurrency(selected.totalAmount, selected.currency, currencyDecimals)}
          </span>
        </div>

        <ResponsiveContainer
          height={Math.max(200, selected.subBudgets.length * 44 + 40)}
          width="100%"
        >
          <BarChart
            data={selected.subBudgets}
            layout="vertical"
            barCategoryGap={20}
            margin={{ top: 4, right: 8, bottom: 4, left: 100 }}
          >
            <CartesianGrid stroke="var(--app-border-soft)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--app-text-muted)" }}
              tickFormatter={(value) => formatCurrency(value, selected.currency, 0)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--app-text)" }}
              width={94}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              animationDuration={0}
              cursor={{ fill: "var(--app-surface-muted)", radius: 4 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <ChartTooltipContent active={active} payload={payload} label={label}>
                    {payload.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-[var(--app-text-muted)]">{entry.name}:</span>
                        <span className="font-medium tabular-nums text-[var(--app-text-strong)]">
                          {formatCurrency(Number(entry.value ?? 0), "PEN", 2)}
                        </span>
                      </div>
                    ))}
                  </ChartTooltipContent>
                );
              }}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={24} isAnimationActive={false}>
              {selected.subBudgets.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 flex flex-wrap gap-3">
          {selected.subBudgets.map((sub) => (
            <div key={sub.name} className="flex items-center gap-1.5 text-xs text-[var(--app-text-muted)]">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: sub.fill }}
              />
              <span>{sub.name}</span>
              <span className="font-medium text-[var(--app-text)]">
                ({selected.totalAmount > 0
                  ? ((sub.total / selected.totalAmount) * 100).toFixed(1)
                  : "0.0"}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
