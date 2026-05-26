import { BarChart3, Gauge, LineChart, Sigma } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { RiskSimulationSummary } from "@/types/risk";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

export function RiskKPICards({
  currency,
  currencyDecimals,
  result,
}: {
  currency: string;
  currencyDecimals: number;
  result: RiskSimulationSummary | null;
}) {
  const values: Array<{ icon: IconComponent; label: string; value: string }> = [
    { icon: Gauge, label: "P50", value: result ? formatCurrency(result.p50, currency, currencyDecimals) : "-" },
    { icon: LineChart, label: "P80", value: result ? formatCurrency(result.p80, currency, currencyDecimals) : "-" },
    { icon: BarChart3, label: "P90", value: result ? formatCurrency(result.p90, currency, currencyDecimals) : "-" },
    {
      icon: Sigma,
      label: "Desv. estandar",
      value: result ? formatCurrency(result.standardDeviation, currency, currencyDecimals) : "-",
    },
    { icon: Sigma, label: "Varianza", value: result ? formatNumber(result.variance, 2) : "-" },
    { icon: Gauge, label: "Curtosis", value: result ? formatNumber(result.kurtosis, 4) : "-" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {values.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 truncate text-lg font-semibold text-slate-950">{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}
