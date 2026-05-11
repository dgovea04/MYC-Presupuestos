"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { BudgetFooterStructure, BudgetFooterRowInput } from "@/types/budget-sections";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type DragState = { id: string } | null;

export function GeneralBudgetFooterTable({
  budgetId,
  initialStructure,
}: {
  budgetId: string;
  initialStructure: BudgetFooterStructure;
}) {
  const [structure, setStructure] = useState(initialStructure);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveClock, setSaveClock] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [dragState, setDragState] = useState<DragState>(null);
  const isHydrated = useRef(false);
  const saveRef = useRef<((isAutosave?: boolean) => Promise<boolean>) | null>(null);
  const lastSavedPayload = useRef(JSON.stringify(getSavePayload(initialStructure.rows)));

  const serializedDraft = useMemo(() => JSON.stringify(getSavePayload(structure.rows)), [structure.rows]);

  useEffect(() => {
    if (!isHydrated.current) {
      isHydrated.current = true;
      return;
    }

    if (serializedDraft !== lastSavedPayload.current) {
      setSaveState("dirty");
    }
  }, [serializedDraft]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timeout = window.setTimeout(() => {
      void saveRef.current?.(true);
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [saveState]);

  useEffect(() => {
    saveRef.current = saveStructure;
  });

  useEffect(() => {
    if (!lastSavedAt) return;
    const interval = window.setInterval(() => setSaveClock(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [lastSavedAt]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  async function saveStructure(isAutosave = false) {
    if (saving) return false;

    const payload = getSavePayload(structure.rows);
    const snapshot = JSON.stringify(payload);
    if (snapshot === lastSavedPayload.current && saveState !== "error") {
      if (saveState === "dirty") setSaveState("saved");
      return true;
    }

    setSaving(true);
    setSaveState("saving");
    setError("");

    try {
      const response = await fetch(`/api/budgets/${budgetId}/footer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo guardar el pie de presupuesto");
      }

      const nextStructure = (await response.json()) as BudgetFooterStructure;
      setStructure(nextStructure);
      lastSavedPayload.current = JSON.stringify(getSavePayload(nextStructure.rows));
      setLastSavedAt(Date.now());
      setSaveClock(Date.now());
      setSaveState("saved");
      if (!isAutosave) {
        setFeedback("Cambios guardados.");
      }
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo guardar el pie de presupuesto");
      setSaveState("error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function updateRow(rowId: string, changes: Partial<BudgetFooterRowInput>) {
    setStructure((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === rowId ? { ...row, ...changes } : row)),
    }));
  }

  function addRow() {
    setStructure((current) => ({
      ...current,
      rows: [
        ...current.rows,
        {
          id: crypto.randomUUID(),
          variable: `VAR${current.rows.length + 1}`,
          description: "Nueva fila",
          formula: "",
          manualValue: 0,
          iu: "",
          highlight: false,
          sortOrder: current.rows.length,
          value: 0,
          error: null,
          isCalculated: false,
        },
      ],
    }));
  }

  function deleteRow(rowId: string) {
    setStructure((current) => ({
      ...current,
      rows: current.rows
        .filter((row) => row.id !== rowId)
        .map((row, index) => ({
          ...row,
          sortOrder: index,
        })),
    }));
  }

  function moveRow(rowId: string, direction: "up" | "down") {
    setStructure((current) => {
      const rows = [...current.rows];
      const index = rows.findIndex((row) => row.id === rowId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index < 0 || targetIndex < 0 || targetIndex >= rows.length) {
        return current;
      }

      [rows[index], rows[targetIndex]] = [rows[targetIndex], rows[index]];
      return {
        ...current,
        rows: rows.map((row, currentIndex) => ({
          ...row,
          sortOrder: currentIndex,
        })),
      };
    });
  }

  function moveRowToTarget(sourceId: string, targetId: string) {
    setStructure((current) => {
      const rows = [...current.rows];
      const sourceIndex = rows.findIndex((row) => row.id === sourceId);
      const targetIndex = rows.findIndex((row) => row.id === targetId);

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return current;
      }

      const [sourceRow] = rows.splice(sourceIndex, 1);
      rows.splice(targetIndex, 0, sourceRow);

      return {
        ...current,
        rows: rows.map((row, currentIndex) => ({
          ...row,
          sortOrder: currentIndex,
        })),
      };
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle>Pie de presupuesto</CardTitle>
          <CardDescription>Constructor libre del resumen final, con formulas entre variables y guardado automatico.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveBadge state={saveState} lastSavedLabel={formatLastSavedLabel(lastSavedAt, saveClock)} />
          <ToolbarIconButton label="Agregar fila" onClick={addRow} disabled={saving}>
            <Plus className="h-4 w-4" />
          </ToolbarIconButton>
          <ToolbarIconButton label={saving ? "Guardando" : "Guardar ahora"} onClick={() => void saveStructure()} disabled={saving}>
            <Save className="h-4 w-4" />
          </ToolbarIconButton>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {!error && feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <Table className="table-fixed min-w-[1160px] w-full">
            <colgroup>
              <col className="w-[150px]" />
              <col className="w-[360px]" />
              <col className="w-[260px]" />
              <col className="w-[140px]" />
              <col className="w-[90px]" />
              <col className="w-[90px]" />
              <col className="w-[150px]" />
            </colgroup>
            <THead>
              <TR className="bg-slate-50 hover:bg-slate-50">
                <TH>Variable</TH>
                <TH>Descripcion</TH>
                <TH>Formula</TH>
                <TH className="text-right">Valor</TH>
                <TH className="text-center">IU</TH>
                <TH className="text-center">Resaltar</TH>
                <TH className="text-right">Acciones</TH>
              </TR>
            </THead>
            <TBody>
              {structure.rows.map((row) => (
                <TR
                  key={row.id}
                  draggable
                  onDragStart={() => setDragState({ id: row.id })}
                  onDragOver={(event) => {
                    if (dragState) event.preventDefault();
                  }}
                  onDrop={() => {
                    if (dragState) {
                      moveRowToTarget(dragState.id, row.id);
                    }
                  }}
                  onDragEnd={() => setDragState(null)}
                  className={cn(
                    row.highlight ? "bg-slate-50/80" : undefined,
                    dragState?.id === row.id ? "scale-[0.995] opacity-60 ring-2 ring-sky-300" : undefined,
                  )}
                >
                  <TD className="align-top">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 cursor-grab text-slate-400" />
                      <Input
                        value={row.variable}
                        onChange={(event) => updateRow(row.id, { variable: event.target.value })}
                        className={getInputDensityClass()}
                      />
                    </div>
                  </TD>
                  <TD className="align-top">
                    <Input
                      value={row.description}
                      onChange={(event) => updateRow(row.id, { description: event.target.value })}
                      className={cn(getInputDensityClass(), row.highlight ? "font-semibold" : "font-normal")}
                    />
                  </TD>
                  <TD className="align-top">
                    <Input value={row.formula ?? ""} onChange={(event) => updateRow(row.id, { formula: event.target.value })} className={cn(getInputDensityClass(), row.error ? "border-rose-300 text-rose-700" : undefined)} />
                    {row.error ? <p className="mt-1 text-xs text-rose-600">{row.error}</p> : <p className="mt-1 text-xs text-slate-400">Usa variables como `CD + PGG + UTI`</p>}
                  </TD>
                  <TD className="align-top">
                    <Input
                      type="number"
                      step="0.0001"
                      value={row.isCalculated ? row.value : row.manualValue}
                      disabled={row.isCalculated}
                      onChange={(event) => updateRow(row.id, { manualValue: Number(event.target.value) })}
                      className={cn(getInputDensityClass(), "text-right tabular-nums")}
                    />
                  </TD>
                  <TD className="align-top">
                    <Input value={row.iu ?? ""} onChange={(event) => updateRow(row.id, { iu: event.target.value })} className={cn(getInputDensityClass(), "text-center")} />
                  </TD>
                  <TD className="align-top text-center">
                    <input
                      type="checkbox"
                      checked={row.highlight}
                      onChange={(event) => updateRow(row.id, { highlight: event.target.checked })}
                      className="mt-2 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                  </TD>
                  <TD className="align-top">
                    <div className="flex justify-end gap-1">
                      <ToolbarIconButton label="Subir" onClick={() => moveRow(row.id, "up")} disabled={saving}>
                        <ArrowUp className="h-4 w-4" />
                      </ToolbarIconButton>
                      <ToolbarIconButton label="Bajar" onClick={() => moveRow(row.id, "down")} disabled={saving}>
                        <ArrowDown className="h-4 w-4" />
                      </ToolbarIconButton>
                      <ToolbarIconButton label="Eliminar fila" onClick={() => deleteRow(row.id)} disabled={saving}>
                        <Trash2 className="h-4 w-4" />
                      </ToolbarIconButton>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Importe en letras</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{structure.amountInWords}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ToolbarIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="h-8 w-8 rounded-lg px-0 text-slate-600 hover:bg-slate-100"
    >
      {children}
    </Button>
  );
}

function SaveBadge({ state, lastSavedLabel }: { state: SaveState; lastSavedLabel: string | null }) {
  const styles: Record<SaveState, string> = {
    idle: "bg-slate-100 text-slate-600",
    dirty: "bg-amber-100 text-amber-700",
    saving: "bg-sky-100 text-sky-700",
    saved: "bg-emerald-100 text-emerald-700",
    error: "bg-rose-100 text-rose-700",
  };

  const labels: Record<SaveState, string> = {
    idle: "Sin cambios",
    dirty: "Cambios pendientes",
    saving: "Guardando...",
    saved: "Guardado automatico",
    error: "Error al guardar",
  };

  return (
    <span className={cn("inline-flex flex-col rounded-full px-3 py-2 text-xs font-medium", styles[state])}>
      <span>{labels[state]}</span>
      {lastSavedLabel ? <span className="mt-0.5 text-[11px] font-normal opacity-80">{lastSavedLabel}</span> : null}
    </span>
  );
}

function getInputDensityClass() {
  return "h-8 rounded-lg px-2 text-xs";
}

function getSavePayload(rows: BudgetFooterStructure["rows"]) {
  return {
    rows: rows.map((row, index) => ({
      id: row.id,
      variable: row.variable,
      description: row.description,
      formula: row.formula,
      manualValue: row.isCalculated ? row.value : row.manualValue,
      iu: row.iu,
      highlight: row.highlight,
      sortOrder: index,
    })),
  };
}

function formatLastSavedLabel(lastSavedAt: number | null, currentTime: number) {
  if (!lastSavedAt) return null;
  const seconds = Math.max(0, Math.floor((currentTime - lastSavedAt) / 1000));
  if (seconds < 60) return `Ultimo guardado hace ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Ultimo guardado hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  const hours = Math.floor(minutes / 60);
  return `Ultimo guardado hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
}
