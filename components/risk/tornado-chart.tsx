"use client";

import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartTooltipContent, Tooltip } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";
import type { RiskTornadoRow } from "@/types/risk";

export function TornadoChart({
  currency,
  currencyDecimals,
  rows,
}: {
  currency: string;
  currencyDecimals: number;
  rows: RiskTornadoRow[];
}) {
  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-base font-medium">Sensibilidad</CardTitle>
      </CardHeader>
      <CardContent className="h-80 p-5">
        {rows.length > 0 ? (
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke="var(--app-border-soft)" strokeDasharray="3 3" horizontal={false} />
              <ReferenceLine stroke="var(--app-border)" x={0} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: "var(--app-text-muted)" }}
                tickFormatter={(value) => formatCurrency(Number(value), currency, currencyDecimals)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={108}
                tick={{ fontSize: 11, fill: "var(--app-text-muted)" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                animationDuration={0}
                cursor={{ fill: "var(--app-surface-muted)", radius: 4 }}
                content={({ active, payload, label }) => {
                  const row = payload?.[0]?.payload as RiskTornadoRow | undefined;

                  return (
                    <ChartTooltipContent active={active} payload={payload} label={label}>
                      <div className="space-y-1.5">
                        <p className="text-[var(--app-text-muted)]">
                          Min: <span className="font-medium text-[var(--app-text-strong)]">{formatCurrency(row?.lowDelta ?? 0, currency, currencyDecimals)}</span>
                        </p>
                        <p className="text-[var(--app-text-muted)]">
                          Max: <span className="font-medium text-[var(--app-text-strong)]">{formatCurrency(row?.highDelta ?? 0, currency, currencyDecimals)}</span>
                        </p>
                        <p className="text-[var(--app-text-muted)]">
                          Impacto: <span className="font-medium text-[var(--app-text-strong)]">{formatCurrency(row?.impact ?? 0, currency, currencyDecimals)}</span>
                        </p>
                      </div>
                    </ChartTooltipContent>
                  );
                }}
              />
              <Bar dataKey="lowDelta" fill="var(--app-danger-soft, #fca5a5)" radius={[4, 0, 0, 4]} isAnimationActive={false} />
              <Bar dataKey="highDelta" fill="var(--chart-1)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--app-text-muted)]">
            Activa variables para ver sensibilidad.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
