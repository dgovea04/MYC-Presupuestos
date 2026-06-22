"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltipContent, Tooltip } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import type { RiskSimulationSummary } from "@/types/risk";

export function HistogramChart({
  currency,
  currencyDecimals,
  result,
}: {
  currency: string;
  currencyDecimals: number;
  result: RiskSimulationSummary | null;
}) {
  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-base font-medium">Histograma</CardTitle>
      </CardHeader>
      <CardContent className="h-80 p-5">
        {result ? (
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={result.histogramBins}>
              <CartesianGrid stroke="var(--app-border-soft)" strokeDasharray="3 3" />
              <XAxis dataKey="midpoint" tick={{ fontSize: 11, fill: "var(--app-text-muted)" }} tickFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--app-text-muted)" }} axisLine={false} tickLine={false} />
              <Tooltip
                animationDuration={0}
                content={({ active, payload, label }) => (
                  <ChartTooltipContent active={active} payload={payload} label={label}>
                    <span className="text-[var(--app-text-muted)]">Frecuencia: </span>
                    <span className="font-medium tabular-nums text-[var(--app-text-strong)]">{payload?.[0]?.value}</span>
                  </ChartTooltipContent>
                )}
                labelFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)}
              />
              <Bar dataKey="frequency" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--app-text-muted)]">
            Ejecuta una simulacion para ver el histograma.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
