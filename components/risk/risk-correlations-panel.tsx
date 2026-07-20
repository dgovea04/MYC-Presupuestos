"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { RiskBudgetItem, RiskCorrelationRecord, RiskVariableRecord } from "@/types/risk";

type CorrelationMatrixVariable = {
  id: string;
  label: string;
};

type CorrelationMatrixCell = {
  coefficient: number;
  key: string;
  sourceVariableId: string;
  targetVariableId: string;
};

export function RiskCorrelationsPanel({
  correlations,
  disabled = false,
  items,
  onSaveCorrelations,
  variables,
}: {
  correlations: RiskCorrelationRecord[];
  disabled?: boolean;
  items: RiskBudgetItem[];
  onSaveCorrelations: (
    correlations: Array<{ sourceVariableId: string; targetVariableId: string; coefficient: number }>,
  ) => Promise<void>;
  variables: RiskVariableRecord[];
}) {
  const matrix = useMemo(() => buildCorrelationMatrixView(items, variables, correlations), [correlations, items, variables]);
  const baseDrafts = useMemo(
    () =>
      Object.fromEntries(
        matrix.cells.flatMap((row) =>
          row.flatMap((cell) => (cell ? [[cell.key, String(cell.coefficient)] as const] : [])),
        ),
      ),
    [matrix.cells],
  );
  const [draftOverrides, setDraftOverrides] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const pendingChangeCount = useMemo(
    () =>
      Object.entries(draftOverrides).filter(
        ([key, value]) => value !== (baseDrafts[key] ?? ""),
      ).length,
    [baseDrafts, draftOverrides],
  );

  if (matrix.variables.length < 2) {
    return (
      <Card className="theme-surface-card">
        <CardContent className="p-5">
          <h2 className="theme-strong-text text-sm font-semibold">Correlaciones</h2>
          <p className="theme-muted-text mt-2 text-sm">
            Activa al menos dos variables para empezar a relacionar escenarios entre partidas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="theme-surface-card">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="theme-strong-text text-sm font-semibold">Correlaciones</h2>
          <p className="theme-muted-text mt-1 text-xs">
            La matriz usa la diagonal como referencia. Edita solo el triangulo superior con valores entre -1 y 1.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <HeatmapLegend label="Negativa" toneClassName="bg-rose-100 text-rose-700" />
            <HeatmapLegend label="Neutra" toneClassName="bg-slate-100 text-slate-600" />
            <HeatmapLegend label="Positiva" toneClassName="bg-emerald-100 text-emerald-700" />
            <HeatmapLegend
              label={pendingChangeCount > 0 ? `${pendingChangeCount} cambio${pendingChangeCount === 1 ? "" : "s"} pendiente${pendingChangeCount === 1 ? "" : "s"}` : "Sin cambios"}
              toneClassName={pendingChangeCount > 0 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled || status === "saving" || pendingChangeCount === 0}
              onClick={() => setDraftOverrides({})}
              variant="ghost"
            >
              Descartar cambios
            </Button>
            <Button disabled={disabled || status === "saving" || pendingChangeCount === 0} onClick={() => void saveAll()} variant="outline">
              Guardar cambios
            </Button>
          </div>
        </div>

        <div className="overflow-auto">
          <Table className="min-w-[720px] text-[0.60rem]!">
            <THead className="theme-muted-panel sticky top-0 z-10">
              <TR className="theme-muted-panel hover:theme-muted-panel">
                <TH className="min-w-[200px] border-r border-[var(--app-border)] px-2 py-1.5 text-[0.60rem]! uppercase tracking-wide">
                  Variable
                </TH>
                {matrix.variables.map((variable) => (
                  <TH
                    key={variable.id}
                    className="min-w-[110px] border-r border-[var(--app-border)] px-2 py-1.5 text-[0.60rem]! uppercase tracking-wide"
                  >
                    {variable.label}
                  </TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {matrix.variables.map((rowVariable, rowIndex) => (
                <TR key={rowVariable.id} className="h-10">
                  <TD className="border-r border-[var(--app-border-soft)] px-2 py-1 text-[0.60rem]! font-medium">
                    {rowVariable.label}
                  </TD>
                  {matrix.variables.map((columnVariable, columnIndex) => (
                    <TD key={`${rowVariable.id}:${columnVariable.id}`} className="border-r border-[var(--app-border-soft)] px-2 py-1">
                        <CorrelationCell
                          cell={matrix.cells[rowIndex]?.[columnIndex] ?? null}
                          columnIndex={columnIndex}
                        draftValue={
                          matrix.cells[rowIndex]?.[columnIndex]
                            ? draftOverrides[matrix.cells[rowIndex]?.[columnIndex]?.key ?? ""] ??
                              baseDrafts[matrix.cells[rowIndex]?.[columnIndex]?.key ?? ""] ??
                              ""
                            : ""
                        }
                        disabled={disabled}
                        onDraftChange={(key, value) => {
                          setDraftOverrides((current) => {
                            const next = { ...current, [key]: value };
                            if (value === (baseDrafts[key] ?? "")) {
                              delete next[key];
                            }
                            return next;
                          });
                        }}
                        rowIndex={rowIndex}
                      />
                    </TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </div>

        {error ? <p className="theme-status-error rounded-xl border px-3 py-2 text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );

  async function saveAll() {
    const nextCorrelations: Array<{ sourceVariableId: string; targetVariableId: string; coefficient: number }> = [];

    for (const row of matrix.cells) {
      for (const cell of row) {
        if (!cell) {
          continue;
        }

        const value = draftOverrides[cell.key] ?? baseDrafts[cell.key] ?? String(cell.coefficient);
        const coefficient = Number(value);
        if (!Number.isFinite(coefficient) || coefficient < -1 || coefficient > 1) {
          setStatus("error");
          setError(`El coeficiente ${cell.key} debe estar entre -1 y 1.`);
          return;
        }

        nextCorrelations.push({
          sourceVariableId: cell.sourceVariableId,
          targetVariableId: cell.targetVariableId,
          coefficient,
        });
      }
    }

    setStatus("saving");
    setError("");

    try {
      await onSaveCorrelations(nextCorrelations);
      setDraftOverrides({});
      setStatus("idle");
    } catch (saveError) {
      setStatus("error");
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar las correlaciones.");
    }
  }
}

function CorrelationCell({
  cell,
  columnIndex,
  draftValue,
  disabled,
  onDraftChange,
  rowIndex,
}: {
  cell: CorrelationMatrixCell | null;
  columnIndex: number;
  draftValue: string;
  disabled: boolean;
  onDraftChange: (key: string, value: string) => void;
  rowIndex: number;
}) {
  if (rowIndex === columnIndex) {
    return <span className="theme-muted-text block text-center font-medium">1.00</span>;
  }

  if (rowIndex > columnIndex || !cell) {
    return <span className="theme-subtle-text block text-center text-[0.60rem]!">-</span>;
  }

  return (
    <EditableCorrelationCell
      cell={cell}
      disabled={disabled}
      draftValue={draftValue}
      onDraftChange={onDraftChange}
    />
  );
}

function EditableCorrelationCell({
  cell,
  disabled,
  draftValue,
  onDraftChange,
}: {
  cell: CorrelationMatrixCell;
  disabled: boolean;
  draftValue: string;
  onDraftChange: (key: string, value: string) => void;
}) {
  const coefficient = Number(draftValue);
  const heatmapClassName = getCorrelationHeatmapClassName(Number.isFinite(coefficient) ? coefficient : 0);

  return (
    <div className={cn("rounded-lg border p-0 transition-colors", heatmapClassName)}>
      <Input
        aria-label={`Coeficiente ${cell.key}`}
        className="h-7 border-white/50 bg-white/80 text-[11px]"
        disabled={disabled}
        inputMode="decimal"
        onChange={(event) => onDraftChange(cell.key, event.target.value)}
        value={draftValue}
      />
    </div>
  );
}

export function buildCorrelationMatrixView(
  items: RiskBudgetItem[],
  variables: RiskVariableRecord[],
  correlations: RiskCorrelationRecord[],
): {
  cells: Array<Array<CorrelationMatrixCell | null>>;
  variables: CorrelationMatrixVariable[];
} {
  const enabledVariables = variables.filter((variable) => variable.enabled);
  const itemById = new Map(items.map((item) => [item.itemId, item]));
  const correlationByPair = new Map(
    correlations.map((correlation) => [buildPairKey(correlation.sourceVariableId, correlation.targetVariableId), correlation]),
  );
  const matrixVariables = enabledVariables.map((variable) => {
    const item = itemById.get(variable.budgetItemId);
    return {
      id: variable.id,
      label: buildVariableLabel(item?.code, item?.description, variable.variableType),
    } satisfies CorrelationMatrixVariable;
  });

  const cells = enabledVariables.map((sourceVariable, rowIndex) =>
    enabledVariables.map((targetVariable, columnIndex) => {
      if (rowIndex >= columnIndex) {
        return null;
      }

      const pairKey = buildPairKey(sourceVariable.id, targetVariable.id);
      return {
        coefficient: correlationByPair.get(pairKey)?.coefficient ?? 0,
        key: pairKey,
        sourceVariableId: sourceVariable.id,
        targetVariableId: targetVariable.id,
      } satisfies CorrelationMatrixCell;
    }),
  );

  return { cells, variables: matrixVariables };
}

function buildVariableLabel(
  code: string | undefined,
  description: string | undefined,
  variableType: RiskVariableRecord["variableType"],
) {
  const variableLabel = variableType === "UNIT_PRICE" ? "PU" : variableType === "DURATION" ? "Dur." : "Cant.";
  return `${variableLabel} ${[code, description].filter(Boolean).join(" ").trim() || "Variable"}`;
}

function buildPairKey(sourceVariableId: string, targetVariableId: string) {
  return sourceVariableId < targetVariableId
    ? `${sourceVariableId}:${targetVariableId}`
    : `${targetVariableId}:${sourceVariableId}`;
}

export function getCorrelationHeatmapClassName(coefficient: number) {
  const intensity = Math.min(1, Math.abs(coefficient));

  if (coefficient >= 0.6) return "border-emerald-300 bg-emerald-200/90";
  if (coefficient >= 0.3) return "border-emerald-200 bg-emerald-100/90";
  if (coefficient > 0.05) return "border-emerald-100 bg-emerald-50/90";
  if (coefficient <= -0.6) return "border-rose-300 bg-rose-200/90";
  if (coefficient <= -0.3) return "border-rose-200 bg-rose-100/90";
  if (coefficient < -0.05) return "border-rose-100 bg-rose-50/90";
  if (intensity <= 0.05) return "border-slate-200 bg-slate-50/90";

  return "border-slate-200 bg-slate-50/90";
}

function HeatmapLegend({ label, toneClassName }: { label: string; toneClassName: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 font-medium", toneClassName)}>
      {label}
    </span>
  );
}
