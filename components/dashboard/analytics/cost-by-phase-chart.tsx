"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, cn } from "@/lib/utils";
import type { CostByPhaseItem } from "@/lib/dashboard/analytics";

const SUB_BUDGET_COLORS = [
  "#2563EB", // blue
  "#059669", // emerald
  "#D97706", // amber
  "#7C3AED", // violet
  "#DC2626", // red
  "#0891B2", // cyan
  "#CA8A04", // yellow
  "#9333EA", // purple
  "#14B8A6", // teal
  "#E11D48", // rose
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

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; fill?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <p className="mb-2 font-medium text-slate-900">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.fill }}
          />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-medium text-slate-900">
            {formatCurrency(entry.value ?? 0, "PEN", 2)}
          </span>
        </div>
      ))}
    </div>
  );
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
      <Card className="border-slate-200">
        <CardHeader className="px-5 py-3">
          <CardTitle className="text-base">Costo por fase / subpresupuesto</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">
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

  const stackedBars = [
    { dataKey: "total", label: "Subpresupuesto", fill: true },
  ];

  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between px-5 py-3">
        <CardTitle className="text-base">Costo por fase / subpresupuesto</CardTitle>
        <select
          value={selected.projectId}
          onChange={(e) => setSelectedProject(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        >
          {chartData.map((d) => (
            <option key={d.projectId} value={d.projectId}>
              {d.projectName}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 py-2.5">
          <span className="text-sm text-slate-600">Total presupuesto general</span>
          <span className="text-lg font-semibold text-slate-900">
            {formatCurrency(selected.totalAmount, selected.currency, currencyDecimals)}
          </span>
        </div>

        <ResponsiveContainer height={Math.max(200, selected.subBudgets.length * 48)} width="100%">
          <BarChart
            data={selected.subBudgets}
            layout="vertical"
            margin={{ top: 4, right: 8, bottom: 4, left: 100 }}
          >
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => formatCurrency(value, selected.currency, 0)}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={94}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="total" radius={[0, 6, 6, 0]} minPointSize={4}>
              {selected.subBudgets.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="mt-4 flex flex-wrap gap-3">
          {selected.subBudgets.map((sub, i) => (
            <div key={sub.name} className="flex items-center gap-1.5 text-xs text-slate-600">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: sub.fill }}
              />
              <span>{sub.name}</span>
              <span className="font-medium text-slate-800">
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
