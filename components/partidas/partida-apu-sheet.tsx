"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { BotMessageSquare, GripVertical, Sparkles, WandSparkles } from "lucide-react";
import { buildApuRowsFromAiSuggestion, buildApuRowsFromCatalogProposal, parseAiPerformance, selectCatalogProposalBasePartida } from "@/lib/ai/apu-suggestion";
import type { AiApuCatalogGenerationResult, AiApuStructuredData, AiEndpointResult } from "@/lib/ai/types";
import { getApuCategoryPresentation } from "@/lib/apu/presentation";
import { isSubpartidaResourceType } from "@/lib/apu/subpartidas";
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
  const [aiApuResult, setAiApuResult] = useState<AiApuPreviewResult | null>(null);
  const [aiApuError, setAiApuError] = useState("");
  const [aiApuLoading, setAiApuLoading] = useState(false);
  const [subpartidaApuPreview, setSubpartidaApuPreview] = useState<{
    title: string;
    performance: number;
    unit: string;
    rows: PartidaApuRowRecord[];
  } | null>(null);
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

  function applyCalculatedPartida(nextRows: PartidaApuRowRecord[], performance?: number, overrides?: Partial<EditableCatalogPartida>) {
    const resolvedPerformance = performance ?? activePartida.performance;
    const normalizedRows = normalizeRows(calculateApuRows(nextRows, resolvedPerformance));

    onChange({
      ...activePartida,
      ...overrides,
      performance: resolvedPerformance,
      apuRows: normalizedRows,
      unitPrice: calculateApuSummary(normalizedRows, resolvedPerformance).totalUnitCost,
      isDirty: true,
      isEditing: true,
    });
  }

  async function generateAiApuSuggestion() {
    if (isReadonly || aiApuLoading) return;

    setAiApuLoading(true);
    setAiApuError("");

    try {
      const response = await fetch("/api/ai/apu/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: activePartida.description,
          unit: activePartida.unit,
          context: {
            module: "Editor APU",
            selectedItem: activePartida.description,
            unit: activePartida.unit,
            currentCost: activePartida.unitPrice,
            activeTable: "APU de partida",
          },
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readAiErrorMessage(payload));
      }

      setAiApuResult(readAiApuPreviewResult(payload));
    } catch (caughtError) {
      setAiApuError(caughtError instanceof Error ? caughtError.message : "No se pudo generar la propuesta IA.");
    } finally {
      setAiApuLoading(false);
    }
  }

  function applyAiApuSuggestion() {
    if (isReadonly || !aiApuResult) return;

    if (isAiApuCatalogGenerationResult(aiApuResult)) {
      const aiRows = buildApuRowsFromCatalogProposal({
        proposal: aiApuResult.proposal,
        catalogPartidaId: activePartida.id,
        resources: resourcesCatalog,
        existingRowsCount: activePartida.apuRows.length,
      });

      applyCalculatedPartida([...activePartida.apuRows, ...aiRows]);
      setAiApuResult(null);
      return;
    }

    if (!isAiApuStructuredData(aiApuResult.structuredData)) return;

    const aiRows = buildApuRowsFromAiSuggestion({
      suggestion: aiApuResult.structuredData,
      catalogPartidaId: activePartida.id,
      existingRowsCount: activePartida.apuRows.length,
    });
    const nextPerformance = parseAiPerformance(aiApuResult.structuredData.performance, activePartida.performance);

    applyCalculatedPartida([...activePartida.apuRows, ...aiRows], nextPerformance, {
      performanceRate: buildPerformanceRate(nextPerformance, aiApuResult.structuredData.unit || activePartida.performanceUnit || activePartida.unit),
    });
    setAiApuResult(null);
  }

  function selectAiApuSimilarPartida(partidaId: string) {
    setAiApuResult((currentResult) =>
      isAiApuCatalogGenerationResult(currentResult)
        ? selectCatalogProposalBasePartida({ result: currentResult, partidaId })
        : currentResult,
    );
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
          <div className="flex flex-wrap justify-end gap-2">
            <Link href={buildAiHref("chat", currentPartida.description, currentPartida.unit, "Explica tecnicamente esta partida y valida su rendimiento.")}>
              <Button variant="ghost" className={cn("gap-2", isExcelMode && "h-8 px-3 text-xs")}>
                <BotMessageSquare className="h-4 w-4" />
                Explicar partida
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              className={cn("gap-2", isExcelMode && "h-8 px-3 text-xs")}
              onClick={() => void generateAiApuSuggestion()}
              disabled={isReadonly || aiApuLoading}
            >
                <Sparkles className="h-4 w-4" />
                {aiApuLoading ? "Generando..." : "Generar con IA"}
            </Button>
            <Link href={buildAiHref("apu", currentPartida.description, currentPartida.unit)}>
              <Button variant="ghost" className={cn("gap-2", isExcelMode && "h-8 px-3 text-xs")}>
                Abrir en Copiloto
              </Button>
            </Link>
            <Dialog.Close asChild>
              <Button variant="outline" className={cn(isExcelMode && "h-8 px-3 text-xs")}>
                Cerrar
              </Button>
            </Dialog.Close>
          </div>
        </div>

        {aiApuError ? (
          <div className={cn("mb-4 border border-rose-200 bg-rose-50 text-rose-700", isExcelMode ? "rounded-md px-3 py-2 text-xs" : "rounded-2xl px-4 py-3 text-sm")}>
            {aiApuError}
          </div>
        ) : null}

        {aiApuResult ? (
          <AiApuPreview
            result={aiApuResult}
            isExcelMode={isExcelMode}
            onApply={applyAiApuSuggestion}
            onDismiss={() => setAiApuResult(null)}
            onSelectSimilarPartida={selectAiApuSimilarPartida}
            copilotHref={buildAiHref("apu", currentPartida.description, currentPartida.unit)}
          />
        ) : null}

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
                const nestedRows = isSubpartidaResourceType(row.resourceType ?? row.groupLabel) ? row.catalogSubpartida?.apuRows ?? [] : [];

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
                      <div className="flex items-center gap-2">
                        <Input
                          value={row.description}
                          readOnly={isReadonly}
                          onChange={(event) => patchRow(index, { description: event.target.value })}
                          className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined)}
                        />
                        <Link href={buildAiHref("autocomplete", row.description, row.unit)}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className={cn("gap-1", effectiveDensityMode === "compact" ? "h-8 px-2 text-[11px]" : "h-9 px-2 text-xs")}
                          >
                            <WandSparkles className="h-3.5 w-3.5" />
                            IA
                          </Button>
                        </Link>
                        {nestedRows.length > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn(effectiveDensityMode === "compact" ? "h-8 px-2 text-[11px]" : "h-9 px-2 text-xs")}
                            onClick={() =>
                              setSubpartidaApuPreview({
                                title: row.catalogSubpartida?.description ?? row.description,
                                performance: row.catalogSubpartida?.performance ?? 1,
                                unit: row.catalogSubpartida?.unit ?? row.unit,
                                rows: nestedRows,
                              })
                            }
                          >
                            Ver APU
                          </Button>
                        ) : null}
                      </div>
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
        <ReadonlySubpartidaApuDialog
          currency={activePartida.currency}
          currencyDecimals={currencyDecimals}
          densityMode={effectiveDensityMode}
          excelCssVariables={excelCssVariables}
          isExcelMode={isExcelMode}
          preview={subpartidaApuPreview}
          onClose={() => setSubpartidaApuPreview(null)}
        />
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

