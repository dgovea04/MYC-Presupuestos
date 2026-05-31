"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowDown, ArrowUp, GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { ExportPanel } from "@/components/exports/export-panel";
import { Button } from "@/components/ui/button";
import { InfoCard } from "@/components/ui/info-cards";
import { Input } from "@/components/ui/input";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { SaveStateBadge } from "@/components/ui/save-state-badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";
import { getExportDefinition } from "@/lib/exports/definitions";
import { cn, formatCurrency } from "@/lib/utils";
import type { BudgetFooterStructure, BudgetFooterRowInput } from "@/types/budget-sections";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type DragState = { id: string } | null;

export function GeneralBudgetFooterTable({
  budgetId,
  currency,
  currencyDecimals,
  generalExpensesRate,
  utilityRate,
  igvRate,
  initialStructure,
}: {
  budgetId: string;
  currency: string;
  currencyDecimals: number;
  generalExpensesRate: number;
  utilityRate: number;
  igvRate: number;
  initialStructure: BudgetFooterStructure;
}) {
  const { isExcelMode } = useAppViewMode();
  const { excelRowHeight, excelShowFieldBorders } = useFormattingSettings();
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
  const calculatedRowsCount = useMemo(() => structure.rows.filter((row) => row.isCalculated).length, [structure.rows]);
  const highlightedRowsCount = useMemo(() => structure.rows.filter((row) => row.highlight).length, [structure.rows]);
  const effectiveGeneralExpensesRate = useMemo(
    () => getGeneralExpensesRateFromRows(structure.rows) ?? generalExpensesRate,
    [generalExpensesRate, structure.rows],
  );
  const excelCssVariables = useMemo<CSSProperties>(
    () => getExcelViewCssVariables(excelShowFieldBorders, excelRowHeight),
    [excelRowHeight, excelShowFieldBorders],
  );

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
    <div className="space-y-4">
      <OperationalPanel
        title="Pie de presupuesto"
        description="Constructor libre del resumen final, con fórmulas entre variables y guardado automático."
        metrics={<SaveStateBadge state={saveState} lastSavedLabel={formatLastSavedLabel(lastSavedAt, saveClock)} />}
        controls={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">Usa variables como `CD + PGG + UTI` para armar totales y líneas finales del presupuesto.</p>
            <div className="flex items-center gap-2">
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              {!error && feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}
              <ExportPanel
                buttonLabel="Exportar"
                defaultPreset="pie_presupuesto_detallado"
                definition={getExportDefinition("budget_footer")}
                targetId={budgetId}
              />
              <ToolbarIconButton label="Agregar fila" onClick={addRow} disabled={saving}>
                <Plus className="h-4 w-4" />
              </ToolbarIconButton>
              <ToolbarIconButton label={saving ? "Guardando" : "Guardar ahora"} onClick={() => void saveStructure()} disabled={saving}>
                <Save className="h-4 w-4" />
              </ToolbarIconButton>
            </div>
          </div>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Filas" value={String(structure.rows.length)} tone="slate" />
        <InfoCard label="Fórmulas activas" value={String(calculatedRowsCount)} tone="sky" />
        <InfoCard label="Filas resaltadas" value={String(highlightedRowsCount)} tone="amber" />
        <InfoCard label="Importe en letras" value={structure.amountInWords ? "Disponible" : "Pendiente"} tone="slate" />
      </div>

      <div className="space-y-4">
        <div
          data-view-mode={isExcelMode ? "excel" : "modern"}
          data-density-mode={isExcelMode ? "compact" : "comfortable"}
          style={excelCssVariables}
          className={getTableFrameClassName(
            isExcelMode,
            cn("overflow-auto", !isExcelMode ? "shadow-[0_18px_36px_-30px_rgba(15,23,42,0.18)]" : undefined),
          )}
        >
          <Table className={cn("table-fixed min-w-[1160px] w-full", isExcelMode && "[&_td]:px-2 [&_th]:px-2")}>
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
                <TR className={cn("bg-slate-50 hover:bg-slate-50", isExcelMode && "bg-slate-100/90 hover:bg-slate-100/90")}>
                <TH>Variable</TH>
                <TH>Descripción</TH>
                <TH>Fórmula</TH>
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
                        className={getInputDensityClass(isExcelMode)}
                      />
                    </div>
                  </TD>
                  <TD className="align-top">
                    <Input
                      value={row.description}
                      onChange={(event) => updateRow(row.id, { description: event.target.value })}
                      className={cn(getInputDensityClass(isExcelMode), row.highlight ? "font-semibold" : "font-normal")}
                    />
                  </TD>
                  <TD className="align-top">
                    {isSystemFormulaRow(row.variable) ? (
                      <div
                        className={cn(
                          "flex items-center px-2 text-xs text-slate-400",
                          isExcelMode ? "h-[var(--excel-control-height)]" : "h-8",
                        )}
                      >
                        {getSystemFormulaText(row.variable, {
                          generalExpensesRate: effectiveGeneralExpensesRate,
                          utilityRate,
                          igvRate,
                        })}
                      </div>
                    ) : (
                      <>
                        <Input
                          value={row.formula ?? ""}
                          onChange={(event) => updateRow(row.id, { formula: event.target.value })}
                          className={cn(getInputDensityClass(isExcelMode), row.error ? "border-rose-300 text-rose-700" : undefined)}
                        />
                        {row.error ? (
                          <p className="mt-1 text-xs text-rose-600">{row.error}</p>
                        ) : !isExcelMode ? (
                          <p className="mt-1 text-xs text-slate-400">Usa variables como `CD + PGG + UTI`</p>
                        ) : null}
                      </>
                    )}
                  </TD>
                  <TD className="align-top">
                    <div
                      className={cn(
                        "flex items-center justify-end px-2 text-xs font-medium tabular-nums text-slate-800",
                        isExcelMode ? "h-[var(--excel-control-height)] rounded-none" : "h-8 rounded-lg",
                        row.highlight ? "font-semibold text-slate-950" : undefined,
                      )}
                    >
                      {formatCurrency(row.value, currency, currencyDecimals)}
                    </div>
                  </TD>
                  <TD className="align-top">
                    <Input
                      value={row.iu ?? ""}
                      onChange={(event) => updateRow(row.id, { iu: event.target.value })}
                      className={cn(getInputDensityClass(isExcelMode), "text-center")}
                    />
                  </TD>
                  <TD className="align-top text-center">
                    <input
                      type="checkbox"
                      checked={row.highlight}
                      onChange={(event) => updateRow(row.id, { highlight: event.target.checked })}
                      className={cn(
                        "h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400",
                        isExcelMode ? "mt-[calc((var(--excel-control-height)-1rem)/2)]" : "mt-2",
                      )}
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

        <div className={cn("border border-slate-200/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.92)_100%)] px-4 py-3", isExcelMode ? "rounded-md border-slate-300 shadow-none" : "rounded-2xl shadow-[0_14px_30px_-28px_rgba(15,23,42,0.16)]")}>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Importe en letras</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{structure.amountInWords}</p>
        </div>
      </div>
    </div>
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
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0">
        {children}
      </span>
    </Button>
  );
}

