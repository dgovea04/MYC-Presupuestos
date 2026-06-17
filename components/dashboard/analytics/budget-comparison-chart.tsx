"use client";

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
import { formatCurrency } from "@/lib/utils";
import type { BudgetComparisonItem } from "@/lib/dashboard/analytics";

const GRADIENT_BARS = ["#2563EB", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: BudgetComparisonItem }>;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0].payload;
  if (!item) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm">
      <p className="font-medium text-slate-900">{item.projectName}</p>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500">Presupuesto total</span>
          <span className="font-medium text-slate-900">
            {formatCurrency(item.totalAmount, item.currency, 2)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-500">Costo directo</span>
          <span className="font-medium text-slate-900">
            {formatCurrency(item.totalDirectCost, item.currency, 2)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function BudgetComparisonChart({
  data,
}: {
  data: BudgetComparisonItem[];
}) {
  if (data.length === 0) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="px-5 py-3">
          <CardTitle className="text-base">Comparativa de presupuestos</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex h-48 items-center justify-center text-sm text-slate-500">
            Registra presupuestos generales para ver la comparativa entre proyectos.
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show max 8 projects to keep the chart readable
  const visibleData = data.slice(0, 8);

  return (
    <Card className="border-slate-200">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">Comparativa de presupuestos</CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        <ResponsiveContainer height={Math.max(180, visibleData.length * 44)} width="100%">
          <BarChart
            data={visibleData}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 120 }}
          >
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => formatCurrency(value, "PEN", 0)}
            />
            <YAxis
              type="category"
              dataKey="projectName"
              tick={{ fontSize: 11 }}
              width={118}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="totalAmount" radius={[0, 6, 6, 0]} minPointSize={6}>
              {visibleData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={GRADIENT_BARS[index % GRADIENT_BARS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {data.length > 8 && (
          <p className="mt-3 text-center text-xs text-slate-500">
            Mostrando 8 de {data.length} presupuestos
          </p>
        )}
      </CardContent>
    </Card>
  );
}
