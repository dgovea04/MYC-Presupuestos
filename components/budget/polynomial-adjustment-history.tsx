import { Card, CardContent } from "@/components/ui/card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AdjustmentCalculationRecord } from "@/types/polynomial-formula";

function formatThreeDecimals(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(3) : value;
}

export function PolynomialAdjustmentHistory({
  adjustments,
  currency,
  currencyDecimals,
}: {
  adjustments: AdjustmentCalculationRecord[];
  currency: string;
  currencyDecimals: number;
}) {
  const { dateFormat } = useFormattingSettings();
  const { isExcelMode } = useAppViewMode();

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <OperationalPanel
          title="Historial de reajustes"
          description="Registro mensual de valorizaciones recalculadas con su coeficiente K."
          metrics={<span>{adjustments.length} registros</span>}
        />

        {adjustments.length === 0 ? (
          <EmptyStatePanel message="Registra una valorizacion reajustada para iniciar el historial mensual de coeficientes K." />
        ) : (
          <div className={getTableFrameClassName(isExcelMode)}>
            <Table>
              <THead>
                <TR className="bg-slate-50 hover:bg-slate-50">
                  <TH>Periodo</TH>
                  <TH className="text-right">Monto original</TH>
                  <TH className="text-right">K</TH>
                  <TH className="text-right">Monto reajustado</TH>
                  <TH className="text-right">Reajuste</TH>
                </TR>
              </THead>
              <TBody>
                {adjustments.map((adjustment) => (
                  <TR key={adjustment.id}>
                    <TD>{formatDate(new Date(adjustment.year, adjustment.month - 1, 1), dateFormat)}</TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrency(Number(adjustment.originalAmount), currency, currencyDecimals)}
                    </TD>
                    <TD className="text-right tabular-nums">{formatThreeDecimals(adjustment.kRounded)}</TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrency(Number(adjustment.adjustedAmount), currency, currencyDecimals)}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrency(Number(adjustment.adjustmentAmount), currency, currencyDecimals)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