function getInputDensityClass(isExcelMode = false) {
  if (isExcelMode) return "h-8 rounded-sm border-slate-300 px-2 text-xs shadow-none";
  return "h-8 rounded-lg px-2 text-xs";
}

function getGeneralExpensesRateFromRows(rows: BudgetFooterStructure["rows"]) {
  const directCost = rows.find((row) => row.variable.trim().toUpperCase() === "CD")?.value ?? 0;
  const generalExpenses = rows.find((row) => row.variable.trim().toUpperCase() === "PGG")?.value ?? 0;

  if (directCost <= 0) {
    return null;
  }

  return generalExpenses / directCost;
}

function isSystemFormulaRow(variable: string) {
  return ["CD", "PGG", "UTI", "IGV"].includes(variable.trim().toUpperCase());
}

function getSystemFormulaText(
  variable: string,
  rates: { generalExpensesRate: number; utilityRate: number; igvRate: number },
) {
  const normalizedVariable = variable.trim().toUpperCase();

  if (normalizedVariable === "CD") {
    return "Desde costo directo";
  }

  if (normalizedVariable === "PGG") {
    return `Gastos generales ${formatRatePercentage(rates.generalExpensesRate)}`;
  }

  if (normalizedVariable === "UTI") {
    return `CD*${formatRateDecimal(rates.utilityRate)}`;
  }

  if (normalizedVariable === "IGV") {
    return `ST*${formatRateDecimal(rates.igvRate)}`;
  }

  return "";
}

function formatRatePercentage(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function formatRateDecimal(value: number) {
  return value.toFixed(2);
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
  if (seconds < 60) return `Último guardado hace ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Último guardado hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  const hours = Math.floor(minutes / 60);
  return `Último guardado hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
}
