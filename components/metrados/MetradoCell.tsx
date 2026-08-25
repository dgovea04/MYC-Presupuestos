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
  hasAdvancedSheet,
  onSave,
  onOpenAdvanced,
  onRequestManualOverride,
  showAdvancedAction = true,
}: {
  itemId: string;
  description: string;
  projectId: string;
  budgetId: string;
  quantity: number;
  hasAdvancedSheet?: boolean;
  showAdvancedAction?: boolean;
  onSave: (value: string) => Promise<void>;
  onOpenAdvanced?: () => void;
  onRequestManualOverride?: (value: string) => void;
}) {
  const displayedQuantity = formatNumber(quantity, 2);

  return (
    <div className="flex items-center justify-end gap-2">
      {hasAdvancedSheet ? (
        <button
          type="button"
          aria-label={`Metrado de ${description}`}
          className="ui-input h-8 w-28 cursor-pointer rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-right text-sm text-sky-800 outline-none transition hover:border-sky-500 focus-visible:ring-2 focus-visible:ring-sky-500/70"
          title="Haz clic para cambiar a metrado manual"
          onClick={() => onRequestManualOverride?.(displayedQuantity)}
        >
          {displayedQuantity}
        </button>
      ) : (
        <Input
          aria-label={`Metrado de ${description}`}
          className="h-8 w-28 text-right text-sm"
          defaultValue={displayedQuantity}
          title="Metrado manual editable"
          onBlur={(event) => void onSave(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void onSave(event.currentTarget.value);
            }
          }}
        />
      )}
      {showAdvancedAction ? (onOpenAdvanced ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={onOpenAdvanced}
          aria-label={hasAdvancedSheet ? "Abrir metrados avanzados" : "Crear metrado avanzado"}
          title={hasAdvancedSheet ? "Abrir metrados avanzados" : "Crear metrado avanzado"}
        >
          <Ruler className={cn("h-3.5 w-3.5", hasAdvancedSheet ? "text-sky-600" : "text-[var(--app-text-muted)]")} />
        </Button>
      ) : (
        <Link
          href={`/metrados-avanzados?projectId=${projectId}&budgetId=${budgetId}&itemId=${itemId}`}
          className="text-[var(--app-primary)]"
          aria-label={hasAdvancedSheet ? "Abrir metrados avanzados" : "Crear metrado avanzado"}
          title={hasAdvancedSheet ? "Abrir metrados avanzados" : "Crear metrado avanzado"}
        >
          <Ruler className={cn("h-3.5 w-3.5", hasAdvancedSheet ? "text-sky-600" : "text-[var(--app-text-muted)]")} />
        </Link>
      )) : null}
    </div>
  );
}
