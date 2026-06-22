"use client";

import { ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight, Sigma } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { cn, formatNumber } from "@/lib/utils";
import type { MetradoCalculationResult, MetradoPartidaLinkRecord, MetradoUnit } from "@/types/metrado";

const units = ["m", "m2", "m3", "kg", "und", "glb", "p2", "ml", "pza", "bol", "gal", "ton", "mes", "día", "viaje", "pto", "jgo", "pln", "mll"] as const satisfies MetradoUnit[];

type MetradoSummaryPanelProps = {
  calculation: MetradoCalculationResult;
  linkedPartida: MetradoPartidaLinkRecord | null;
  unit: MetradoUnit;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

export function MetradoSummaryPanel({
  calculation,
  linkedPartida,
  unit,
  collapsed,
  onToggleCollapsed,
}: MetradoSummaryPanelProps) {
  const { isExcelMode } = useAppViewMode();
  const visibleUnitTotals = units.filter((entryUnit) => calculation.totalsByUnit[entryUnit] !== 0);

  return (
    <Card
      className={cn(
        "h-fit overflow-hidden border-[var(--app-border)] bg-[var(--app-surface)] shadow-[0_20px_42px_-34px_rgba(15,23,42,0.24)] xl:sticky xl:top-4",
        isExcelMode && "rounded-md border-[var(--app-border-strong)] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]",
      )}
    >
      <CardHeader
        className={cn(
          "flex flex-row items-center border-b border-[var(--app-border)] bg-[var(--app-surface)]",
          collapsed ? "justify-center px-2 py-3" : "justify-between",
          isExcelMode && !collapsed && "px-3 py-2",
        )}
      >
        {!collapsed ? (
          <CardTitle className="flex items-center gap-2 text-base">
            <Sigma className="h-4 w-4 text-sky-600" />
            Totales
          </CardTitle>
        ) : null}
        <div className={cn("flex items-center gap-2", collapsed && "flex-col")}>
          {!collapsed ? <Badge>{unit}</Badge> : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={collapsed ? "Expandir totales" : "Colapsar totales"}
            title={collapsed ? "Expandir totales" : "Colapsar totales"}
            className="h-8 w-8 px-0"
            onClick={onToggleCollapsed}
          >
            {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {!collapsed ? (
      <CardContent className={cn("space-y-4", isExcelMode && "space-y-3 px-3 py-3")}>
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-[var(--app-text-muted)]">Total principal</p>
          <p className="mt-1 text-3xl font-semibold text-[var(--app-text-strong)]">
            {formatNumber(calculation.primaryTotal, 3)} <span className="text-base text-[var(--app-text-muted)]">{unit}</span>
          </p>
        </div>
        {visibleUnitTotals.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {visibleUnitTotals.map((entryUnit) => (
              <div key={entryUnit} className="rounded-xl border border-[var(--app-border-soft)] bg-[var(--app-surface-muted)] px-3 py-2">
                <p className="text-xs text-[var(--app-text-muted)]">{entryUnit}</p>
                <p className="font-semibold text-[var(--app-text-strong)]">{formatNumber(calculation.totalsByUnit[entryUnit], 3)}</p>
              </div>
            ))}
          </div>
        ) : null}
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-3">
          {linkedPartida ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-text-strong)]">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {linkedPartida.budgetItemCode}
              </div>
              <p className="line-clamp-2 text-sm text-[var(--app-text-muted)]">{linkedPartida.budgetItemDescription}</p>
              <div className="flex items-center justify-between gap-3 text-xs text-[var(--app-text-muted)]">
                <span>Unidad {linkedPartida.budgetItemUnit}</span>
                <span>
                  Enviado{" "}
                  {linkedPartida.lastSentQuantity === null
                    ? "-"
                    : formatNumber(linkedPartida.lastSentQuantity, 3)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[var(--app-text-muted)]">
              <ArrowUpRight className="h-4 w-4" />
              Sin partida vinculada
            </div>
          )}
        </div>
      </CardContent>
      ) : null}
    </Card>
  );
}
