"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ImportWarningSummaryProps = {
  warnings: string[];
};

export function ImportWarningsBadge({ count }: { count: number }) {
  const hasWarnings = count > 0;

  return (
    <Badge className={hasWarnings ? "border border-amber-200 bg-amber-100 text-amber-800" : "border border-emerald-200 bg-emerald-100 text-emerald-800"}>
      {count} advertencias
    </Badge>
  );
}

export function ImportWarningSummary({ warnings }: ImportWarningSummaryProps) {
  if (warnings.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4" />
          Sin advertencias de conversion
        </div>
        <p className="mt-2 text-sm text-emerald-800">La previsualizacion no reporta diferencias ni datos pendientes de revisar.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-900">
        <AlertCircle className="h-4 w-4" />
        Advertencias de conversion
      </div>
      <ul className="mt-3 space-y-1 text-sm text-amber-900">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
