"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ImportWarningSummaryProps = {
  warnings: string[];
};

export function ImportWarningsBadge({ count }: { count: number }) {
  const hasWarnings = count > 0;

  return (
    <Badge className={hasWarnings ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-[rgba(245,158,11,0.28)] dark:bg-[rgba(245,158,11,0.12)] dark:text-amber-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-[rgba(51,209,122,0.28)] dark:bg-[rgba(51,209,122,0.12)] dark:text-emerald-300"}>
      {count} advertencias
    </Badge>
  );
}

export function ImportWarningSummary({ warnings }: ImportWarningSummaryProps) {
  if (warnings.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-[rgba(51,209,122,0.28)] dark:bg-[rgba(51,209,122,0.12)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Sin advertencias de conversion
        </div>
        <p className="mt-2 text-sm text-emerald-700">La previsualizacion no reporta diferencias ni datos pendientes de revisar.</p>
      </div>
    );
  }

  return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-[rgba(245,158,11,0.28)] dark:bg-[rgba(245,158,11,0.12)]">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
        <AlertCircle className="h-4 w-4" />
        Advertencias de conversion
      </div>
      <ul className="mt-3 space-y-1 text-sm text-amber-700">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
