"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { RiskBudgetItem, RiskDistributionType, RiskVariableRecord, RiskVariableType } from "@/types/risk";

export function RiskVariableModal({
  baseValueLabel,
  baseValueOverride,
  item,
  onClose,
  onDelete,
  onSave,
  variableType,
  variable,
}: {
  baseValueLabel?: string;
  baseValueOverride?: number | null;
  item: RiskBudgetItem | null;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  onSave: (variable: RiskVariableRecord) => Promise<void>;
  variableType: RiskVariableType | null;
  variable: RiskVariableRecord | null;
}) {
  if (!item || !variableType) {
    return null;
  }

  return (
    <RiskVariableModalContent
      key={`${item.itemId}:${variableType}:${variable?.id ?? "new"}:${variable?.updatedAt ?? "fresh"}`}
      baseValueLabel={baseValueLabel}
      baseValueOverride={baseValueOverride}
      item={item}
      onClose={onClose}
      onDelete={onDelete}
      onSave={onSave}
      variableType={variableType}
      variable={variable}
    />
  );
}

function RiskVariableModalContent({
  baseValueLabel,
  baseValueOverride,
  item,
  onClose,
  onDelete,
  onSave,
  variableType,
  variable,
}: {
  baseValueLabel?: string;
  baseValueOverride?: number | null;
  item: RiskBudgetItem;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  onSave: (variable: RiskVariableRecord) => Promise<void>;
  variableType: RiskVariableType;
  variable: RiskVariableRecord | null;
}) {
  const variableLabel = getVariableLabel(variableType);
  const defaultValue = baseValueOverride ?? getDefaultValue(item, variableType);
  const helperLabel = baseValueLabel ?? getBaseValueLabel(variableType);
  const [minimum, setMinimum] = useState(String(variable?.minimum ?? defaultValue));
  const [mostLikely, setMostLikely] = useState(String(variable?.mostLikely ?? defaultValue));
  const [maximum, setMaximum] = useState(String(variable?.maximum ?? defaultValue));
  const [distributionType, setDistributionType] = useState<RiskDistributionType>(variable?.distributionType ?? "TRIANGULAR");
  const [enabled, setEnabled] = useState(variable?.enabled ?? true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const min = Number(minimum);
    const likely = Number(mostLikely);
    const max = Number(maximum);

    if (!Number.isFinite(min) || !Number.isFinite(likely) || !Number.isFinite(max) || min < 0 || likely < 0 || max < 0) {
      setError("Ingresa valores numericos no negativos.");
      return;
    }

    if (min > likely || likely > max) {
      setError("El rango debe cumplir Min <= Probable <= Max.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({
        id: variable?.id ?? `temp:${item.itemId}:${variableType.toLowerCase()}`,
        budgetId: variable?.budgetId ?? item.budgetId,
        budgetItemId: item.itemId,
        variableType,
        distributionType,
        minimum: min,
        mostLikely: likely,
        maximum: max,
        enabled,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la variable.");
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrent = async () => {
    if (!onDelete) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onDelete();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la variable.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content className="theme-surface-card fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="theme-strong-text text-lg font-semibold">Variable de riesgo</Dialog.Title>
              <Dialog.Description className="theme-muted-text mt-1 text-sm">
                {item.code || "Sin codigo"} | {item.description} | {variableLabel}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Cerrar"
                className="theme-muted-text rounded-xl p-2 hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)]"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <p className="theme-muted-text mt-4 text-xs">
            Base actual: {defaultValue} ({helperLabel})
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field id={`risk-minimum-${item.itemId}`} label="Min" onChange={setMinimum} value={minimum} />
            <Field id={`risk-most-likely-${item.itemId}`} label="Probable" onChange={setMostLikely} value={mostLikely} />
            <Field id={`risk-maximum-${item.itemId}`} label="Max" onChange={setMaximum} value={maximum} />
          </div>

          <div className="mt-4 space-y-2">
            <Label htmlFor={`risk-distribution-${item.itemId}`}>Distribucion</Label>
            <Select
              aria-label="Distribucion"
              id={`risk-distribution-${item.itemId}`}
              onChange={(event) => setDistributionType(event.target.value as RiskDistributionType)}
              value={distributionType}
            >
              <option value="TRIANGULAR">Triangular</option>
              <option value="PERT">PERT</option>
              <option value="NORMAL">Normal</option>
              <option value="UNIFORM">Uniforme</option>
            </Select>
            <p className="theme-muted-text text-xs">
              {buildDistributionHelperText(distributionType)}
            </p>
          </div>

          <label className="theme-strong-text mt-4 flex items-center gap-2 text-sm">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" className="[--control-accent:var(--app-primary)]" />
            Variable activa
          </label>

          {error ? <p className="theme-status-error mt-4 rounded-xl border px-3 py-2 text-sm">{error}</p> : null}

          <div className="mt-5 flex justify-between gap-3">
            <Button disabled={saving || !onDelete} onClick={deleteCurrent} type="button" variant="outline">
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
            <div className="flex gap-2">
              <Button disabled={saving} onClick={onClose} type="button" variant="ghost">
                Cancelar
              </Button>
              <Button disabled={saving} onClick={save} type="button">
                Guardar
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ id, label, onChange, value }: { id: string; label: string; onChange: (value: string) => void; value: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} inputMode="decimal" onChange={(event) => onChange(event.target.value)} value={value} />
    </div>
  );
}

function getVariableLabel(variableType: RiskVariableType) {
  if (variableType === "UNIT_PRICE") {
    return "Precio unitario";
  }

  if (variableType === "DURATION") {
    return "Duracion";
  }

  return "Cantidad";
}

function getBaseValueLabel(variableType: RiskVariableType) {
  if (variableType === "UNIT_PRICE") {
    return "precio unitario";
  }

  if (variableType === "DURATION") {
    return "duracion";
  }

  return "cantidad";
}

function getDefaultValue(item: RiskBudgetItem, variableType: RiskVariableType) {
  if (variableType === "UNIT_PRICE") {
    return item.unitPrice;
  }

  return item.baseQuantity;
}

function buildDistributionHelperText(distributionType: RiskDistributionType) {
  if (distributionType === "PERT") {
    return "PERT suaviza los extremos y concentra mas escenarios cerca del valor probable.";
  }

  if (distributionType === "NORMAL") {
    return "Normal usa el valor probable como media y aproxima la dispersion a partir del rango min-max.";
  }

  if (distributionType === "UNIFORM") {
    return "Uniforme reparte la misma probabilidad entre el minimo y el maximo.";
  }

  return "Triangular usa min, probable y max con una forma lineal simple.";
}
