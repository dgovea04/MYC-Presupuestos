"use client";

import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MetradoValidationIssue } from "@/types/metrado";

type MetradoValidationPanelProps = {
  issues: MetradoValidationIssue[];
};

export function MetradoValidationPanel({ issues }: MetradoValidationPanelProps) {
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CircleAlert className="h-4 w-4 text-amber-600" />
          Validacion
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge className={cn(errors > 0 && "bg-rose-100 text-rose-700")}>{errors} errores</Badge>
          <Badge className={cn(warnings > 0 && "bg-amber-100 text-amber-700")}>{warnings} avisos</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Sin alertas
          </div>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-auto pr-1">
            {issues.map((issue) => (
              <li
                key={issue.id}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm",
                  issue.severity === "error"
                    ? "border-rose-100 bg-rose-50 text-rose-800"
                    : "border-amber-100 bg-amber-50 text-amber-800",
                )}
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0">
                    <p>{issue.message}</p>
                    {issue.rowId || issue.field ? (
                      <p className="mt-1 truncate text-xs opacity-75">
                        {[issue.rowId, issue.field].filter(Boolean).join(" / ")}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
