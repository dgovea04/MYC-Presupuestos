import { Card, CardContent } from "@/components/ui/card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { formatDate } from "@/lib/utils";
import type { AdjustmentCalculationRecord } from "@/types/polynomial-formula";

export function PolynomialAdjustmentHistory({
  adjustments,
}: {
  adjustments: AdjustmentCalculationRecord[];
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
          <EmptyStatePanel message="Todavia no existen reajustes registrados para esta formula." />
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
                    <TD className="text-right tabular-nums">{adjustment.originalAmount}</TD>
                    <TD className="text-right tabular-nums">{adjustment.kRounded}</TD>
                    <TD className="text-right tabular-nums">{adjustment.adjustedAmount}</TD>
                    <TD className="text-right tabular-nums">{adjustment.adjustmentAmount}</TD>
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
