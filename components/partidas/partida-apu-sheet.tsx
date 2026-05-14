"use client";

import { useState } from "react";
import { GripVertical } from "lucide-react";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { calculateApuRows, calculateApuTotalUnitCost, isCrewDrivenApuRow, isLaborApuRow, isPercentageBasedApuRow } from "@/lib/calculations/apu";
import { cn, formatCurrency } from "@/lib/utils";
import type { CatalogPartidaRecord, PartidaApuRowRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

type EditableCatalogPartida = CatalogPartidaRecord & {
  isEditing?: boolean;
  isNew?: boolean;
  isDirty?: boolean;
};

type PartidaApuSheetProps = {
  partida: EditableCatalogPartida | null;
  open: boolean;
  onClose: () => void;
  onChange: (partida: EditableCatalogPartida) => void;
  resourcesCatalog: ResourceRecord[];
};

export function PartidaApuSheet({ partida, open, onClose, onChange, resourcesCatalog }: PartidaApuSheetProps) {
  const { currencyDecimals } = useFormattingSettings();
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);

  if (!open || !partida) return null;
  const currentPartida = partida;
  const isReadonly = currentPartida.source === "Catalogo de partidas precargado" && !currentPartida.isNew;
  const calculatedRows = calculateApuRows(currentPartida.apuRows, currentPartida.performance);
  const calculatedUnitPrice = calculateApuTotalUnitCost(currentPartida.apuRows, currentPartida.performance);
  const performanceLabel = `${currentPartida.unit}/Día`;

  function applyCalculatedPartida(nextRows: PartidaApuRowRecord[], performance = currentPartida.performance, overrides?: Partial<EditableCatalogPartida>) {
    const normalizedRows = normalizeRows(calculateApuRows(nextRows, performance));

    onChange({
      ...currentPartida,
      ...overrides,
      performance,
      apuRows: normalizedRows,
      unitPrice: calculateApuTotalUnitCost(normalizedRows, performance),
      isDirty: true,
      isEditing: true,
    });
  }

  function patchRow(index: number, changes: Partial<PartidaApuRowRecord>) {
    if (isReadonly) return;

    const nextRows = currentPartida.apuRows.map((row, currentIndex) =>
      currentIndex === index
        ? {
            ...row,
            ...changes,
            resourceId: changes.description !== undefined && changes.description !== row.description ? undefined : changes.resourceId ?? row.resourceId,
          }
        : row,
    );

    applyCalculatedPartida(nextRows);
  }

  function addResource(resourceId: string) {
    if (isReadonly) return;
    const selected = resourcesCatalog.find((resource) => resource.id === resourceId);
    if (!selected) return;

    const nextRows = [
      ...currentPartida.apuRows,
      {
        id: crypto.randomUUID(),
        catalogPartidaId: currentPartida.id,
        resourceId: selected.id,
        description: selected.description,
        unit: selected.unit,
        crew: undefined,
        quantity: 1,
        unitPrice: selected.unitPrice,
        subtotal: selected.unitPrice,
        resourceType: selected.category,
        groupLabel: undefined,
        sortOrder: currentPartida.apuRows.length,
      },
    ];

    applyCalculatedPartida(nextRows);
  }

  function addManualRow() {
    if (isReadonly) return;
    const nextRows = [
      ...currentPartida.apuRows,
      {
        id: crypto.randomUUID(),
        catalogPartidaId: currentPartida.id,
        description: "",
        unit: "",
        quantity: 0,
        unitPrice: 0,
        subtotal: 0,
        sortOrder: currentPartida.apuRows.length,
      },
    ];

    applyCalculatedPartida(nextRows);
  }

  function removeRow(index: number) {
    if (isReadonly) return;
    const nextRows = currentPartida.apuRows.filter((_, currentIndex) => currentIndex !== index);
    applyCalculatedPartida(nextRows);
  }

  function moveRowToTarget(targetId: string) {
    if (isReadonly || !draggedRowId || draggedRowId === targetId) return;
    applyCalculatedPartida(moveEntityToTarget(currentPartida.apuRows, draggedRowId, targetId));
    setDraggedRowId(null);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm">
      <div className="ml-auto h-full w-full max-w-6xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Tabla de precios unitarios</p>
            <h3 className="text-2xl font-semibold text-slate-900">{currentPartida.description}</h3>
            <p className="mt-1 text-sm text-slate-500">Unidad: {currentPartida.unit}</p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>

        <div className="mb-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Rendimiento ({performanceLabel})</p>
            <Input
              type="number"
              step="0.0001"
              value={currentPartida.performance}
              readOnly={isReadonly}
              onChange={(event) =>
                applyCalculatedPartida(currentPartida.apuRows, Number(event.target.value), {
                  performanceRate: buildPerformanceRate(Number(event.target.value), currentPartida.performanceUnit ?? currentPartida.unit),
                })
              }
              className={isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
            />
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">Unidad de rendimiento</p>
            <Input
              value={currentPartida.performanceUnit ?? currentPartida.unit}
              readOnly={isReadonly}
              onChange={(event) =>
                applyCalculatedPartida(currentPartida.apuRows, currentPartida.performance, {
                  performanceUnit: event.target.value,
                  performanceRate: buildPerformanceRate(currentPartida.performance, event.target.value),
                })
              }
              className={isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
            />
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="text-sm text-slate-500">P. unitario</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(calculatedUnitPrice, currentPartida.currency, currencyDecimals)}</p>
          </div>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-[1fr_180px]">
          <Select defaultValue="" onChange={(event) => addResource(event.target.value)} disabled={isReadonly}>
            <option value="" disabled>
              Agregar insumo desde el catálogo
            </option>
            {resourcesCatalog.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.code} - {resource.description}
              </option>
            ))}
          </Select>
          <Button variant="outline" onClick={addManualRow} disabled={isReadonly}>
            Agregar fila manual
          </Button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <Table className="table-auto">
            <colgroup>
              <col className="w-[36px]" />
              <col className="w-[440px]" />
              <col className="w-[84px]" />
              <col className="w-[76px]" />
              <col className="w-[112px]" />
              <col className="w-[128px]" />
              <col className="w-[104px]" />
              <col className="w-[84px]" />
            </colgroup>
            <THead>
              <TR className="bg-slate-50 hover:bg-slate-50">
                <TH className="w-[36px]" />
                <TH className="text-xs uppercase tracking-wide">Insumo</TH>
                <TH className="text-xs uppercase tracking-wide">Unidad</TH>
                <TH className="whitespace-nowrap text-xs uppercase tracking-wide">Cuadrilla</TH>
                <TH className="text-xs uppercase tracking-wide">Cantidad</TH>
                <TH className="whitespace-nowrap text-xs uppercase tracking-wide">Precio Unitario</TH>
                <TH className="whitespace-nowrap text-xs uppercase tracking-wide">Subtotal</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {currentPartida.apuRows.map((row, index) => {
                const calculatedRow = calculatedRows[index] ?? row;
                const isCrewDriven = isCrewDrivenApuRow(calculatedRow);
                const isPercentageBased = isPercentageBasedApuRow(calculatedRow);
                const isLabor = isLaborApuRow(calculatedRow);
                const readonlyInputClass = "border-transparent bg-transparent px-0 shadow-none";

                return (
                <TR
                  key={row.id}
                  draggable={!isReadonly}
                  onDragStart={() => {
                    if (!isReadonly) setDraggedRowId(row.id);
                  }}
                  onDragOver={(event) => {
                    if (draggedRowId && !isReadonly) event.preventDefault();
                  }}
                  onDragEnd={() => setDraggedRowId(null)}
                  onDrop={() => moveRowToTarget(row.id)}
                  className={cn(draggedRowId === row.id ? "scale-[0.995] opacity-60 ring-2 ring-sky-300" : "")}
                >
                  <TD className="pr-0">
                    {!isReadonly ? (
                      <span className="inline-flex cursor-grab text-slate-400">
                        <GripVertical className="h-4 w-4" />
                      </span>
                    ) : null}
                  </TD>
                  <TD>
                    <Input
                      value={row.description}
                      readOnly={isReadonly}
                      onChange={(event) => patchRow(index, { description: event.target.value })}
                      className={isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                    />
                  </TD>
                  <TD>
                    <Input
                      value={row.unit}
                      readOnly={isReadonly}
                      onChange={(event) => patchRow(index, { unit: event.target.value })}
                      className={isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                    />
                  </TD>
                  <TD>
                    {isLabor ? (
                      <Input
                        type="number"
                        step="0.0001"
                        value={row.crew ?? ""}
                        readOnly={isReadonly}
                        onChange={(event) => patchRow(index, { crew: event.target.value === "" ? undefined : Number(event.target.value) })}
                        className={isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                      />
                    ) : (
                      <span className={cn("block text-right tabular-nums text-slate-400", isReadonly ? "px-0 py-2" : "px-3 py-2")}>-</span>
                    )}
                  </TD>
                  <TD>
                    <Input
                      type="number"
                      step="0.0001"
                      value={calculatedRow.quantity}
                      readOnly={isReadonly || isCrewDriven}
                      onChange={(event) => patchRow(index, { quantity: Number(event.target.value) })}
                      className={cn(isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined, !isReadonly && isCrewDriven ? readonlyInputClass : undefined)}
                    />
                  </TD>
                  <TD>
                    <Input
                      type="number"
                      step="0.0001"
                      value={calculatedRow.unitPrice}
                      readOnly={isReadonly || isPercentageBased}
                      onChange={(event) => patchRow(index, { unitPrice: Number(event.target.value) })}
                      className={cn(isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined, !isReadonly && isPercentageBased ? readonlyInputClass : undefined)}
                    />
                  </TD>
                  <TD className="text-right font-medium tabular-nums text-slate-900">
                    <span className={cn("block px-3 py-2", isReadonly ? "px-0" : undefined)}>{formatCurrency(calculatedRow.subtotal, currentPartida.currency, currencyDecimals)}</span>
                  </TD>
                  <TD>
                    <Button size="sm" variant="ghost" className="h-9 px-2 text-sm" onClick={() => removeRow(index)} disabled={isReadonly}>
                      Quitar
                    </Button>
                  </TD>
                </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function normalizeRows(rows: PartidaApuRowRecord[]) {
  return rows.map((row, index) => ({
    ...row,
    sortOrder: index,
  }));
}

function buildPerformanceRate(performance: number, unit: string) {
  const normalizedUnit = unit.trim();
  return normalizedUnit ? `${performance.toFixed(4)} ${normalizedUnit}/DÍA` : `${performance.toFixed(4)}`;
}

function moveEntityToTarget<T extends { id: string }>(items: T[], sourceId: string, targetId: string) {
  const sorted = [...items];
  const sourceIndex = sorted.findIndex((item) => item.id === sourceId);
  const targetIndex = sorted.findIndex((item) => item.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return items;

  const [source] = sorted.splice(sourceIndex, 1);
  sorted.splice(targetIndex, 0, source);

  return sorted;
}
