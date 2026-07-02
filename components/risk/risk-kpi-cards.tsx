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
    { icon: Sigma, label: "Promedio", value: result ? formatCurrency(result.mean, currency, currencyDecimals) : "-" },
    { icon: Sigma, label: "Mediana", value: result ? formatCurrency(result.median, currency, currencyDecimals) : "-" },
    { icon: Gauge, label: "P50", value: result ? formatCurrency(result.p50, currency, currencyDecimals) : "-" },
    { icon: LineChart, label: "P80", value: result ? formatCurrency(result.p80, currency, currencyDecimals) : "-" },
    { icon: BarChart3, label: "P90", value: result ? formatCurrency(result.p90, currency, currencyDecimals) : "-" },
    {
      icon: Sigma,
      label: "Desv. estandar",
      value: result ? formatCurrency(result.standardDeviation, currency, currencyDecimals) : "-",
    },
    { icon: Gauge, label: "Asimetria", value: result ? formatNumber(result.skewness, 4) : "-" },
    { icon: Gauge, label: "Curtosis", value: result ? formatNumber(result.kurtosis, 4) : "-" },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {values.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.label} className="theme-surface-card rounded-2xl border px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="theme-muted-text text-xs font-medium uppercase tracking-wide">{item.label}</p>
              <span className="theme-muted-panel theme-muted-text inline-flex h-7 w-7 items-center justify-center rounded-lg">
                <Icon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="theme-strong-text mt-2 truncate text-lg font-semibold">{item.value}</p>
          </div>
        );
      })}
    </div>
  );
}
