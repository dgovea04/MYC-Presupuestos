"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltipContent, Tooltip } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import type { RiskSimulationSummary } from "@/types/risk";

export function SCurveChart({
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
        <CardTitle className="text-base font-medium">Curva S acumulada</CardTitle>
      </CardHeader>
      <CardContent className="h-80 p-5">
        {result ? (
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={result.sCurvePoints}>
              <CartesianGrid stroke="var(--app-border-soft)" strokeDasharray="3 3" />
              <XAxis dataKey="cost" tick={{ fontSize: 11, fill: "var(--app-text-muted)" }} tickFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--app-text-muted)" }} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} axisLine={false} tickLine={false} />
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
                labelFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)}
              />
              <Line dataKey="cumulativeProbability" dot={false} stroke="var(--chart-2)" strokeWidth={2} type="monotone" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--app-text-muted)]">
            Ejecuta una simulacion para ver la curva S.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
