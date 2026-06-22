"use client";

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
import type { BudgetComparisonItem } from "@/lib/dashboard/analytics";

// Chart colors defined in globals.css --chart-1 … --chart-8
const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export function BudgetComparisonChart({
  data,
  currencyDecimals = 2,
}: {
  data: BudgetComparisonItem[];
  currencyDecimals?: number;
}) {
  if (data.length === 0) {
    return (
      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardHeader className="px-5 py-4">
          <CardTitle className="text-base font-medium">Comparativa de presupuestos</CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex h-48 items-center justify-center text-sm text-[var(--app-text-muted)]">
            Registra presupuestos generales para ver la comparativa entre proyectos.
          </div>
        </CardContent>
      </Card>
    );
  }

  const visibleData = data.slice(0, 8);

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-base font-medium">Comparativa de presupuestos</CardTitle>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <ResponsiveContainer height={Math.max(180, visibleData.length * 44)} width="100%">
          <BarChart
            data={visibleData}
            layout="vertical"
            margin={{ top: 4, right: 16, bottom: 4, left: 120 }}
          >
            <CartesianGrid stroke="var(--app-border-soft)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--app-text-muted)" }}
              tickFormatter={(value) => formatCurrency(value, "PEN", 0)}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="projectName"
              tick={{ fontSize: 11, fill: "var(--app-text)" }}
              width={118}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              animationDuration={0}
              cursor={{ fill: "var(--app-surface-muted)", radius: 4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]?.payload as BudgetComparisonItem | undefined;
                if (!item) return null;
                return (
                  <ChartTooltipContent active={active} payload={payload}>
                    <p className="font-medium text-[var(--app-text-strong)]">{item.projectName}</p>
                    <div className="mt-1.5 space-y-0.5">
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-[var(--app-text-muted)]">Presupuesto total</span>
                        <span className="font-medium tabular-nums text-[var(--app-text-strong)]">
                          {formatCurrency(item.totalAmount, item.currency, currencyDecimals)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-6">
                        <span className="text-[var(--app-text-muted)]">Costo directo</span>
                        <span className="font-medium tabular-nums text-[var(--app-text-strong)]">
                          {formatCurrency(item.totalDirectCost, item.currency, currencyDecimals)}
                        </span>
                      </div>
                    </div>
                  </ChartTooltipContent>
                );
              }}
            />
            <Bar dataKey="totalAmount" radius={[0, 4, 4, 0]} minPointSize={6} isAnimationActive={false}>
              {visibleData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {data.length > 8 && (
          <p className="mt-3 text-center text-xs text-[var(--app-text-muted)]">
            Mostrando 8 de {data.length} presupuestos
          </p>
        )}
      </CardContent>
    </Card>
  );
}
