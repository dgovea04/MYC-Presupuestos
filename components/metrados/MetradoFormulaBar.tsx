"use client";

import { FunctionSquare, PencilLine } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { validateCustomMetradoExpression } from "@/lib/metrados/formula-engine";
import { cn } from "@/lib/utils";
import type { MetradoFormulaRecord, MetradoRowRecord } from "@/types/metrado";

type MetradoFormulaBarProps = {
  activeRow: MetradoRowRecord | null;
  formula: MetradoFormulaRecord | null;
  onExpressionChange?: (rowId: string, expression: string) => void;
};

export function MetradoFormulaBar({ activeRow, formula, onExpressionChange }: MetradoFormulaBarProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const rowLabel = activeRow
    ? [activeRow.sector, activeRow.eje, activeRow.nivel].filter(Boolean).join(" / ") ||
      `Fila ${activeRow.sortOrder}`
    : "Sin fila activa";

  function startEditing() {
    if (!activeRow || !formula) return;
    setEditValue(formula.expression);
    setValidationError(null);
    setIsEditing(true);
  }

  function handleChange(value: string) {
    setEditValue(value);
    const error = validateCustomMetradoExpression({
      id: formula?.id ?? "inline",
      templateId: formula?.templateId ?? "inline",
      key: formula?.key ?? "inline",
      label: formula?.label ?? "",
      expression: value,
      requiredInputs: formula?.requiredInputs ?? [],
      resultUnit: formula?.resultUnit ?? "und",
    });
    setValidationError(error);
  }

  async function handleSave() {
    if (!activeRow || !onExpressionChange || validationError) return;
    await onExpressionChange(activeRow.id, editValue);
    setIsEditing(false);
    setValidationError(null);
  }

  function handleCancel() {
    setIsEditing(false);
    setValidationError(null);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter" && !validationError) {
      event.preventDefault();
      void handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      handleCancel();
    }
  }

  const displayValue = formula ? `${formula.label}: ${formula.expression}` : "";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 lg:flex-row lg:items-center">
      <div className="flex min-w-0 items-center gap-2 text-sm text-[var(--app-text-muted)] lg:w-72">
        <FunctionSquare className="h-4 w-4 shrink-0 text-sky-600" />
        <span className="truncate font-medium text-[var(--app-text-strong)]">{rowLabel}</span>
        {activeRow ? <Badge>{activeRow.unit}</Badge> : null}
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-normal text-[var(--app-text-muted)]">
          fx
        </span>
        {isEditing ? (
          <div className="flex flex-1 items-center gap-2">
            <Input
              value={editValue}
              onChange={(event) => handleChange(event.currentTarget.value)}
              onKeyDown={handleKeyDown}
              className={cn(
                "h-9 rounded-lg font-mono text-xs",
                validationError
                  ? "border-rose-300 bg-rose-50 focus-visible:ring-rose-500/20"
                  : "border-sky-300 bg-sky-50",
              )}
              aria-label="Editar expresion de formula"
              autoFocus
            />
            <Button size="sm" variant="default" disabled={!!validationError} onClick={handleSave}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancelar
            </Button>
          </div>
        ) : (
          <>
            <Input
              readOnly
              value={displayValue}
              className="h-9 rounded-lg border-[var(--app-border)] bg-[var(--app-surface-muted)] font-mono text-xs text-[var(--app-text-strong)]"
              aria-label="Formula activa"
            />
            {activeRow && formula ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-9 shrink-0 px-2"
                onClick={startEditing}
                aria-label="Editar formula"
                title="Editar expresion"
              >
                <PencilLine className="h-4 w-4" />
              </Button>
            ) : null}
          </>
        )}
      </div>
      {validationError ? (
        <p className="shrink-0 text-xs text-rose-600 lg:max-w-[200px] lg:text-right">{validationError}</p>
      ) : null}
    </div>
  );
}
