"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  WorkScheduleCurveSkeleton,
  WorkScheduleResourceCalendarSkeleton,
  WorkScheduleValuationSkeleton,
} from "@/components/loading/work-schedule-section-skeletons";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type {
  WorkScheduleCurvePointRecord,
  WorkSchedulePeriodRecord,
  WorkScheduleResourceCalendarRow,
  WorkScheduleValuationCalendarRow,
} from "@/types/work-schedule";
import type { ResourceCalendarMode, PeriodRangeSelection } from "./types";

export function DerivedViewLoadingCard({ label }: { label: string }) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("valorizado")) {
    return <WorkScheduleValuationSkeleton />;
  }

  if (normalizedLabel.includes("insumos")) {
    return <WorkScheduleResourceCalendarSkeleton />;
  }

  if (normalizedLabel.includes("curva")) {
    return <WorkScheduleCurveSkeleton />;
  }

  return <WorkScheduleValuationSkeleton />;
}

export function DerivedViewUnavailableCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="rounded-3xl border border-[var(--app-border)] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]">
      <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-semibold text-[var(--app-text-strong)]">{title}</p>
        <p className="max-w-md text-sm text-[var(--app-text-muted)]">{description}</p>
      </CardContent>
    </Card>
  );
}

export function DerivedTableCard({
  title,
  description,
  activeFilterLabel,
  children,
}: {
  title: string;
  description: React.ReactNode;
  activeFilterLabel: string | null;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-3xl border border-[var(--app-border)] shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)]">
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="text-lg font-semibold text-[var(--app-text-strong)]">{title}</h3>
          <div className="text-sm text-[var(--app-text-muted)]">{description}</div>
          {activeFilterLabel ? (
            <span className="mt-2 inline-block rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
              {activeFilterLabel}
            </span>
          ) : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function ValuationCalendarView({
  rows,
  periods,
  currency,
  currencyDecimals,
  activeFilterLabel,
  periodRange,
  availableRange,
  isSegmented,
  onPeriodRangeChange,
  onApplyPeriodRange,
}: {
  rows: WorkScheduleValuationCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  activeFilterLabel: string | null;
  periodRange: PeriodRangeSelection;
  availableRange?: { fromPeriodKey: string; toPeriodKey: string };
  isSegmented: boolean;
  onPeriodRangeChange: (range: PeriodRangeSelection) => void;
  onApplyPeriodRange: () => void;
}) {
  if (rows.length === 0) {
    return <DerivedTableCard title="Calendario valorizado" description="No hay datos para mostrar con el filtro actual." activeFilterLabel={activeFilterLabel}><div /></DerivedTableCard>;
  }

  const totalRow = periods.reduce((sum, p) => sum + rows.reduce((rs, r) => rs + (r.periodAmounts[p.key] ?? 0), 0), 0);

  return (
    <DerivedTableCard title="Calendario valorizado" description={`${rows.length} partidas · ${periods.length} periodos · Total: ${formatCurrency(totalRow, currency, currencyDecimals)}`} activeFilterLabel={activeFilterLabel}>
      {isSegmented && availableRange ? (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-3">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">Desde</span>
            <input
              type="month"
              value={periodRange.fromPeriodKey}
              onChange={(e) => onPeriodRangeChange({ ...periodRange, fromPeriodKey: e.target.value })}
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--app-text-muted)]">Hasta</span>
            <input
              type="month"
              value={periodRange.toPeriodKey}
              onChange={(e) => onPeriodRangeChange({ ...periodRange, toPeriodKey: e.target.value })}
              className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={onApplyPeriodRange}
            className="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700"
          >
            Cargar rango
          </button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH className="sticky left-0 z-10 bg-[var(--app-surface)]">Partida</TH>
              <TH>Descripcion</TH>
              <TH className="text-right">Parcial</TH>
              {periods.map((p) => <TH key={p.key} className="text-right">{p.key}</TH>)}
              <TH className="text-right">Total</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.budgetItemId}>
                <TD className="sticky left-0 z-10 bg-[var(--app-surface)] font-mono text-xs">{row.itemCode}</TD>
                <TD className="text-xs">{row.description}</TD>
                <TD className="text-right text-xs tabular-nums">{formatCurrency(row.partial, currency, currencyDecimals)}</TD>
                {periods.map((p) => (
                  <TD key={p.key} className="text-right text-xs tabular-nums">
                    {formatCurrency(row.periodAmounts[p.key] ?? 0, currency, currencyDecimals)}
                  </TD>
                ))}
                <TD className="text-right text-xs tabular-nums font-semibold">{formatCurrency(row.rowTotal, currency, currencyDecimals)}</TD>
              </TR>
            ))}
            <TR className="border-t-2 border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] font-semibold">
              <TD className="sticky left-0 z-10 bg-[var(--app-surface-muted)]" />
              <TD>Total</TD>
              <TD className="text-right text-xs tabular-nums">{formatCurrency(rows.reduce((s, r) => s + r.partial, 0), currency, currencyDecimals)}</TD>
              {periods.map((p) => (
                <TD key={p.key} className="text-right text-xs tabular-nums">
                  {formatCurrency(rows.reduce((s, r) => s + (r.periodAmounts[p.key] ?? 0), 0), currency, currencyDecimals)}
                </TD>
              ))}
              <TD className="text-right text-xs tabular-nums">{formatCurrency(totalRow, currency, currencyDecimals)}</TD>
            </TR>
          </TBody>
        </Table>
      </div>
    </DerivedTableCard>
  );
}

