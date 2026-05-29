"use client";

import { FunctionSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { MetradoFormulaRecord, MetradoRowRecord } from "@/types/metrado";

type MetradoFormulaBarProps = {
  activeRow: MetradoRowRecord | null;
  formula: MetradoFormulaRecord | null;
};

export function MetradoFormulaBar({ activeRow, formula }: MetradoFormulaBarProps) {
  const rowLabel = activeRow
    ? [activeRow.sector, activeRow.eje, activeRow.nivel].filter(Boolean).join(" / ") ||
      `Fila ${activeRow.sortOrder}`
    : "Sin fila activa";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 lg:flex-row lg:items-center">
      <div className="flex min-w-0 items-center gap-2 text-sm text-slate-600 lg:w-72">
        <FunctionSquare className="h-4 w-4 shrink-0 text-sky-600" />
        <span className="truncate font-medium text-slate-900">{rowLabel}</span>
        {activeRow ? <Badge>{activeRow.unit}</Badge> : null}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-normal text-slate-500">
          fx
        </span>
        <Input
          readOnly
          value={formula ? `${formula.label}: ${formula.expression}` : ""}
          className="h-9 rounded-lg bg-slate-50 font-mono text-xs"
          aria-label="Formula activa"
        />
      </div>
    </div>
  );
}
