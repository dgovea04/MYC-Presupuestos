"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ImportWarningSummaryProps = {
  warnings: string[];
};

export function ImportWarningsBadge({ count }: { count: number }) {
  const hasWarnings = count > 0;

  return (
    <Badge className={hasWarnings ? "theme-status-warning" : "theme-status-success"}>
      {count} advertencias
    </Badge>
  );
}

export function ImportWarningSummary({ warnings }: ImportWarningSummaryProps) {
  if (warnings.length === 0) {
    return (
      <div className="theme-status-success mt-4 rounded-xl border p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <CheckCircle2 className="h-4 w-4" />
          Sin advertencias de conversion
        </div>
        <p className="mt-2 text-sm">La previsualizacion no reporta diferencias ni datos pendientes de revisar.</p>
      </div>
    );
  }

  return (
      <div className="theme-status-warning mt-4 rounded-xl border p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <AlertCircle className="h-4 w-4" />
        Advertencias de conversion
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