export function ResourceCalendarView({
  rows,
  periods,
  currency,
  currencyDecimals,
  mode,
  onModeChange,
  activeFilterLabel,
}: {
  rows: WorkScheduleResourceCalendarRow[];
  periods: WorkSchedulePeriodRecord[];
  currency: string;
  currencyDecimals: number;
  mode: ResourceCalendarMode;
  onModeChange: (mode: ResourceCalendarMode) => void;
  activeFilterLabel: string | null;
}) {
  if (rows.length === 0) {
    return <DerivedTableCard title="Calendario de insumos" description="No hay datos para mostrar con el filtro actual." activeFilterLabel={activeFilterLabel}><div /></DerivedTableCard>;
  }

  const isAmounts = mode === "amounts";

  return (
    <DerivedTableCard
      title="Calendario de insumos"
      description={
        <span>
          {rows.length} recursos · {periods.length} periodos ·{" "}
          <button
            type="button"
            onClick={() => onModeChange(isAmounts ? "quantities" : "amounts")}
            className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--app-text)] hover:bg-[var(--app-surface-hover)]"
          >
            {isAmounts ? "Ver cantidades" : "Ver importes"}
          </button>
        </span>
      }
      activeFilterLabel={activeFilterLabel}
    >
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH className="sticky left-0 z-10 bg-[var(--app-surface)]">Codigo</TH>
              <TH>Descripcion</TH>
              <TH>Unidad</TH>
              {!isAmounts ? <TH className="text-right">Cantidad total</TH> : null}
              <TH className="text-right">{isAmounts ? "Importe total" : "Precio unit."}</TH>
              {periods.map((p) => (
                <TH key={p.key} className="text-right">
                  {isAmounts ? `${p.key} (S/)` : `${p.key} (qty)`}
                </TH>
              ))}
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.resourceId}>
                <TD className="sticky left-0 z-10 bg-[var(--app-surface)] font-mono text-xs">{row.code}</TD>
                <TD className="max-w-[200px] truncate text-xs">{row.description}</TD>
                <TD className="text-xs">{row.unit}</TD>
                {!isAmounts ? <TD className="text-right text-xs tabular-nums">{formatNumber(row.quantity, 4)}</TD> : null}
                <TD className="text-right text-xs tabular-nums">{formatCurrency(isAmounts ? row.partial : row.unitPrice, currency, currencyDecimals)}</TD>
                {periods.map((p) => (
                  <TD key={p.key} className="text-right text-xs tabular-nums">
                    {isAmounts
                      ? formatCurrency(row.periodAmounts[p.key] ?? 0, currency, currencyDecimals)
                      : formatNumber(row.periodQuantities[p.key] ?? 0, 4)}
                  </TD>
                ))}
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </DerivedTableCard>
  );
}

export function CurveSView({
  points,
  currency,
  currencyDecimals,
  activeFilterLabel,
}: {
  points: WorkScheduleCurvePointRecord[];
  currency: string;
  currencyDecimals: number;
  activeFilterLabel: string | null;
}) {
  if (points.length === 0) {
    return <DerivedTableCard title="Curva S" description="No hay datos para mostrar con el filtro actual." activeFilterLabel={activeFilterLabel}><div /></DerivedTableCard>;
  }

  const maxAmount = Math.max(...points.map((p) => p.monthlyAmount));
  const total = points.reduce((s, p) => s + p.monthlyAmount, 0);

  return (
    <DerivedTableCard
      title="Curva S"
      description={`${points.length} periodos · Total acumulado: ${formatCurrency(total, currency, currencyDecimals)}`}
      activeFilterLabel={activeFilterLabel}
    >
      <div className="space-y-4">
        <div className="h-48 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
          <div className="flex h-full items-end gap-0.5">
            {points.map((p) => (
              <div
                key={p.key}
                className="group relative flex-1"
                title={`${p.key}: ${formatCurrency(p.monthlyAmount, currency, currencyDecimals)} (${formatNumber(p.accumulatedPercentage, 1)}%)`}
              >
                <div
                  className="absolute bottom-0 w-full rounded-t-sm bg-sky-500 transition-colors group-hover:bg-sky-600"
                  style={{ height: maxAmount > 0 ? `${(p.monthlyAmount / maxAmount) * 100}%` : "0%" }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH>Periodo</TH>
                <TH className="text-right">Mensual</TH>
                <TH className="text-right">Acumulado</TH>
                <TH className="text-right">% Acumulado</TH>
              </TR>
            </THead>
            <TBody>
              {points.map((p) => (
                <TR key={p.key}>
                  <TD className="text-xs">{p.key}</TD>
                  <TD className="text-right text-xs tabular-nums">{formatCurrency(p.monthlyAmount, currency, currencyDecimals)}</TD>
                  <TD className="text-right text-xs tabular-nums">{formatCurrency(p.accumulatedAmount, currency, currencyDecimals)}</TD>
                  <TD className="text-right text-xs tabular-nums">{formatNumber(p.accumulatedPercentage, 1)}%</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>
    </DerivedTableCard>
  );
}
