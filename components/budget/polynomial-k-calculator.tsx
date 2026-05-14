import { Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyStatePanel } from "@/components/ui/empty-state-panel";
import { InfoCard } from "@/components/ui/info-cards";
import { Input } from "@/components/ui/input";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

type KPreviewResult = {
  kRaw: string;
  kRounded: string;
  terms: Array<{
    name: string;
    coefficient: string;
    baseIndexValue: string;
    adjustmentIndexValue: string;
    ratio: string;
    partial: string;
  }>;
};

export function PolynomialKCalculator({
  previewMonth,
  previewYear,
  originalAmount,
  onPreviewMonthChange,
  onPreviewYearChange,
  onOriginalAmountChange,
  result,
  resultError,
  isLoading,
  adjustedAmounts,
  canApply,
  onApplyAdjustment,
  isApplyingAdjustment,
}: {
  previewMonth: number;
  previewYear: number;
  originalAmount: string;
  onPreviewMonthChange: (value: number) => void;
  onPreviewYearChange: (value: number) => void;
  onOriginalAmountChange: (value: string) => void;
  result: KPreviewResult | null;
  resultError: string;
  isLoading: boolean;
  adjustedAmounts: {
    originalAmount: string;
    adjustedAmount: string;
    adjustmentAmount: string;
  } | null;
  canApply: boolean;
  onApplyAdjustment: () => void;
  isApplyingAdjustment: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <OperationalPanel
          title="Cálculo de K y valorización"
          description="Ajusta el período de valorización y revisa la tabla de relación de índices antes de aplicar el reajuste."
          metrics={result ? <span>{result.terms.length} monomios en cálculo</span> : undefined}
        />

        <div className="grid gap-4 lg:grid-cols-[140px_160px_minmax(220px,1fr)_auto]">
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Mes reajuste</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={previewMonth}
              onChange={(event) => onPreviewMonthChange(Number(event.target.value))}
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Año reajuste</label>
            <Input
              type="number"
              min={1979}
              value={previewYear}
              onChange={(event) => onPreviewYearChange(Number(event.target.value))}
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Valorización original</label>
            <Input
              type="number"
              step="0.01"
              value={originalAmount}
              onChange={(event) => onOriginalAmountChange(event.target.value)}
              className="mt-2"
            />
          </div>
          <div className="flex items-end">
            <Button type="button" onClick={onApplyAdjustment} disabled={!canApply || isApplyingAdjustment}>
              <Calculator className="mr-2 h-4 w-4" />
              {isApplyingAdjustment ? "Aplicando..." : "Aplicar reajuste"}
            </Button>
          </div>
        </div>

        {isLoading ? <p className="text-sm text-slate-500">Calculando K...</p> : null}
        {resultError ? <p className="text-sm text-rose-600">{resultError}</p> : null}

        {result ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <InfoCard label="K raw" value={result.kRaw} tone="slate" />
              <InfoCard label="K redondeado" value={result.kRounded} tone="sky" />
              <InfoCard
                label="Monto original"
                value={adjustedAmounts?.originalAmount ?? originalAmount}
                tone="slate"
              />
              <InfoCard
                label="Monto reajustado"
                value={adjustedAmounts?.adjustedAmount ?? "-"}
                tone="sky"
              />
              <InfoCard
                label="Reajuste"
                value={adjustedAmounts?.adjustmentAmount ?? "-"}
                tone="amber"
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <Table>
                <THead>
                  <TR className="bg-slate-50 hover:bg-slate-50">
                    <TH>Monomio</TH>
                    <TH className="text-right">Coeficiente</TH>
                    <TH className="text-right">Indice base</TH>
                    <TH className="text-right">Indice reajuste</TH>
                    <TH className="text-right">Relacion</TH>
                    <TH className="text-right">Parcial</TH>
                  </TR>
                </THead>
                <TBody>
                  {result.terms.map((term) => (
                    <TR key={term.name}>
                      <TD>{term.name}</TD>
                      <TD className="text-right tabular-nums">{term.coefficient}</TD>
                      <TD className="text-right tabular-nums">{term.baseIndexValue}</TD>
                      <TD className="text-right tabular-nums">{term.adjustmentIndexValue}</TD>
                      <TD className="text-right tabular-nums">{term.ratio}</TD>
                      <TD className="text-right tabular-nums">{term.partial}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          </>
        ) : (
          <EmptyStatePanel message="Cuando la fórmula tenga índices base completos, el sistema calculará K automáticamente para el período indicado." />
        )}
      </CardContent>
    </Card>
  );
}