function ReadonlySubpartidaApuDialog({
  preview,
  currency,
  currencyDecimals,
  densityMode,
  excelCssVariables,
  isExcelMode,
  onClose,
}: {
  preview: { title: string; performance: number; unit: string; rows: PartidaApuRowRecord[] } | null;
  currency: string;
  currencyDecimals: number;
  densityMode: "compact" | "comfortable";
  excelCssVariables: CSSProperties;
  isExcelMode: boolean;
  onClose: () => void;
}) {
  const summary = preview ? calculateApuSummary(preview.rows, preview.performance) : null;
  const popupInputClassName = cn(
    getInputDensityClass(densityMode, isExcelMode),
    "bg-transparent shadow-none",
    !isExcelMode && "border-transparent px-0",
  );

  return (
    <Dialog.Root open={preview !== null} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[130] max-h-[82vh] w-[min(920px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          data-excel-field-border-scope="apu-editor"
          data-view-mode={isExcelMode ? "excel" : "modern"}
          data-density-mode={densityMode}
          style={excelCssVariables}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-950">APU de subpartida</Dialog.Title>
              <p className="mt-1 text-sm text-slate-500">{preview?.title}</p>
              <p className="mt-1 text-sm text-slate-500">Unidad: {preview?.unit ?? ""}</p>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">Cerrar</Button>
            </Dialog.Close>
          </div>
          <div className="max-h-[64vh] overflow-auto p-4">
            <div className={cn("grid md:grid-cols-2", isExcelMode ? "mb-3 gap-2" : "mb-5 gap-4")}>
              <div className={cn("border border-slate-200", isExcelMode ? "rounded-md border-slate-300 p-2" : "rounded-2xl p-4")}>
                <p className={cn("text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Rendimiento ({preview?.unit ?? ""}/Día)</p>
                <Input
                  value={preview?.performance.toFixed(4) ?? ""}
                  readOnly
                  className={cn(popupInputClassName, "tabular-nums")}
                />
              </div>
              <div className={cn("border border-slate-200", isExcelMode ? "rounded-md border-slate-300 p-2" : "rounded-2xl p-4")}>
                <p className={cn("text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Costo unitario</p>
                <p className={cn("mt-2 font-semibold text-slate-900", isExcelMode ? "text-xl" : "text-2xl")}>
                  {formatCurrency(summary?.totalUnitCost ?? 0, currency, currencyDecimals)}
                </p>
              </div>
            </div>
            <div className={getTableFrameClassName(isExcelMode)} data-density-mode={densityMode}>
              <Table className="table-auto">
                <colgroup>
                  <col className="w-[36px]" />
                  <col className="w-[440px]" />
                  <col className="w-[84px]" />
                  <col className="w-[76px]" />
                  <col className="w-[112px]" />
                  <col className="w-[128px]" />
                  <col className="w-[104px]" />
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
                  </TR>
                </THead>
                <TBody>
                {preview?.rows.map((row) => (
                  <TR key={row.id} className={getApuCategoryPresentation(getApuPresentationCategory(row)).rowClassName}>
                    <TD className={cn(getCellPadding(densityMode, isExcelMode), "pr-0")}>
                      <span
                        data-apu-category={getApuPresentationCategory(row)}
                        className={cn("inline-flex h-5 w-5 items-center justify-center rounded-md border", getApuCategoryPresentation(getApuPresentationCategory(row)).indicatorClassName)}
                      />
                    </TD>
                    <TD className={getCellPadding(densityMode, isExcelMode)}>
                      <Input value={row.description} readOnly className={popupInputClassName} />
                    </TD>
                    <TD className={cn(getCellPadding(densityMode, isExcelMode), "text-center")}>
                      <Input value={row.unit} readOnly className={cn(popupInputClassName, "text-center")} />
                    </TD>
                    <TD className={getCellPadding(densityMode, isExcelMode)}>
                      <span className={cn("block text-right tabular-nums text-slate-400", densityMode === "compact" ? "py-1.5 text-xs" : "py-2 text-sm")}>-</span>
                    </TD>
                    <TD className={getCellPadding(densityMode, isExcelMode)}>
                      <Input value={row.quantity.toFixed(4)} readOnly className={cn(popupInputClassName, "text-right tabular-nums")} />
                    </TD>
                    <TD className={getCellPadding(densityMode, isExcelMode)}>
                      <Input value={row.unitPrice.toFixed(4)} readOnly className={cn(popupInputClassName, "text-right tabular-nums")} />
                    </TD>
                    <TD className={cn(getCellPadding(densityMode, isExcelMode), "text-right text-xs font-semibold tabular-nums text-slate-900")}>
                      {formatCurrency(row.subtotal, currency, currencyDecimals)}
                    </TD>
                  </TR>
                ))}
                </TBody>
              </Table>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type AiApuPreviewResult = AiEndpointResult | AiApuCatalogGenerationResult;

function AiApuPreview({
  result,
  isExcelMode,
  onApply,
  onDismiss,
  onSelectSimilarPartida,
  copilotHref,
}: {
  result: AiApuPreviewResult;
  isExcelMode: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onSelectSimilarPartida: (partidaId: string) => void;
  copilotHref: string;
}) {
  const catalogData = isAiApuCatalogGenerationResult(result) ? result : null;
  const structuredData = isAiApuCatalogGenerationResult(result)
    ? null
    : isAiApuStructuredData(result.structuredData)
      ? result.structuredData
      : null;
  const shellClassName = cn(
    "mb-4 border border-sky-200 bg-sky-50/70 shadow-[0_16px_30px_-28px_rgba(2,132,199,0.35)]",
    isExcelMode ? "rounded-md p-3 text-xs" : "rounded-2xl p-4 text-sm",
  );

  return (
    <section className={shellClassName} aria-label="Vista previa IA">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Vista previa IA</p>
          <h4 className={cn("font-semibold text-slate-950", isExcelMode ? "text-base" : "text-lg")}>Propuesta APU pendiente de aplicar</h4>
          <p className="mt-1 text-xs text-slate-600">
            Modelo usado: {result.model} · Solicitado: {result.requestedModel}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {result.fallbackUsed ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">Fallback activo</span> : null}
          <Link href={copilotHref}>
            <Button variant="ghost" className={cn(isExcelMode && "h-8 px-3 text-xs")}>Abrir en Copiloto</Button>
          </Link>
        </div>
      </div>

      {result.warnings.length > 0 ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {result.warnings.join(" ")}
        </div>
      ) : null}

      {catalogData ? (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <PreviewMetric label="Unidad" value={catalogData.proposal.unit || "Sin unidad"} />
            <PreviewMetric label="Confianza" value={`${Math.round(catalogData.confidence * 100)}%`} />
            <PreviewMetric label="Validacion" value={catalogData.validation.isValid ? "Catalogo validado" : "Revisar advertencias"} />
          </div>
          <PreviewSimilarPartidas
            items={catalogData.similar_partidas}
            selectedId={catalogData.proposal.based_on_partida_id}
            onSelect={onSelectSimilarPartida}
          />
          <PreviewCatalogItems items={catalogData.proposal.items} />
          <PreviewSuggestedResources items={catalogData.proposal.suggested_new_resources} />
          <PreviewDebugPanel debug={catalogData.debug} />
        </div>
      ) : structuredData ? (
        <div className="mt-4 grid gap-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <PreviewMetric label="Unidad" value={structuredData.unit || "Sin unidad"} />
            <PreviewMetric label="Rendimiento" value={structuredData.performance || "Sin dato"} />
            <PreviewMetric label="Cuadrilla" value={structuredData.crew || "Sin dato"} />
          </div>
          <PreviewResourceGroup title="Materiales" items={structuredData.materials} />
          <PreviewResourceGroup title="Mano de obra" items={structuredData.labor} />
          <PreviewResourceGroup title="Equipos" items={structuredData.equipment} />
          <PreviewTextList title="Observaciones" items={structuredData.observations} />
          <PreviewTextList title="Supuestos" items={structuredData.assumptions} />
          <PreviewDebugPanel debug={result.debug} />
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-amber-200 bg-white px-3 py-2 text-xs text-amber-800">
          La IA devolvio texto libre. Puedes revisarlo en el copiloto antes de aplicar cambios manuales.
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDismiss} className={cn(isExcelMode && "h-8 px-3 text-xs")}>
          Descartar
        </Button>
        <Button type="button" onClick={onApply} disabled={catalogData ? catalogData.proposal.items.length === 0 : !structuredData} className={cn(isExcelMode && "h-8 px-3 text-xs")}>
          Aplicar propuesta
        </Button>
      </div>
    </section>
  );
}

function PreviewDebugPanel({ debug }: { debug: AiApuCatalogGenerationResult["debug"] | AiEndpointResult["debug"] }) {
  if (!debug) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-950 text-slate-100">
      <div className="border-b border-slate-800 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300">
        Debug IA desarrollo
      </div>
      <div className="grid gap-2 p-3">
        <DebugJsonBlock title="Contexto backend" value={"context" in debug ? debug.context : null} />
        <DebugJsonBlock title="Mensajes enviados a Ollama" value={"messages" in debug ? debug.messages : null} />
        <DebugJsonBlock title="Respuesta cruda IA" value={"ai" in debug ? debug.ai : debug} />
        <DebugJsonBlock title="Fallback y sugerencias" value={"fallback" in debug ? debug.fallback : null} />
        <DebugJsonBlock title="Advertencias de validacion" value={"validationWarnings" in debug ? debug.validationWarnings : null} />
      </div>
    </div>
  );
}

function DebugJsonBlock({ title, value }: { title: string; value: unknown }) {
  if (value === null || value === undefined) return null;

  return (
    <details className="rounded-lg border border-slate-800 bg-slate-900">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-200">{title}</summary>
      <pre className="max-h-80 overflow-auto border-t border-slate-800 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
        {formatDebugValue(value)}
      </pre>
    </details>
  );
}

function formatDebugValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-sky-100 bg-white px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function PreviewSimilarPartidas({
  items,
  selectedId,
  onSelect,
}: {
  items: AiApuCatalogGenerationResult["similar_partidas"];
  selectedId?: string;
  onSelect: (partidaId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Partidas similares</div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const isSelected = item.id === selectedId;
          const hasItems = item.items.length > 0;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => hasItems && onSelect(item.id)}
              disabled={!hasItems}
              className={cn(
                "grid w-full gap-2 px-3 py-2 text-left transition sm:grid-cols-[1fr_64px_72px_76px]",
                isSelected ? "bg-sky-50" : "hover:bg-slate-50",
                !hasItems && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="font-medium text-slate-900">{item.description}</span>
              <span className="text-slate-600">{item.unit}</span>
              <span className="text-right tabular-nums text-slate-700">{Math.round(item.similarity * 100)}%</span>
              <span className={cn("text-right text-xs font-semibold", isSelected ? "text-sky-700" : "text-slate-500")}>
                {isSelected ? "Base" : hasItems ? "Usar" : "Sin APU"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PreviewCatalogItems({ items }: { items: AiApuCatalogGenerationResult["proposal"]["items"] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">Insumos del catalogo</div>
      {items.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.resource_id} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_72px_96px]">
              <span className="font-medium text-slate-900">{item.name}</span>
              <span className="text-slate-600">{item.unit}</span>
              <span className="text-right tabular-nums text-slate-700">{item.quantity}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">Sin insumos validos sugeridos.</p>
      )}
    </div>
  );
}

function PreviewSuggestedResources({ items }: { items: AiApuCatalogGenerationResult["proposal"]["suggested_new_resources"] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Insumos faltantes</p>
      <ul className="mt-2 space-y-1 text-xs text-amber-800">
        {items.map((item, index) => (
          <li key={`${item.based_on}-${index}`}>{item.based_on}: {item.reason}</li>
        ))}
      </ul>
    </div>
  );
}

function PreviewResourceGroup({ title, items }: { title: string; items: AiApuStructuredData["materials"] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</div>
      {items.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <div key={`${title}-${index}-${item.description}`} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_72px_96px]">
              <span className="font-medium text-slate-900">{item.description || "Recurso sugerido sin descripcion"}</span>
              <span className="text-slate-600">{item.unit || "s/u"}</span>
              <span className="text-right tabular-nums text-slate-700">{item.quantity || "0"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-slate-500">Sin recursos sugeridos.</p>
      )}
    </div>
  );
}

function PreviewTextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</p>
      <ul className="mt-2 space-y-1 text-xs text-slate-600">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function readAiApuPreviewResult(payload: unknown): AiApuPreviewResult {
  if (isAiApuCatalogGenerationResult(payload)) return payload;
  return readAiEndpointResult(payload);
}

function readAiEndpointResult(payload: unknown): AiEndpointResult {
  if (!isRecord(payload)) throw new Error("La respuesta de IA no tiene el formato esperado.");

  return {
    answer: readString(payload.answer),
    model: readString(payload.model),
    requestedModel: readString(payload.requestedModel),
    fallbackUsed: payload.fallbackUsed === true,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.filter((warning): warning is string => typeof warning === "string") : [],
    latencyMs: typeof payload.latencyMs === "number" ? payload.latencyMs : undefined,
    structuredData: payload.structuredData,
  };
}

function isAiApuCatalogGenerationResult(value: unknown): value is AiApuCatalogGenerationResult {
  return (
    isRecord(value) &&
    isRecord(value.proposal) &&
    Array.isArray(value.similar_partidas) &&
    Array.isArray(value.matching_resources) &&
    typeof value.confidence === "number" &&
    isRecord(value.validation) &&
    typeof value.model === "string" &&
    typeof value.requestedModel === "string" &&
    typeof value.fallbackUsed === "boolean"
  );
}

function readAiErrorMessage(payload: unknown): string {
  if (!isRecord(payload)) return "No se pudo completar la solicitud de IA.";
  if (typeof payload.error === "string") return payload.error;
  if (typeof payload.message === "string") return payload.message;
  return "No se pudo completar la solicitud de IA.";
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isAiApuStructuredData(value: unknown): value is AiApuStructuredData {
  return (
    isRecord(value) &&
    typeof value.answer === "string" &&
    typeof value.unit === "string" &&
    typeof value.performance === "string" &&
    typeof value.crew === "string" &&
    isAiLineItemArray(value.materials) &&
    isAiLineItemArray(value.labor) &&
    isAiLineItemArray(value.equipment) &&
    isStringArray(value.observations) &&
    isStringArray(value.assumptions)
  );
}

function isAiLineItemArray(value: unknown): value is AiApuStructuredData["materials"] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.description === "string" &&
        typeof item.unit === "string" &&
        typeof item.quantity === "string" &&
        (item.notes === undefined || typeof item.notes === "string"),
    )
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function buildAiHref(action: "chat" | "apu" | "autocomplete", description: string, unit: string, message?: string) {
  const params = new URLSearchParams({
    action,
    project: "Catalogo de partidas",
    module: "APU",
    selectedItem: description,
    unit,
    activeTable: "Editor APU",
  });

  if (action === "chat") {
    params.set("message", message ?? "Explica esta partida.");
  }

  if (action === "apu") {
    params.set("description", description);
    params.set("apuUnit", unit);
  }

  if (action === "autocomplete") {
    params.set("input", description);
  }

  return `/ai?${params.toString()}`;
}
