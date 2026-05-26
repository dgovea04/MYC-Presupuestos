"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-slate-200">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">Histograma</CardTitle>
      </CardHeader>
      <CardContent className="h-80 p-5">
        {result ? (
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={result.histogramBins}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey="midpoint" tick={{ fontSize: 11 }} tickFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value) => [String(value), "Frecuencia"]}
                labelFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)}
              />
              <Bar dataKey="frequency" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-500">
            Ejecuta una simulacion para ver el histograma.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
