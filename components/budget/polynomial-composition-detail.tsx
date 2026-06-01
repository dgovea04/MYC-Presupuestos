"use client";

import { Card, CardContent } from "@/components/ui/card";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { cn, formatNumber } from "@/lib/utils";
import type {
  PolynomialMonomialCompositionRecord,
  PolynomialMonomialRecord,
} from "@/types/polynomial-formula";

type CompositionDetailRow = {
  id: string;
  monomialCode: string;
  monomialName: string;
  monomialCoefficient: string;
  unifiedIndexCode?: string;
  unifiedIndexName?: string;
  iuFamily?: string;
  amount?: string;
  participationPercentage?: string;
  coefficientContribution?: string;
  sourceIds: string[];
  hasComposition: boolean;
};

function formatDecimalString(value: string | undefined, decimalPlaces: number) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "-";
  }

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? formatNumber(numericValue, decimalPlaces) : trimmed;
}

function formatPercentage(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "-";
  }

  const numericValue = Number(trimmed);
  return Number.isFinite(numericValue) ? `${formatNumber(numericValue * 100, 2)}%` : trimmed;
}

function getCompositionSourceIds(component: PolynomialMonomialCompositionRecord) {
  return [component.budgetItemId, component.apuResourceId].filter((value): value is string => Boolean(value));
}

function formatSourceCount(count: number) {
  return `${count} fuente${count === 1 ? "" : "s"}`;
}

function truncateSourceId(sourceId: string) {
  return sourceId.length <= 18 ? sourceId : `${sourceId.slice(0, 8)}...${sourceId.slice(-6)}`;
}

function buildRows(monomials: PolynomialMonomialRecord[]): CompositionDetailRow[] {
  return monomials.flatMap((monomial) => {
    if (monomial.composition.length === 0) {
      return [
        {
          id: `${monomial.id}:empty`,
          monomialCode: monomial.code,
          monomialName: monomial.name,
          monomialCoefficient: monomial.coefficient,
          sourceIds: [],
          hasComposition: false,
        },
      ];
    }

    return monomial.composition.map((component) => ({
      id: component.id,
      monomialCode: monomial.code,
      monomialName: monomial.name,
      monomialCoefficient: monomial.coefficient,
      unifiedIndexCode: component.unifiedIndexCode,
      unifiedIndexName: component.unifiedIndexName,
      iuFamily: component.iuFamily,
      amount: component.amount,
      participationPercentage: component.participationPercentage,
      coefficientContribution: component.coefficientContribution,
      sourceIds: getCompositionSourceIds(component),
      hasComposition: true,
    }));
  });
}

export function PolynomialCompositionDetail({
  monomials,
}: {
  monomials: PolynomialMonomialRecord[];
}) {
  const { isExcelMode } = useAppViewMode();
  const rows = buildRows(monomials);
  const componentCount = monomials.reduce((total, monomial) => total + monomial.composition.length, 0);

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <OperationalPanel
          title="Detalle de composicion"
          description="Trazabilidad DEV de los insumos agrupados para formar cada monomio."
          metrics={
            <>
              <span className={cn("border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700", isExcelMode ? "rounded-sm" : "rounded-full")}>
                DEV
              </span>
              <span>{componentCount} componentes</span>
            </>
          }
        />

        {rows.length === 0 ? (
          <div className={cn("border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600", isExcelMode ? "rounded-md border-slate-300" : "rounded-2xl")}>
            Sin monomios disponibles para inspeccionar.
          </div>
        ) : (
          <div className={getTableFrameClassName(isExcelMode, "overflow-x-auto")}>
            <Table className="min-w-[1180px]">
              <THead>
                <TR className="bg-slate-50 hover:bg-slate-50">
                  <TH>Monomio</TH>
                  <TH className="text-right">Coef.</TH>
                  <TH>Indice unificado</TH>
                  <TH>Familia IU</TH>
                  <TH className="text-right">Monto (S/)</TH>
                  <TH className="text-right">Participacion</TH>
                  <TH className="text-right">Aporte coef.</TH>
                  <TH>Fuente</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id} className={row.hasComposition ? undefined : "bg-slate-50/60"}>
                    <TD className="align-top">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{row.monomialCode}</p>
                        <p className="max-w-[240px] text-sm font-medium text-slate-900">{row.monomialName}</p>
                      </div>
                    </TD>
                    <TD className="text-right align-top font-medium tabular-nums text-slate-900">
                      {formatDecimalString(row.monomialCoefficient, 3)}
                    </TD>
                    <TD className="align-top">
                      {row.unifiedIndexCode || row.unifiedIndexName ? (
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {row.unifiedIndexCode ?? "Sin codigo"}
                          </p>
                          <p className="max-w-[280px] text-sm text-slate-700">{row.unifiedIndexName ?? "Sin nombre"}</p>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Sin indice</span>
                      )}
                    </TD>
                    <TD className="align-top text-sm text-slate-700">{row.iuFamily ?? "Sin familia"}</TD>
                    <TD className="text-right align-top tabular-nums">{formatDecimalString(row.amount, 2)}</TD>
                    <TD className="text-right align-top tabular-nums">{formatPercentage(row.participationPercentage)}</TD>
                    <TD className="text-right align-top font-medium tabular-nums text-slate-900">
                      {formatDecimalString(row.coefficientContribution, 3)}
                    </TD>
                    <TD className="align-top">
                      <div className="space-y-1">
                        <p className="text-sm text-slate-700">{formatSourceCount(row.sourceIds.length)}</p>
                        {row.sourceIds.length > 0 ? (
                          <p className="max-w-[180px] text-xs text-slate-500">
                            {row.sourceIds.map(truncateSourceId).join(", ")}
                          </p>
                        ) : null}
                      </div>
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
