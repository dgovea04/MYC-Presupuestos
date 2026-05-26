"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-slate-200">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">Curva S acumulada</CardTitle>
      </CardHeader>
      <CardContent className="h-80 p-5">
        {result ? (
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={result.sCurvePoints}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey="cost" tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) * 100)}%`} />
              <Tooltip
                formatter={(value) => [`${Math.round(Number(value) * 100)}%`, "Probabilidad acumulada"]}
                labelFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)}
              />
              <Line dataKey="cumulativeProbability" dot={false} stroke="#10B981" strokeWidth={2} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Ejecuta una simulacion para ver la curva S.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
