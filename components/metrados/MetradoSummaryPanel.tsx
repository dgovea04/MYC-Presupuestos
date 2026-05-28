"use client";

import { ArrowUpRight, CheckCircle2, Sigma } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { MetradoCalculationResult, MetradoPartidaLinkRecord, MetradoUnit } from "@/types/metrado";

const units = ["m", "m2", "m3", "kg", "und", "glb"] as const satisfies MetradoUnit[];

type MetradoSummaryPanelProps = {
  calculation: MetradoCalculationResult;
  linkedPartida: MetradoPartidaLinkRecord | null;
  unit: MetradoUnit;
};

export function MetradoSummaryPanel({
  calculation,
  linkedPartida,
  unit,
}: MetradoSummaryPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sigma className="h-4 w-4 text-sky-600" />
          Totales
        </CardTitle>
        <Badge>{unit}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-normal text-slate-500">Total principal</p>
          <p className="mt-1 text-3xl font-semibold text-slate-950">
            {formatNumber(calculation.primaryTotal, 3)} <span className="text-base text-slate-500">{unit}</span>
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {units.map((entryUnit) => (
            <div key={entryUnit} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">{entryUnit}</p>
              <p className="font-semibold text-slate-900">{formatNumber(calculation.totalsByUnit[entryUnit], 3)}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-slate-200 px-3 py-3">
          {linkedPartida ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {linkedPartida.budgetItemCode}
              </div>
              <p className="line-clamp-2 text-sm text-slate-600">{linkedPartida.budgetItemDescription}</p>
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
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
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <ArrowUpRight className="h-4 w-4" />
              Sin partida vinculada
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
