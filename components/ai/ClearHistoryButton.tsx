"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ClearHistoryButton({
  confirmClear,
  confirmLabel,
  buttonClassName,
  cancelButtonClassName,
  confirmButtonClassName,
  confirmWrapperClassName,
  iconClassName,
  labelClassName,
  onCancel,
  onClear,
  onRequestClear,
}: {
  confirmClear: boolean;
  confirmLabel: string;
  buttonClassName?: string;
  cancelButtonClassName?: string;
  confirmButtonClassName?: string;
  confirmWrapperClassName?: string;
  iconClassName?: string;
  labelClassName?: string;
  onCancel: () => void;
  onClear: () => void;
  onRequestClear: () => void;
}) {
  if (confirmClear) {
    return (
      <div className={cn("flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2", confirmWrapperClassName)}>
        <span className={cn("text-xs font-medium text-rose-800", labelClassName)}>{confirmLabel}</span>
        <Button
          size="sm"
          variant="destructive"
          className={confirmButtonClassName}
          onClick={onClear}
        >
          Limpiar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className={cancelButtonClassName}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <Button
      aria-label="Limpiar historial"
      className={cn("h-8 w-8 shrink-0", buttonClassName)}
      size="sm"
      variant="ghost"
      onClick={onRequestClear}
    >
      <Trash2 className={cn("h-4 w-4", iconClassName)} />
    </Button>
  );
}
