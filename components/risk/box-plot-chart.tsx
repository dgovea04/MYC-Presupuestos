"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import type { RiskBoxPlotStats } from "@/types/risk";

export function BoxPlotChart({
  currency,
  currencyDecimals,
  result,
}: {
  currency: string;
  currencyDecimals: number;
  result: RiskBoxPlotStats | null;
}) {
  if (!result) {
    return (
      <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
        <CardHeader className="px-5 py-4">
          <CardTitle className="text-base font-medium">Box Plot</CardTitle>
        </CardHeader>
        <CardContent className="flex h-52 items-center justify-center p-5 text-sm text-[var(--app-text-muted)]">
          Ejecuta una simulacion para ver el box plot.
        </CardContent>
      </Card>
    );
  }

  const range = Math.max(result.maximum - result.minimum, 1);
  const minLeft = 0;
  const q1Left = ((result.lowerQuartile - result.minimum) / range) * 100;
  const medianLeft = ((result.median - result.minimum) / range) * 100;
  const q3Left = ((result.upperQuartile - result.minimum) / range) * 100;
  const maxLeft = 100;

  return (
    <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
      <CardHeader className="px-5 py-4">
        <CardTitle className="text-base font-medium">Box Plot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-5">
        <div className="relative h-24">
          <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[var(--app-border)]" />
          <div
            className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--chart-2)]"
            style={{ left: `${minLeft}%`, width: `${q1Left - minLeft}%` }}
          />
          <div
            className="absolute top-1/2 h-12 -translate-y-1/2 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface-elevated)]"
            style={{ left: `${q1Left}%`, width: `${Math.max(q3Left - q1Left, 1)}%` }}
          />
          <div
            className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--chart-2)]"
            style={{ left: `${q3Left}%`, width: `${maxLeft - q3Left}%` }}
          />
          <div className="absolute top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--app-text-strong)]" style={{ left: `${minLeft}%` }} />
          <div className="absolute top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--chart-1)]" style={{ left: `${medianLeft}%` }} />
          <div className="absolute top-1/2 h-6 w-px -translate-x-1/2 -translate-y-1/2 bg-[var(--app-text-strong)]" style={{ left: `${maxLeft}%` }} />
        </div>

        <div className="grid gap-3 sm:grid-cols-5">
          <Stat label="Min" value={formatCurrency(result.minimum, currency, currencyDecimals)} />
          <Stat label="Q1" value={formatCurrency(result.lowerQuartile, currency, currencyDecimals)} />
          <Stat label="Mediana" value={formatCurrency(result.median, currency, currencyDecimals)} />
          <Stat label="Q3" value={formatCurrency(result.upperQuartile, currency, currencyDecimals)} />
          <Stat label="Max" value={formatCurrency(result.maximum, currency, currencyDecimals)} />
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-elevated)] px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-[var(--app-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-medium text-[var(--app-text-strong)]">{value}</p>
    </div>
  );
}
