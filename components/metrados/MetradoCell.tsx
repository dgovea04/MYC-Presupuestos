"use client";

import Link from "next/link";
import { Ruler } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";

export function MetradoCell({
  itemId,
  description,
  projectId,
  budgetId,
  quantity,
  advancedQuantity,
  hasAdvancedSheet,
  onSave,
  onOpenAdvanced,
  showAdvancedAction = true,
}: {
  itemId: string;
  description: string;
  projectId: string;
  budgetId: string;
  quantity: number;
  advancedQuantity?: number;
  hasAdvancedSheet?: boolean;
  showAdvancedAction?: boolean;
  onSave: (value: string) => Promise<void>;
  onOpenAdvanced?: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Input
        aria-label={`Metrado de ${description}`}
        className={cn(
          "h-8 w-28 text-right text-sm",
          hasAdvancedSheet && "cursor-not-allowed border-sky-300 bg-sky-50 text-sky-800",
        )}
        defaultValue={formatNumber(quantity, 2)}
        readOnly={hasAdvancedSheet}
        title={hasAdvancedSheet ? "Este valor proviene del metrado avanzado. Abre la hoja para editarlo." : "Metrado manual editable"}
        onBlur={(event) => {
          if (!hasAdvancedSheet) void onSave(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (!hasAdvancedSheet) void onSave(event.currentTarget.value);
          }
        }}
      />
      {showAdvancedAction ? (onOpenAdvanced ? (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={onOpenAdvanced} aria-label="Abrir metrados avanzados">
          <Ruler className={cn("h-3.5 w-3.5", hasAdvancedSheet ? "text-sky-600" : "text-[var(--app-text-muted)]")} />
        </Button>
      ) : (
        <Link href={`/metrados-avanzados?projectId=${projectId}&budgetId=${budgetId}&itemId=${itemId}`} className="text-[var(--app-primary)]" aria-label="Abrir metrados avanzados">
          <Ruler className={cn("h-3.5 w-3.5", hasAdvancedSheet ? "text-sky-600" : "text-[var(--app-text-muted)]")} />
        </Link>
      )) : null}
      {hasAdvancedSheet && advancedQuantity !== undefined ? <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-semibold text-sky-700" title="El valor proviene de la hoja avanzada" aria-label="Metrado avanzado">ADV</span> : null}
    </div>
  );
}
