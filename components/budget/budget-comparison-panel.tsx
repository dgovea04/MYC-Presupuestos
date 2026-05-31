"use client";

import { useMemo, useState } from "react";
import { Download, GitCompareArrows } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoCard } from "@/components/ui/info-cards";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { compareBudgets, type BudgetComparisonStatus } from "@/lib/budgets/budget-comparison";
import {
  buildBudgetComparisonCsv,
  buildBudgetComparisonCsvFilename,
} from "@/lib/budgets/budget-comparison-export";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";
import type { BudgetRecord } from "@/types/budget";

const comparisonFilters: Array<{ status: BudgetComparisonStatus | "ALL"; label: string }> = [
  { status: "ALL", label: "Todo" },
  { status: "ADDED", label: "Nuevas" },
  { status: "REMOVED", label: "Retiradas" },
  { status: "CHANGED", label: "Cambiadas" },
  { status: "UNCHANGED", label: "Sin cambios" },
];

export function BudgetComparisonPanel({
  budgets,
  currencyDecimals,
  isExcelMode,
}: {
  budgets: BudgetRecord[];
  currencyDecimals: number;
  isExcelMode: boolean;
}) {
  const [baseBudgetId, setBaseBudgetId] = useState("");
  const [targetBudgetId, setTargetBudgetId] = useState("");
  const [activeFilter, setActiveFilter] = useState<BudgetComparisonStatus | "ALL">("ALL");

  const baseBudget = budgets.find((budget) => budget.id === baseBudgetId) ?? budgets[0] ?? null;
  const targetBudget =
    budgets.find((budget) => budget.id === targetBudgetId) ?? budgets.find((budget) => budget.id !== baseBudget?.id) ?? null;
  const comparison = useMemo(
    () => (baseBudget && targetBudget && baseBudget.id !== targetBudget.id ? compareBudgets(baseBudget, targetBudget) : null),
    [baseBudget, targetBudget],
  );
  const filteredItems = useMemo(
    () =>
      comparison
        ? comparison.items
            .filter((item) => activeFilter === "ALL" || item.status === activeFilter)
            .sort((left, right) => Math.abs(right.deltas.partial) - Math.abs(left.deltas.partial))
        : [],
    [activeFilter, comparison],
  );

  if (!comparison) {
    return null;
  }

  function handleExportCsv() {
    if (!comparison) return;

    const blob = new Blob([buildBudgetComparisonCsv(comparison)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildBudgetComparisonCsvFilename(comparison);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={cn("border border-slate-200 bg-white px-4 py-4", isExcelMode ? "rounded-md" : "rounded-2xl")}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-900">Comparador tecnico</p>
          </div>
          <p className="text-xs leading-5 text-slate-500">
            Compara dos Sub Presupuestos para revisar partidas nuevas, retiradas y variaciones de metrado o precio.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(160px,1fr)_minmax(160px,1fr)_auto]">
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Base
            <select
              value={baseBudget?.id ?? ""}
              onChange={(event) => setBaseBudgetId(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              {budgets.map((budget) => (
                <option key={budget.id} value={budget.id}>
                  {budget.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-slate-600">
            Revisado
            <select
              value={targetBudget?.id ?? ""}
              onChange={(event) => setTargetBudgetId(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              {budgets.map((budget) => (
                <option key={budget.id} value={budget.id} disabled={budget.id === baseBudget?.id}>
                  {budget.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="outline" className="mt-5 gap-2" onClick={handleExportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <InfoCard label="Variacion directa" value={formatCurrency(comparison.totals.deltaDirectCost, comparison.currency, currencyDecimals)} tone="sky" />
        <InfoCard label="Partidas nuevas" value={String(comparison.summary.added)} tone="slate" />
        <InfoCard label="Partidas retiradas" value={String(comparison.summary.removed)} tone="amber" />
        <InfoCard label="Partidas cambiadas" value={String(comparison.summary.changed)} tone="slate" />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {comparisonFilters.map((filter) => (
          <button
            key={filter.status}
            type="button"
            onClick={() => setActiveFilter(filter.status)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition",
              activeFilter === filter.status
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-sky-300 hover:bg-sky-50",
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className={cn("mt-4", getTableFrameClassName(isExcelMode))}>
        <Table>
          <THead>
            <TR className="bg-slate-50 hover:bg-slate-50">
              <TH>Estado</TH>
              <TH>Codigo</TH>
              <TH>Descripcion</TH>
              <TH className="text-center">Unidad</TH>
              <TH className="text-right">Base</TH>
              <TH className="text-right">Revisado</TH>
              <TH className="text-right">Delta</TH>
              <TH className="text-right">%</TH>
            </TR>
          </THead>
          <TBody>
            {filteredItems.length ? (
              filteredItems.map((item) => (
                <TR key={item.key}>
                  <TD>
                    <Badge className="bg-slate-100 text-slate-700">{formatComparisonStatus(item.status)}</Badge>
                  </TD>
                  <TD className="font-medium text-slate-900">{item.code || "s/c"}</TD>
                  <TD>{item.description}</TD>
                  <TD className="text-center">{item.unit}</TD>
                  <TD className="text-right tabular-nums">
                    {item.base ? formatCurrency(item.base.partial, comparison.currency, currencyDecimals) : "-"}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {item.target ? formatCurrency(item.target.partial, comparison.currency, currencyDecimals) : "-"}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {formatCurrency(item.deltas.partial, comparison.currency, currencyDecimals)}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {item.deltas.partialPercent === null ? "-" : `${formatNumber(item.deltas.partialPercent, 2)}%`}
                  </TD>
                </TR>
              ))
            ) : (
              <TR>
                <TD colSpan={8} className="text-center text-sm text-slate-500">
                  No hay partidas para el filtro seleccionado.
                </TD>
              </TR>
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function formatComparisonStatus(status: BudgetComparisonStatus) {
  if (status === "ADDED") return "Nueva";
  if (status === "REMOVED") return "Retirada";
  if (status === "CHANGED") return "Cambiada";
  return "Sin cambios";
}
