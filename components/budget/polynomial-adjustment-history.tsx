import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { AdjustmentCalculationRecord } from "@/types/polynomial-formula";

export function PolynomialAdjustmentHistory({
  adjustments,
}: {
  adjustments: AdjustmentCalculationRecord[];
}) {
  const { dateFormat } = useFormattingSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de reajustes</CardTitle>
        <CardDescription>
          Registro mensual de valorizaciones recalculadas con su coeficiente K.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {adjustments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-600">
            Todavia no existen reajustes registrados para esta formula.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
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
