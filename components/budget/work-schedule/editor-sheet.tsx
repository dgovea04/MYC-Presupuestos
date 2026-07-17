"use client";

import { useCallback, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CalendarDays, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import type { DateFormatOption } from "@/types/settings";
import { Field } from "./ui-elements";
import type { EditableLine } from "./types";
import { updateEditableLineDates, updateEditableLineCrew, updateDistribution, createNextDistribution } from "./utils/edit-helpers";

export function WorkScheduleDateInput({
  label,
  value,
  dateFormat,
  onChange,
  onKeyDown,
  compact = false,
}: {
  label: string;
  value: string;
  dateFormat: DateFormatOption;
  onChange: (value: string) => void;
  onKeyDown?: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const openPicker = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;

    if ("showPicker" in input && typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  }, []);

  return (
    <div className="relative">        <Input
          ref={inputRef}
          type="date"
          value={value}
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          onChange={(event) => onChange(event.target.value)}
          className="sr-only"
        />
      <Button
        type="button"
        variant="outline"
        onClick={openPicker}
        className={cn(
          "w-full justify-start gap-2 text-left font-normal",
          compact ? "h-9 rounded-lg px-2.5 text-xs" : "h-10 rounded-xl px-3 text-sm",
          !value && "text-[var(--app-text-muted)]",
        )}
      >
        <CalendarDays className={cn("shrink-0", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <span className="truncate">{value ? formatDate(value, dateFormat) : "Seleccionar fecha"}</span>
      </Button>
    </div>
  );
}

export function WorkScheduleEditorSheet({
  line,
  open,
  saveState,
  error,
  dateFormat,
  onClose,
  onJumpToSchedule,
  canNavigateToPreviousLine,
  canNavigateToNextLine,
  onNavigateToPreviousLine,
  onNavigateToNextLine,
  onSave,
  onChange,
  onPredecessorChange,
}: {
  line: EditableLine | null;
  open: boolean;
  saveState: "idle" | "saving" | "error";
  error: string;
  dateFormat: DateFormatOption;
  onClose: () => void;
  onJumpToSchedule: () => void;
  canNavigateToPreviousLine: boolean;
  canNavigateToNextLine: boolean;
  onNavigateToPreviousLine: () => void;
  onNavigateToNextLine: () => void;
  onSave: () => void;
  onChange: (line: EditableLine | null) => void;
  onPredecessorChange: (line: EditableLine, predecessor: string) => void;
}) {
  useSaveShortcut({ enabled: open, onSave });

  const totalPercentage = line?.monthlyDistributions.reduce((sum, d) => sum + Number(d.percentage), 0) ?? 0;
  const percentageDifference = 100 - totalPercentage;

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content asChild>
          <div
            className="fixed inset-y-0 right-0 z-50 h-full w-full max-w-2xl overflow-y-auto border-l border-[var(--app-border)] bg-[var(--app-surface-muted)] p-5 shadow-2xl outline-none"
            data-testid="work-schedule-editor-panel"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <Dialog.Title asChild>
                  <h3 className="text-2xl font-semibold text-[var(--app-text-strong)]">Programar partida</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <div className="mt-1 space-y-2 text-sm text-[var(--app-text-muted)]">
                    <p>{line?.description ?? "Selecciona una partida para programarla."}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
                      <span className="font-semibold text-[var(--app-text)]">Atajos</span>
                      <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5">Alt + Left: anterior</span>
                      <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5">Alt + Right: siguiente</span>
                    </div>
                  </div>
                </Dialog.Description>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onNavigateToPreviousLine} disabled={!canNavigateToPreviousLine}>Anterior</Button>
                <Button variant="outline" onClick={onNavigateToNextLine} disabled={!canNavigateToNextLine}>Siguiente</Button>
                <Button variant="outline" onClick={onJumpToSchedule}>Ir al cronograma</Button>
                <Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4" />Cerrar</Button>
              </div>
            </div>

            {line ? (
              <div className="space-y-5">
                <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
                  <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                    <Field label="Inicio">
                      <WorkScheduleDateInput label="Inicio" value={line.startDate} dateFormat={dateFormat} onChange={(v) => onChange(updateEditableLineDates(line, { startDate: v }))} />
                    </Field>
                    <Field label="Fin">
                      <WorkScheduleDateInput label="Fin" value={line.endDate} dateFormat={dateFormat} onChange={(v) => onChange(updateEditableLineDates(line, { endDate: v }))} />
                    </Field>
                    <Field label="Duracion"><Input value={String(line.durationDays)} readOnly /></Field>
                    <Field label="Predecesora"><Input value={line.predecessor} onChange={(ev) => onPredecessorChange(line, ev.target.value)} /></Field>
                    <Field label="Cuadrilla"><Input value={line.crew} onChange={(ev) => onChange(updateEditableLineCrew(line, ev.target.value))} /></Field>
                  </CardContent>
                </Card>

                <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
                  <CardContent className="space-y-4 p-5">
                    <p className="text-sm font-semibold text-[var(--app-text-strong)]">Control de avance</p>
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Inicio real">
                        <WorkScheduleDateInput
                          label="Inicio real"
                          value={line.actualStartDate ?? ""}
                          dateFormat={dateFormat}
                          onChange={(v) => onChange({ ...line, actualStartDate: v || null })}
                        />
                      </Field>
                      <Field label="Fin real">
                        <WorkScheduleDateInput
                          label="Fin real"
                          value={line.actualEndDate ?? ""}
                          dateFormat={dateFormat}
                          onChange={(v) => onChange({ ...line, actualEndDate: v || null })}
                        />
                      </Field>
                      <Field label="% Avance">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={line.percentComplete ?? ""}
                          onChange={(ev) => {
                            const value = ev.target.value === "" ? null : Math.min(100, Math.max(0, Number(ev.target.value)));
                            onChange({ ...line, percentComplete: value });
                          }}
                        />
                      </Field>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-[var(--app-border)] bg-[var(--app-surface)]">
                  <CardContent className="space-y-4 p-5">

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--app-text-strong)]">Distribucion mensual</p>
                        <p className="mt-1 text-sm text-[var(--app-text-muted)]">La suma debe cerrar exactamente al 100%.</p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => onChange({ ...line, monthlyDistributions: [...line.monthlyDistributions, createNextDistribution(line.monthlyDistributions)] })}>Agregar periodo</Button>
                    </div>

                    <div className="space-y-3">
                      {line.monthlyDistributions.map((dist, i) => (
                        <div key={`${dist.year}-${dist.month}-${i}`} className="grid gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-4 md:grid-cols-[1fr_1fr_1fr_auto]" data-testid="work-schedule-distribution-row">
                          <Field label="Ano"><Input value={String(dist.year)} onChange={(ev) => updateDistribution(line, i, "year", Number(ev.target.value) || dist.year, onChange)} /></Field>
                          <Field label="Mes"><Input value={String(dist.month)} onChange={(ev) => updateDistribution(line, i, "month", Number(ev.target.value) || dist.month, onChange)} /></Field>
                          <Field label="%"><Input value={String(dist.percentage)} onChange={(ev) => updateDistribution(line, i, "percentage", Number(ev.target.value) || 0, onChange)} /></Field>
                          <div className="flex items-end">
                            <Button variant="ghost" size="sm" onClick={() => onChange({ ...line, monthlyDistributions: line.monthlyDistributions.filter((_, ri) => ri !== i) })}>Quitar</Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-dashed border-[var(--app-border-strong)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm text-[var(--app-text-muted)]">
                      <span className="font-medium text-[var(--app-text-strong)]">Total:</span> {formatNumber(totalPercentage, 4)}%{" "}
                      <span className={cn("ml-2 font-medium", percentageDifference === 0 ? "text-emerald-600" : "text-amber-600")}>Diferencia: {formatNumber(percentageDifference, 4)}%</span>
                    </div>
                  </CardContent>
                </Card>

                {error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>Cancelar</Button>
                  <Button onClick={onSave} disabled={saveState === "saving"}><Save className="mr-2 h-4 w-4" />{saveState === "saving" ? "Guardando..." : "Guardar programacion"}</Button>
                </div>
              </div>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
