"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { CSSProperties } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { getApuCategoryPresentation } from "@/lib/apu/presentation";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";
import { calculateApuRows, calculateApuSummary, getApuPresentationCategory, isCrewDrivenApuRow, isLaborApuRow, isPercentageBasedApuRow } from "@/lib/calculations/apu";
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
  const { currencyDecimals, excelRowHeight, excelShowFieldBorders } = useFormattingSettings();
  const { isExcelMode } = useAppViewMode();
  const addResourceSearchRef = useRef<HTMLInputElement | null>(null);
  const addResourceBlurTimeoutRef = useRef<number | null>(null);
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [addResourceHighlightedIndex, setAddResourceHighlightedIndex] = useState(0);
  const [addResourceMenuOpen, setAddResourceMenuOpen] = useState(false);
  const [addResourceMenuPosition, setAddResourceMenuPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [addResourceQuery, setAddResourceQuery] = useState("");
  const currentPartida = partida;
  const isReadonly = currentPartida?.source === "Catalogo de partidas precargado" && !currentPartida.isNew;
  const effectiveDensityMode = isExcelMode ? "compact" : "comfortable";
  const deferredAddResourceQuery = useDeferredValue(addResourceQuery);
  const indexedResourcesCatalog = useMemo(
    () =>
      resourcesCatalog.map((resource) => ({
        resource,
        searchText: buildResourceSearchText(resource),
      })),
    [resourcesCatalog],
  );
  const addResourceSuggestions = useMemo(() => {
    const query = normalizeResourceSearchText(deferredAddResourceQuery);
    return indexedResourcesCatalog
      .filter(({ searchText }) => {
        if (!query) return true;
        return searchText.includes(query);
      })
      .map(({ resource }) => resource)
      .slice(0, 8);
  }, [deferredAddResourceQuery, indexedResourcesCatalog]);
  const excelCssVariables = useMemo<CSSProperties>(
    () => getExcelViewCssVariables(excelShowFieldBorders, excelRowHeight),
    [excelRowHeight, excelShowFieldBorders],
  );
  const apuSummary = currentPartida
    ? calculateApuSummary(currentPartida.apuRows, currentPartida.performance)
    : { rows: [], categoryTotals: [], totalUnitCost: 0 };
  const { rows: calculatedRows, totalUnitCost: calculatedUnitPrice, categoryTotals } = apuSummary;
  const performanceLabel = currentPartida ? `${currentPartida.unit}/Día` : "";

  useEffect(() => {
    if (!addResourceMenuOpen || isReadonly) return;

    const updatePosition = () => {
      const element = addResourceSearchRef.current;
      if (!element) return;

      const rect = element.getBoundingClientRect();
      setAddResourceMenuPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [addResourceMenuOpen, isReadonly]);

  if (!open || !currentPartida) return null;
  const activePartida = currentPartida;

  function applyCalculatedPartida(nextRows: PartidaApuRowRecord[], performance = activePartida.performance, overrides?: Partial<EditableCatalogPartida>) {
    const normalizedRows = normalizeRows(calculateApuRows(nextRows, performance));

    onChange({
      ...activePartida,
      ...overrides,
      performance,
      apuRows: normalizedRows,
      unitPrice: calculateApuSummary(normalizedRows, performance).totalUnitCost,
      isDirty: true,
      isEditing: true,
    });
  }

  function patchRow(index: number, changes: Partial<PartidaApuRowRecord>) {
    if (isReadonly) return;

    const nextRows = activePartida.apuRows.map((row, currentIndex) =>
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

    if (addResourceBlurTimeoutRef.current !== null) {
      window.clearTimeout(addResourceBlurTimeoutRef.current);
      addResourceBlurTimeoutRef.current = null;
    }

    setAddResourceQuery("");
    setAddResourceHighlightedIndex(0);
    setAddResourceMenuOpen(false);
    setAddResourceMenuPosition(null);

    const nextRows = [
      ...activePartida.apuRows,
      {
        id: crypto.randomUUID(),
        catalogPartidaId: activePartida.id,
        resourceId: selected.id,
        description: selected.description,
        unit: selected.unit,
        crew: undefined,
        quantity: 1,
        unitPrice: selected.unitPrice,
        subtotal: selected.unitPrice,
        resourceType: selected.category,
        groupLabel: undefined,
        sortOrder: activePartida.apuRows.length,
      },
    ];

    applyCalculatedPartida(nextRows);
  }

  function addManualRow() {
    if (isReadonly) return;
    const nextRows = [
      ...activePartida.apuRows,
      {
        id: crypto.randomUUID(),
        catalogPartidaId: activePartida.id,
        description: "",
        unit: "",
        quantity: 0,
        unitPrice: 0,
        subtotal: 0,
        sortOrder: activePartida.apuRows.length,
      },
    ];

    applyCalculatedPartida(nextRows);
  }

  function removeRow(index: number) {
    if (isReadonly) return;
    const nextRows = activePartida.apuRows.filter((_, currentIndex) => currentIndex !== index);
    applyCalculatedPartida(nextRows);
  }

  function moveRowToTarget(targetId: string) {
    if (isReadonly || !draggedRowId || draggedRowId === targetId) return;
    applyCalculatedPartida(moveEntityToTarget(activePartida.apuRows, draggedRowId, targetId));
    setDraggedRowId(null);
  }

  function openAddResourceSearch() {
    if (isReadonly) return;
    if (addResourceBlurTimeoutRef.current !== null) {
      window.clearTimeout(addResourceBlurTimeoutRef.current);
      addResourceBlurTimeoutRef.current = null;
    }
    setAddResourceMenuOpen(true);
    setAddResourceHighlightedIndex(0);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-testid="partida-apu-overlay"
          onClick={onClose}
          className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm"
        />
        <Dialog.Content asChild>
          <div
            className={cn("fixed inset-y-0 right-0 z-50 ml-auto h-full w-full max-w-6xl overflow-y-auto bg-white p-5", isExcelMode ? "border-l border-slate-300 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.16)]" : "shadow-2xl")}
            data-excel-field-border-scope="apu-editor"
            data-view-mode={isExcelMode ? "excel" : "modern"}
            data-density-mode={effectiveDensityMode}
            style={excelCssVariables}
          >
        <Dialog.Description className="sr-only">
          Editor APU de la partida {activePartida.description}. Unidad {activePartida.unit}.
        </Dialog.Description>
        <div className={cn("flex items-start justify-between gap-4", isExcelMode ? "mb-3" : "mb-5")}>
          <div>
            <p className={cn("text-slate-500", isExcelMode ? "text-xs uppercase tracking-wide" : "text-sm")}>Editor APU</p>
            <Dialog.Title asChild>
              <h3 className={cn("font-semibold text-slate-900", isExcelMode ? "text-xl" : "text-2xl")}>{activePartida.description}</h3>
            </Dialog.Title>
            <p className={cn("mt-1 text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Unidad: {activePartida.unit}</p>
          </div>
          <Dialog.Close asChild>
            <Button variant="outline" className={cn(isExcelMode && "h-8 px-3 text-xs")}>
              Cerrar
            </Button>
          </Dialog.Close>
        </div>

        <div className={cn("grid", isExcelMode ? "mb-3 gap-2" : "mb-5 gap-4")}>
          <div className={cn("grid md:grid-cols-2", isExcelMode ? "gap-2" : "gap-4")}>
            <div className={cn("border border-slate-200", isExcelMode ? "rounded-md border-slate-300 p-2" : "rounded-2xl p-4")}>
              <p className={cn("text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Rendimiento ({performanceLabel})</p>
              <Input
                type="number"
                step="0.0001"
                value={activePartida.performance}
                readOnly={isReadonly}
                onChange={(event) =>
                  applyCalculatedPartida(activePartida.apuRows, Number(event.target.value), {
                    performanceRate: buildPerformanceRate(Number(event.target.value), activePartida.performanceUnit ?? activePartida.unit),
                  })
                }
                className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined)}
              />
            </div>
            <div className={cn("border border-slate-200", isExcelMode ? "rounded-md border-slate-300 p-2" : "rounded-2xl p-4")}>
              <p className={cn("text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Costo unitario</p>
              <p className={cn("mt-2 font-semibold text-slate-900", isExcelMode ? "text-xl" : "text-2xl")}>
                {formatCurrency(calculatedUnitPrice, activePartida.currency, currencyDecimals)}
              </p>
            </div>
          </div>
          <div className={cn("grid sm:grid-cols-2 xl:grid-cols-5", isExcelMode ? "gap-2" : "gap-3")}>
            {categoryTotals.map((categoryTotal) => {
              const presentation = getApuCategoryPresentation(categoryTotal.category);

              return (
                <div
                  key={categoryTotal.category}
                  data-testid={`partida-apu-summary-card-${categoryTotal.category}`}
                  className={cn("border", isExcelMode ? "rounded-md p-2" : "rounded-2xl p-4", presentation.summaryClassName)}
                >
                  <p className={cn("font-medium", isExcelMode ? "text-[11px] uppercase tracking-wide" : "text-sm")}>{presentation.label}</p>
                  <p className={cn("mt-1 font-semibold tabular-nums", isExcelMode ? "text-base" : "text-lg")}>
                    {formatCurrency(categoryTotal.subtotal, activePartida.currency, currencyDecimals)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className={cn("grid md:grid-cols-[1fr_180px]", isExcelMode ? "mb-3 gap-2" : "mb-5 gap-3")}>
          <Input
            ref={addResourceSearchRef}
            value={addResourceQuery}
            disabled={isReadonly}
            onFocus={openAddResourceSearch}
            onChange={(event) => {
              if (addResourceBlurTimeoutRef.current !== null) {
                window.clearTimeout(addResourceBlurTimeoutRef.current);
                addResourceBlurTimeoutRef.current = null;
              }
              setAddResourceQuery(event.target.value);
              setAddResourceMenuOpen(true);
              setAddResourceHighlightedIndex(0);
            }}
            onKeyDown={(event) => {
              if (addResourceSuggestions.length > 0) {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setAddResourceHighlightedIndex((current) => Math.min(current + 1, addResourceSuggestions.length - 1));
                  return;
                }

                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setAddResourceHighlightedIndex((current) => Math.max(current - 1, 0));
                  return;
                }

                if (event.key === "Enter") {
                  event.preventDefault();
                  const selected = addResourceSuggestions[addResourceHighlightedIndex];
                  if (selected) {
                    addResource(selected.id);
                  }
                  return;
                }
              }

              if (event.key === "Escape") {
                setAddResourceMenuOpen(false);
                setAddResourceMenuPosition(null);
                setAddResourceHighlightedIndex(0);
              }
            }}
            onBlur={() => {
              addResourceBlurTimeoutRef.current = window.setTimeout(() => {
                setAddResourceMenuOpen(false);
                setAddResourceMenuPosition(null);
                setAddResourceHighlightedIndex(0);
                addResourceBlurTimeoutRef.current = null;
              }, 120);
            }}
            className={getInputDensityClass(effectiveDensityMode, isExcelMode)}
            data-excel-field-border-opt-out="true"
            data-testid="partida-apu-add-resource-search"
            placeholder="Agregar insumo desde el catálogo"
          />
          <Button
            variant="outline"
            className={cn(effectiveDensityMode === "compact" ? "h-8 text-xs" : "h-9 text-sm")}
            data-testid="partida-apu-add-manual-row-button"
            onClick={addManualRow}
            disabled={isReadonly}
          >
            Agregar fila manual
          </Button>
        </div>
        {addResourceMenuOpen && addResourceSuggestions.length > 0 && addResourceMenuPosition && !isReadonly ? (
          <div
            className="fixed z-[90] overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl"
            style={{
              top: addResourceMenuPosition.top,
              left: addResourceMenuPosition.left,
              width: addResourceMenuPosition.width,
            }}
          >
            <div className="max-h-64 overflow-auto py-1">
              {addResourceSuggestions.map((resource, suggestionIndex) => (
                <button
                  key={resource.id}
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-3 py-2 text-left",
                    suggestionIndex === addResourceHighlightedIndex ? "bg-sky-100" : "hover:bg-sky-50",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addResource(resource.id);
                  }}
                  onMouseEnter={() => setAddResourceHighlightedIndex(suggestionIndex)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{resource.code} - {resource.description}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{resource.unit}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className={getTableFrameClassName(isExcelMode)} data-density-mode={effectiveDensityMode}>
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
            <THead className={cn(isExcelMode && "[&_th]:bg-slate-100 [&_th]:text-[11px] [&_th]:font-semibold")}>
              <TR className={cn("hover:bg-slate-50", isExcelMode ? "bg-slate-100/90 hover:bg-slate-100/90" : "bg-slate-50")}>
                <TH className={getHeaderCellClass(isExcelMode, "w-[36px]")} />
                <TH className={getHeaderCellClass(isExcelMode)}>Insumo</TH>
                <TH className={getHeaderCellClass(isExcelMode, "text-center")}>Unidad</TH>
                <TH className={getHeaderCellClass(isExcelMode, "whitespace-nowrap text-right")}>Cuadrilla</TH>
                <TH className={getHeaderCellClass(isExcelMode, "text-right")}>Cantidad</TH>
                <TH className={getHeaderCellClass(isExcelMode, "whitespace-nowrap text-right")}>Precio unitario</TH>
                <TH className={getHeaderCellClass(isExcelMode, "whitespace-nowrap text-right")}>Subtotal</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {activePartida.apuRows.map((row, index) => {
                const calculatedRow = calculatedRows[index] ?? row;
                const presentationCategory = getApuPresentationCategory(calculatedRow);
                const categoryPresentation = getApuCategoryPresentation(presentationCategory);
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
                    className={cn(categoryPresentation.rowClassName, draggedRowId === row.id ? "scale-[0.995] opacity-60 ring-2 ring-sky-300" : "")}
                  >
                    <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "pr-0")}>
                      <div className="flex items-center justify-center">
                        <span
                          data-testid={`partida-apu-row-indicator-${row.id}`}
                          data-apu-category={presentationCategory}
                          className={cn(
                            "inline-flex h-5 w-5 items-center justify-center rounded-md border",
                            !isReadonly && "cursor-grab",
                            categoryPresentation.indicatorClassName,
                          )}
                        >
                          {!isReadonly ? <GripVertical className="h-4 w-4" /> : null}
                        </span>
                      </div>
                    </TD>
                    <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                      <Input
                        value={row.description}
                        readOnly={isReadonly}
                        onChange={(event) => patchRow(index, { description: event.target.value })}
                        className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined)}
                      />
                    </TD>
                    <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "text-center")}>
                      <Input
                        value={row.unit}
                        readOnly={isReadonly}
                        onChange={(event) => patchRow(index, { unit: event.target.value })}
                        className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined)}
                      />
                    </TD>
                    <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                      {isLabor ? (
                        <Input
                          type="number"
                          step="0.0001"
                          value={row.crew ?? ""}
                          readOnly={isReadonly}
                          onChange={(event) => patchRow(index, { crew: event.target.value === "" ? undefined : Number(event.target.value) })}
                          className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), "text-right tabular-nums", isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined)}
                        />
                      ) : (
                        <span
                          className={cn(
                            "block text-right tabular-nums text-slate-400",
                            effectiveDensityMode === "compact" ? "py-1.5 text-xs" : "py-2 text-sm",
                          )}
                        >
                          -
                        </span>
                      )}
                    </TD>
                    <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                      <Input
                        type="number"
                        step="0.0001"
                        value={calculatedRow.quantity}
                        readOnly={isReadonly || isCrewDriven}
                        onChange={(event) => patchRow(index, { quantity: Number(event.target.value) })}
                        className={cn(
                          getInputDensityClass(effectiveDensityMode, isExcelMode),
                          "text-right tabular-nums",
                          isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined,
                          !isReadonly && isCrewDriven ? readonlyInputClass : undefined,
                        )}
                      />
                    </TD>
                    <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                      <Input
                        type="number"
                        step="0.0001"
                        value={calculatedRow.unitPrice}
                        readOnly={isReadonly || isPercentageBased}
                        onChange={(event) => patchRow(index, { unitPrice: Number(event.target.value) })}
                        className={cn(
                          getInputDensityClass(effectiveDensityMode, isExcelMode),
                          "text-right tabular-nums",
                          isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined,
                          !isReadonly && isPercentageBased ? readonlyInputClass : undefined,
                        )}
                      />
                    </TD>
                    <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "text-right text-xs font-semibold tabular-nums text-slate-900")}>
                      {formatCurrency(calculatedRow.subtotal, activePartida.currency, currencyDecimals)}
                    </TD>
                    <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(effectiveDensityMode === "compact" ? "h-8 px-2 text-xs" : "h-9 px-2 text-sm")}
                        onClick={() => removeRow(index)}
                        disabled={isReadonly}
                      >
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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

function getHeaderCellClass(isExcelMode: boolean, className?: string) {
  return cn(
    "budget-sticky-header sticky top-0 h-10 text-xs uppercase tracking-wide",
    isExcelMode ? "z-30 border-b border-slate-300 bg-slate-100 text-[11px] font-semibold text-slate-700" : "z-20 bg-slate-50",
    className,
  );
}

function getInputDensityClass(mode: "compact" | "comfortable", isExcelMode = false) {
  if (isExcelMode) return "h-8 rounded-sm border-slate-300 px-2 text-xs shadow-none";
  return mode === "compact" ? "h-8 rounded-lg px-2 text-xs" : "h-9 rounded-xl px-3 text-sm";
}

function getCellPadding(mode: "compact" | "comfortable", isExcelMode = false) {
  return cn(mode === "compact" ? "py-2" : "py-3", isExcelMode && "border-b border-slate-200 text-xs");
}

function normalizeResourceSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function buildResourceSearchText(resource: ResourceRecord) {
  return normalizeResourceSearchText([resource.code, resource.description, resource.unit, resource.category].filter(Boolean).join(" "));
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
