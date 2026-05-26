"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RiskBudgetItem, RiskVariableRecord } from "@/types/risk";

export function RiskVariableModal({
  item,
  onClose,
  onDelete,
  onSave,
  variable,
}: {
  item: RiskBudgetItem | null;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  onSave: (variable: RiskVariableRecord) => Promise<void>;
  variable: RiskVariableRecord | null;
}) {
  if (!item) {
    return null;
  }

  return (
    <RiskVariableModalContent
      key={`${item.itemId}:${variable?.id ?? "new"}:${variable?.updatedAt ?? "fresh"}`}
      item={item}
      onClose={onClose}
      onDelete={onDelete}
      onSave={onSave}
      variable={variable}
    />
  );
}

function RiskVariableModalContent({
  item,
  onClose,
  onDelete,
  onSave,
  variable,
}: {
  item: RiskBudgetItem;
  onClose: () => void;
  onDelete?: () => Promise<void>;
  onSave: (variable: RiskVariableRecord) => Promise<void>;
  variable: RiskVariableRecord | null;
}) {
  const [minimum, setMinimum] = useState(String(variable?.minimum ?? item.baseQuantity));
  const [mostLikely, setMostLikely] = useState(String(variable?.mostLikely ?? item.baseQuantity));
  const [maximum, setMaximum] = useState(String(variable?.maximum ?? item.baseQuantity));
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
        id: variable?.id ?? `temp:${item.itemId}:quantity`,
        budgetId: variable?.budgetId ?? item.budgetId,
        budgetItemId: item.itemId,
        variableType: "QUANTITY",
        distributionType: "TRIANGULAR",
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
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold text-slate-950">Variable de riesgo</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-slate-500">
                {item.code || "Sin codigo"} · {item.description}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Cerrar"
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Field id={`risk-minimum-${item.itemId}`} label="Min" onChange={setMinimum} value={minimum} />
            <Field id={`risk-most-likely-${item.itemId}`} label="Probable" onChange={setMostLikely} value={mostLikely} />
            <Field id={`risk-maximum-${item.itemId}`} label="Max" onChange={setMaximum} value={maximum} />
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input checked={enabled} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" />
            Variable activa
          </label>

          {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

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
