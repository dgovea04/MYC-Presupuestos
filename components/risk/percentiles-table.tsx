import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { RiskPercentileKey, RiskSimulationSummary } from "@/types/risk";

const percentileRows: Array<{ key: RiskPercentileKey; label: string }> = [
  { key: "p10", label: "P10" },
  { key: "p50", label: "P50" },
  { key: "p80", label: "P80" },
  { key: "p90", label: "P90" },
  { key: "p95", label: "P95" },
];

export function PercentilesTable({
  baseTotal,
  currency,
  currencyDecimals,
  result,
}: {
  baseTotal: number;
  currency: string;
  currencyDecimals: number;
  result: RiskSimulationSummary | null;
}) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="px-5 py-3">
        <CardTitle className="text-base">Percentiles y contingencia</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <THead className="bg-slate-100">
            <TR className="hover:bg-slate-100">
              <TH className="px-4 py-2 text-xs uppercase tracking-wide">Percentil</TH>
              <TH className="px-4 py-2 text-xs uppercase tracking-wide">Monto</TH>
              <TH className="px-4 py-2 text-xs uppercase tracking-wide">Delta vs base</TH>
              <TH className="px-4 py-2 text-xs uppercase tracking-wide">Contingencia</TH>
            </TR>
          </THead>
          <TBody>
            {percentileRows.map((row) => {
              const value = result?.[row.key] ?? 0;
              const delta = value - baseTotal;
              const contingency = baseTotal > 0 ? delta / baseTotal : 0;

              return (
                <TR key={row.key}>
                  <TD className="px-4 py-2 font-medium text-slate-900">{row.label}</TD>
                  <TD className="px-4 py-2">{result ? formatCurrency(value, currency, currencyDecimals) : "-"}</TD>
                  <TD className="px-4 py-2">{result ? formatCurrency(delta, currency, currencyDecimals) : "-"}</TD>
                  <TD className="px-4 py-2">{result ? `${formatNumber(contingency * 100, 2)}%` : "-"}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
