"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { BotMessageSquare, GripVertical, Sparkles } from "lucide-react";
import { useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { BufferedInput } from "@/components/ui/buffered-input";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { getApuCategoryPresentation } from "@/lib/apu/presentation";
import { buildApuResourcesFromCatalogProposal, parseAiDecimal, parseAiPerformance, selectCatalogProposalBasePartida } from "@/lib/ai/apu-suggestion";
import type { AiApuCatalogGenerationResult, AiApuStructuredData, AiEndpointResult } from "@/lib/ai/types";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";
import {
  APU_PRESENTATION_CATEGORY_ORDER,
  calculateApuSummary,
  getApuPresentationCategory,
  isCrewDrivenApuRow,
  isLaborApuRow,
  isPercentageBasedApuRow,
} from "@/lib/calculations/apu";
import type { BudgetItemRecord } from "@/types/budget";
import type { ApuResourceRecord } from "@/types/apu";
import type { ResourceRecord } from "@/types/resource";
import { cn, formatCurrency } from "@/lib/utils";

type ApuEditorSheetProps = {
  item: BudgetItemRecord | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (item: BudgetItemRecord) => void;
  resourcesCatalog: ResourceRecord[];
  restoreFocusElement?: HTMLElement | null;
  densityMode: "compact" | "comfortable";
};
type ResourceMenuState = {
  rowId: string;
  top: number;
  left: number;
  width: number;
};

export function ApuEditorSheet({
  item,
  open,
  onClose,
  onUpdate,
  resourcesCatalog,
  restoreFocusElement,
  densityMode,
}: ApuEditorSheetProps) {
  const { isExcelMode } = useBudgetViewMode();
  const { currencyDecimals, excelRowHeight, excelShowFieldBorders } = useFormattingSettings();
  const addResourceSearchRef = useRef<HTMLInputElement | null>(null);
  const addResourceBlurTimeoutRef = useRef<number | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const resourceSearchRefs = useRef(new Map<string, HTMLInputElement>());
  const [addResourceHighlightedIndex, setAddResourceHighlightedIndex] = useState(0);
  const [addResourceMenuOpen, setAddResourceMenuOpen] = useState(false);
  const [addResourceMenuPosition, setAddResourceMenuPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [addResourceQuery, setAddResourceQuery] = useState("");
  const [draggedResourceId, setDraggedResourceId] = useState<string | null>(null);
  const [editingResourceRowId, setEditingResourceRowId] = useState<string | null>(null);
  const [editingResourceQuery, setEditingResourceQuery] = useState("");
  const [aiApuResult, setAiApuResult] = useState<AiApuPreviewResult | null>(null);
  const [aiApuError, setAiApuError] = useState("");
  const [aiApuLoading, setAiApuLoading] = useState(false);
  const [resourceHighlightedIndex, setResourceHighlightedIndex] = useState(0);
  const [resourceMenu, setResourceMenu] = useState<ResourceMenuState | null>(null);
  const effectiveDensityMode = isExcelMode ? "compact" : densityMode;
  const deferredAddResourceQuery = useDeferredValue(addResourceQuery);
  const deferredEditingResourceQuery = useDeferredValue(editingResourceQuery);
  const indexedResourcesCatalog = useMemo(
    () =>
      resourcesCatalog.map((resource) => ({
        resource,
        searchText: buildResourceSearchText(resource),
      })),
    [resourcesCatalog],
  );
  const resourcesById = useMemo(() => new Map(resourcesCatalog.map((resource) => [resource.id, resource])), [resourcesCatalog]);
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
  const resourceSuggestions = useMemo(() => {
    if (!editingResourceRowId) return [];

    const query = normalizeResourceSearchText(deferredEditingResourceQuery);
    return indexedResourcesCatalog
      .filter(({ searchText }) => {
        if (!query) return true;
        return searchText.includes(query);
      })
      .map(({ resource }) => resource)
      .slice(0, 8);
  }, [deferredEditingResourceQuery, editingResourceRowId, indexedResourcesCatalog]);
  const excelCssVariables = useMemo<CSSProperties>(
    () => getExcelViewCssVariables(excelShowFieldBorders, excelRowHeight),
    [excelRowHeight, excelShowFieldBorders],
  );

  useEffect(() => {
    if (open && item?.apu) {
      previousActiveElementRef.current = restoreFocusElement ?? previousActiveElementRef.current;
      wasOpenRef.current = true;
      return;
    }

    if (!wasOpenRef.current) {
      return;
    }

    if (previousActiveElementRef.current?.isConnected) {
      previousActiveElementRef.current.focus();
    }

    previousActiveElementRef.current = null;
    wasOpenRef.current = false;
  }, [item, open, restoreFocusElement]);

  useEffect(() => {
    return () => {
      if (addResourceBlurTimeoutRef.current !== null) {
        window.clearTimeout(addResourceBlurTimeoutRef.current);
      }
      if (previousActiveElementRef.current?.isConnected) {
        previousActiveElementRef.current.focus();
      }
      previousActiveElementRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!editingResourceRowId) return;

    const updatePosition = () => {
      const element = resourceSearchRefs.current.get(editingResourceRowId);
      if (!element) return;

      const rect = element.getBoundingClientRect();
      setResourceMenu({
        rowId: editingResourceRowId,
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
  }, [editingResourceRowId]);

  useEffect(() => {
    if (!addResourceMenuOpen) return;

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
  }, [addResourceMenuOpen]);

  const currentItem = item;
  const currentApu = item?.apu ?? null;
  const apuSummary = useMemo(() => {
    if (!currentApu) {
      return {
        rows: [],
        categoryTotals: APU_PRESENTATION_CATEGORY_ORDER.map((category) => ({ category, subtotal: 0 })),
        totalUnitCost: 0,
      };
    }

    return calculateApuSummary(currentApu.resources, currentApu.performance);
  }, [currentApu]);

  if (!open || !currentItem || !currentApu) return null;
  const currentItemRecord = currentItem;
  const currentApuRecord = currentApu;
  const { rows: calculatedResources, totalUnitCost: calculatedUnitCost, categoryTotals } = apuSummary;
  const performanceLabel = `${currentItemRecord.unit}/Día`;

  function addResource(resourceId: string) {
    const selected = resourcesById.get(resourceId);
    if (!selected) return;

    if (addResourceBlurTimeoutRef.current !== null) {
      window.clearTimeout(addResourceBlurTimeoutRef.current);
      addResourceBlurTimeoutRef.current = null;
    }

    setAddResourceQuery("");
    setAddResourceHighlightedIndex(0);
    setAddResourceMenuOpen(false);
    setAddResourceMenuPosition(null);
    onUpdate({
      ...currentItemRecord,
      apu: {
        ...currentApuRecord,
        resources: [
          ...currentApuRecord.resources,
          {
            id: crypto.randomUUID(),
            apuId: currentApuRecord.id,
            resourceId: selected.id,
            resourceType: selected.category,
            crew: null,
            quantity: 1,
            unitPrice: selected.unitPrice,
            subtotal: selected.unitPrice,
            resource: selected,
          },
        ],
      },
    });
  }

  function moveResourceToTarget(targetId: string) {
    if (!draggedResourceId || draggedResourceId === targetId) return;

    onUpdate({
      ...currentItemRecord,
      apu: {
        ...currentApuRecord,
        resources: moveEntityToTarget(currentApuRecord.resources, draggedResourceId, targetId),
      },
    });

    setDraggedResourceId(null);
  }

  function openAddResourceSearch() {
    if (addResourceBlurTimeoutRef.current !== null) {
      window.clearTimeout(addResourceBlurTimeoutRef.current);
      addResourceBlurTimeoutRef.current = null;
    }
    setAddResourceMenuOpen(true);
    setAddResourceHighlightedIndex(0);
  }

  function openResourceSearch(resource: (typeof currentApuRecord.resources)[number]) {
    setEditingResourceRowId(resource.id);
    setEditingResourceQuery(resource.resource ? `${resource.resource.code} - ${resource.resource.description}` : "");
    setResourceHighlightedIndex(0);
  }

  function applyResourceSelection(
    resource: (typeof currentApuRecord.resources)[number],
    index: number,
    selected: ResourceRecord,
  ) {
    const resources = [...currentApuRecord.resources];
    resources[index] = {
      ...resource,
      resourceId: selected.id,
      resourceType: selected.category,
      unitPrice: selected.unitPrice,
      resource: selected,
    };
    setEditingResourceRowId(null);
    setEditingResourceQuery("");
    setResourceMenu(null);
    setResourceHighlightedIndex(0);
    onUpdate({
      ...currentItemRecord,
      apu: {
        ...currentApuRecord,
        resources,
      },
    });
  }

  async function generateAiApuSuggestion() {
    if (aiApuLoading) return;

    setAiApuLoading(true);
    setAiApuError("");

    try {
      const response = await fetch("/api/ai/apu/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: currentItemRecord.description,
          unit: currentItemRecord.unit,
          context: {
            module: "Editor APU de sub presupuesto",
            selectedItem: currentItemRecord.description,
            unit: currentItemRecord.unit,
            currentCost: currentItemRecord.unitPrice,
            activeTable: "APU de presupuesto",
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
    if (!aiApuResult) return;

    if (isAiApuCatalogGenerationResult(aiApuResult)) {
      onUpdate({
        ...currentItemRecord,
        apu: {
          ...currentApuRecord,
          resources: [
            ...currentApuRecord.resources,
            ...buildApuResourcesFromCatalogProposal({
              proposal: aiApuResult.proposal,
              apuId: currentApuRecord.id,
              resources: resourcesCatalog,
            }),
          ],
        },
      });
      setAiApuResult(null);
      return;
    }

    if (!isAiApuStructuredData(aiApuResult.structuredData)) return;

    const nextResources = [
      ...currentApuRecord.resources,
      ...buildApuResourcesFromAiSuggestion({
        suggestion: aiApuResult.structuredData,
        apuId: currentApuRecord.id,
      }),
    ];
    const nextPerformance = parseAiPerformance(aiApuResult.structuredData.performance, currentApuRecord.performance);

    onUpdate({
      ...currentItemRecord,
      apu: {
        ...currentApuRecord,
        performance: nextPerformance,
        resources: nextResources,
      },
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

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" />
        <Dialog.Content
          asChild
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
        >
          <div
            className={cn(
              "fixed inset-y-0 right-0 z-50 ml-auto h-full w-full overflow-y-auto bg-white shadow-2xl outline-none",
              isExcelMode ? "max-w-6xl p-5 shadow-none" : "max-w-6xl p-5",
            )}
            data-excel-field-border-scope="apu-editor"
            data-view-mode={isExcelMode ? "excel" : "modern"}
            data-density-mode={effectiveDensityMode}
            data-testid="apu-editor-sheet-panel"
            style={excelCssVariables}
          >
            <div className={cn("flex items-start justify-between gap-4", isExcelMode ? "mb-3" : "mb-5")}>
              <div>
                <p className={cn("text-slate-500", isExcelMode ? "text-xs uppercase tracking-wide" : "text-sm")}>Editor APU</p>
                <Dialog.Title asChild>
                  <h3 className={cn("font-semibold text-slate-900", isExcelMode ? "text-xl" : "text-2xl")}>{currentItemRecord.description}</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p className={cn("mt-1 text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Unidad: {currentItemRecord.unit}</p>
                </Dialog.Description>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Link href={buildAiHref("chat", currentItemRecord.description, currentItemRecord.unit, currentItemRecord.unitPrice, "Explica tecnicamente esta partida y valida su rendimiento.")}>
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
                  disabled={aiApuLoading}
                >
                  <Sparkles className="h-4 w-4" />
                  {aiApuLoading ? "Generando..." : "Generar con IA"}
                </Button>
                <Link href={buildAiHref("apu", currentItemRecord.description, currentItemRecord.unit, currentItemRecord.unitPrice)}>
                  <Button variant="ghost" className={cn(isExcelMode && "h-8 px-3 text-xs")}>
                    Abrir en Copiloto
                  </Button>
                </Link>
                <Dialog.Close asChild>
                  <Button ref={closeButtonRef} variant="outline" className={cn(isExcelMode && "h-8 px-3 text-xs")}>
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
                copilotHref={buildAiHref("apu", currentItemRecord.description, currentItemRecord.unit, currentItemRecord.unitPrice)}
              />
            ) : null}

            <div className={cn("grid", isExcelMode ? "mb-3 gap-2" : "mb-5 gap-4")}>
              <div className={cn("grid md:grid-cols-2", isExcelMode ? "gap-2" : "gap-4")}>
                <div className={cn("border border-slate-200", isExcelMode ? "rounded-md border-slate-300 p-2" : "rounded-2xl p-4")}>
                  <p className={cn("text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Rendimiento ({performanceLabel})</p>
                  <BufferedInput
                    type="number"
                    step="0.01"
                    value={currentApuRecord.performance}
                    data-testid="apu-performance-input"
                    className={getInputDensityClass(effectiveDensityMode, isExcelMode)}
                    onCommit={(value) =>
                      onUpdate({
                        ...currentItemRecord,
                        apu: {
                          ...currentApuRecord,
                          performance: Number(value),
                        },
                      })
                    }
                  />
                </div>
                <div className={cn("border border-slate-200", isExcelMode ? "rounded-md border-slate-300 p-2" : "rounded-2xl p-4")}>
                  <p className={cn("text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Costo unitario</p>
                  <p className={cn("mt-2 font-semibold text-slate-900", isExcelMode ? "text-xl" : "text-2xl")}>
                    {formatCurrency(calculatedUnitCost, "PEN", currencyDecimals)}
                  </p>
                </div>
              </div>
              <div className={cn("grid sm:grid-cols-2 xl:grid-cols-5", isExcelMode ? "gap-2" : "gap-3")}>
                {categoryTotals.map((categoryTotal) => {
                  const presentation = getApuCategoryPresentation(categoryTotal.category);

                  return (
                    <div
                      key={categoryTotal.category}
                      data-testid={`apu-summary-card-${categoryTotal.category}`}
                      className={cn("border", isExcelMode ? "rounded-md p-2" : "rounded-2xl p-4", presentation.summaryClassName)}
                    >
                      <p className={cn("font-medium", isExcelMode ? "text-[11px] uppercase tracking-wide" : "text-sm")}>{presentation.label}</p>
                      <p className={cn("mt-1 font-semibold tabular-nums", isExcelMode ? "text-base" : "text-lg")}>
                        {formatCurrency(categoryTotal.subtotal, "PEN", currencyDecimals)}
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
            data-testid="apu-add-resource-search"
            placeholder="Agregar insumo desde el catálogo"
          />
          <Button
            variant="outline"
            className={cn(effectiveDensityMode === "compact" ? "h-8 text-xs" : "h-9 text-sm")}
            onClick={() =>
              onUpdate({
                ...currentItemRecord,
                apu: {
                  ...currentApuRecord,
                  resources: [
                    ...currentApuRecord.resources,
                    {
                      id: crypto.randomUUID(),
                      apuId: currentApuRecord.id,
                      resourceId: "",
                      resourceType: "MATERIAL",
                      crew: null,
                      quantity: 1,
                      unitPrice: 0,
                      subtotal: 0,
                    },
                  ],
                },
              })
            }
          >
            Agregar fila manual
          </Button>
        </div>
        {addResourceMenuOpen && addResourceSuggestions.length > 0 && addResourceMenuPosition ? (
          <div
            className="fixed z-[90] overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl"
            style={{
              top: addResourceMenuPosition.top,
              left: addResourceMenuPosition.left,
              width: addResourceMenuPosition.width,
            }}
          >
            <div className="max-h-64 overflow-auto py-1">
              {addResourceSuggestions.map((resource, index) => (
                <button
                  key={resource.id}
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-3 py-2 text-left",
                    index === addResourceHighlightedIndex ? "bg-sky-100" : "hover:bg-sky-50",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addResource(resource.id);
                  }}
                  onMouseEnter={() => setAddResourceHighlightedIndex(index)}
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
              {currentApuRecord.resources.map((resource, index) => {
                const calculatedResource = calculatedResources[index] ?? resource;
                const presentationCategory = getApuPresentationCategory(calculatedResource);
                const categoryPresentation = getApuCategoryPresentation(presentationCategory);
                const isCrewDriven = isCrewDrivenApuRow(calculatedResource);
                const isPercentageBased = isPercentageBasedApuRow(calculatedResource);
                const isLabor = isLaborApuRow(calculatedResource);
                const isEditingResource = editingResourceRowId === resource.id;
                const readonlyInputClass = "border-transparent bg-transparent px-0 shadow-none";
                const resourceLabel = resource.resource
                  ? `${resource.resource.code} - ${resource.resource.description}`
                  : "Selecciona un insumo";

                return (
                <TR
                  key={resource.id}
                  draggable
                  onDragStart={() => setDraggedResourceId(resource.id)}
                  onDragOver={(event) => {
                    if (draggedResourceId) event.preventDefault();
                  }}
                  onDragEnd={() => setDraggedResourceId(null)}
                  onDrop={() => moveResourceToTarget(resource.id)}
                  className={cn(
                    categoryPresentation.rowClassName,
                    draggedResourceId === resource.id ? "scale-[0.995] opacity-60 ring-2 ring-sky-300" : "",
                  )}
                >
                  <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "pr-0")}>
                    <span
                      data-testid={`apu-row-grip-${resource.id}`}
                      data-apu-category={presentationCategory}
                      className={cn("inline-flex cursor-grab", categoryPresentation.gripClassName)}
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                  </TD>
                  <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                    {isEditingResource ? (
                      <div
                        className="relative"
                        onMouseDown={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <Input
                          autoFocus
                          data-testid={`apu-resource-search-${resource.id}`}
                          value={editingResourceQuery}
                          className={getInputDensityClass(effectiveDensityMode, isExcelMode)}
                          placeholder="Buscar insumo por código o descripción"
                          ref={(element) => {
                            if (element) {
                              resourceSearchRefs.current.set(resource.id, element);
                              return;
                            }

                            resourceSearchRefs.current.delete(resource.id);
                          }}
                          onChange={(event) => setEditingResourceQuery(event.target.value)}
                          onKeyDown={(event) => {
                            if (resourceSuggestions.length > 0) {
                              if (event.key === "ArrowDown") {
                                event.preventDefault();
                                setResourceHighlightedIndex((current) => Math.min(current + 1, resourceSuggestions.length - 1));
                                return;
                              }

                              if (event.key === "ArrowUp") {
                                event.preventDefault();
                                setResourceHighlightedIndex((current) => Math.max(current - 1, 0));
                                return;
                              }

                              if (event.key === "Enter") {
                                event.preventDefault();
                                const selected = resourceSuggestions[resourceHighlightedIndex];
                                if (selected) {
                                  applyResourceSelection(resource, index, selected);
                                }
                                return;
                              }
                            }

                            if (event.key === "Escape") {
                              setEditingResourceRowId(null);
                              setEditingResourceQuery("");
                              setResourceMenu(null);
                              setResourceHighlightedIndex(0);
                            }
                          }}
                          onBlur={() => {
                            window.setTimeout(() => {
                              setEditingResourceRowId((current) => (current === resource.id ? null : current));
                              setEditingResourceQuery("");
                              setResourceMenu((current) => (current?.rowId === resource.id ? null : current));
                              setResourceHighlightedIndex(0);
                            }, 120);
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        draggable={false}
                        data-excel-field-trigger="true"
                        data-testid={`apu-resource-picker-${resource.id}`}
                        className={cn(
                          "flex w-full items-center rounded-sm border border-slate-300 bg-white px-2 text-left text-xs text-slate-900 shadow-none transition hover:border-sky-400 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/20",
                          effectiveDensityMode === "compact" ? "h-8" : "h-9 text-sm",
                          !resource.resourceId && "text-slate-500",
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openResourceSearch(resource);
                        }}
                      >
                        <span className="truncate">{resourceLabel}</span>
                      </button>
                    )}
                  </TD>
                  <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "text-center")}>{calculatedResource.resource?.unit ?? "-"}</TD>
                  <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                    {isLabor ? (
                      <BufferedInput
                        type="number"
                        step="0.0001"
                        value={resource.crew ?? ""}
                        className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), "text-right tabular-nums")}
                        onCommit={(value) => {
                          const resources = [...currentApuRecord.resources];
                          resources[index] = {
                            ...resource,
                            crew: value === "" ? null : Number(value),
                          };
                          onUpdate({
                            ...currentItemRecord,
                            apu: {
                              ...currentApuRecord,
                              resources,
                            },
                          });
                        }}
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
                    <BufferedInput
                      type="number"
                      step="0.01"
                      value={calculatedResource.quantity}
                      readOnly={isCrewDriven}
                      className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), "text-right tabular-nums", isCrewDriven ? readonlyInputClass : undefined)}
                      onCommit={(value) => {
                        const resources = [...currentApuRecord.resources];
                        resources[index] = {
                          ...resource,
                          quantity: Number(value),
                        };
                        onUpdate({
                          ...currentItemRecord,
                          apu: {
                            ...currentApuRecord,
                            resources,
                          },
                        });
                      }}
                    />
                  </TD>
                  <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                    <BufferedInput
                      type="number"
                      step="0.01"
                      value={calculatedResource.unitPrice}
                      readOnly={isPercentageBased}
                      className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), "text-right tabular-nums", isPercentageBased ? readonlyInputClass : undefined)}
                      onCommit={(value) => {
                        const resources = [...currentApuRecord.resources];
                        resources[index] = {
                          ...resource,
                          unitPrice: Number(value),
                        };
                        onUpdate({
                          ...currentItemRecord,
                          apu: {
                            ...currentApuRecord,
                            resources,
                          },
                        });
                      }}
                    />
                  </TD>
                  <TD
                    className={cn(
                      getCellPadding(effectiveDensityMode, isExcelMode),
                      "text-right text-xs font-semibold tabular-nums text-slate-900",
                    )}
                  >
                    {formatCurrency(calculatedResource.subtotal, "PEN", currencyDecimals)}
                  </TD>
                  <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={cn(effectiveDensityMode === "compact" ? "h-8 px-2 text-xs" : "h-9 px-2 text-sm")}
                      onClick={() =>
                        onUpdate({
                          ...currentItemRecord,
                          apu: {
                            ...currentApuRecord,
                            resources: currentApuRecord.resources.filter((_, currentIndex) => currentIndex !== index),
                          },
                        })
                      }
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
        {editingResourceRowId && resourceSuggestions.length > 0 && resourceMenu?.rowId === editingResourceRowId ? (
          <div
            className="fixed z-[90] overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl"
            style={{
              top: resourceMenu.top,
              left: resourceMenu.left,
              width: resourceMenu.width,
            }}
          >
            <div className="max-h-64 overflow-auto py-1">
              {resourceSuggestions.map((candidate, suggestionIndex) => (
                <button
                  key={candidate.id}
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-3 py-2 text-left",
                    suggestionIndex === resourceHighlightedIndex ? "bg-sky-100" : "hover:bg-sky-50",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    const resource = currentApuRecord.resources.find((candidateResource) => candidateResource.id === editingResourceRowId);
                    const resourceIndex = currentApuRecord.resources.findIndex((candidateResource) => candidateResource.id === editingResourceRowId);
                    if (!resource || resourceIndex === -1) return;
                    applyResourceSelection(resource, resourceIndex, candidate);
                  }}
                  onMouseEnter={() => setResourceHighlightedIndex(suggestionIndex)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{candidate.code} - {candidate.description}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{candidate.unit}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
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

function moveEntityToTarget<T extends { id: string }>(items: T[], sourceId: string, targetId: string) {
  const sorted = [...items];
  const sourceIndex = sorted.findIndex((item) => item.id === sourceId);
  const targetIndex = sorted.findIndex((item) => item.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return items;

  const [source] = sorted.splice(sourceIndex, 1);
  sorted.splice(targetIndex, 0, source);

  return sorted;
}

function normalizeResourceSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

  return (
    <section
      className={cn(
        "mb-4 border border-sky-200 bg-sky-50/70 shadow-[0_16px_30px_-28px_rgba(2,132,199,0.35)]",
        isExcelMode ? "rounded-md p-3 text-xs" : "rounded-2xl p-4 text-sm",
      )}
      aria-label="Vista previa IA"
    >
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
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{result.warnings.join(" ")}</div>
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

function buildApuResourcesFromAiSuggestion({ suggestion, apuId }: { suggestion: AiApuStructuredData; apuId: string }): ApuResourceRecord[] {
  const buckets: Array<{ resourceType: "MATERIAL" | "LABOR" | "EQUIPMENT"; items: AiApuStructuredData["materials"] }> = [
    { resourceType: "MATERIAL", items: suggestion.materials },
    { resourceType: "LABOR", items: suggestion.labor },
    { resourceType: "EQUIPMENT", items: suggestion.equipment },
  ];

  return buckets.flatMap(({ resourceType, items }) =>
    items.map((item) => {
      const resource: ResourceRecord = {
        id: `ai-${crypto.randomUUID()}`,
        code: "IA",
        description: item.description.trim() || "Recurso sugerido sin descripcion",
        category: resourceType,
        unit: item.unit.trim(),
        unitPrice: 0,
        currency: "PEN",
        source: "IA local",
      };

      return {
        id: `ai-apu-${crypto.randomUUID()}`,
        apuId,
        resourceId: resource.id,
        resourceType,
        crew: null,
        quantity: parseAiDecimal(item.quantity) ?? 0,
        unitPrice: 0,
        subtotal: 0,
        resource,
      };
    }),
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

function buildAiHref(action: "chat" | "apu" | "autocomplete" | "review", description: string, unit?: string, currentCost?: number, message?: string) {
  const params = new URLSearchParams({
    action,
    selectedItem: description,
    description,
    module: "Editor APU de sub presupuesto",
    activeTable: "APU de presupuesto",
  });

  if (unit) params.set("unit", unit);
  if (unit) params.set("apuUnit", unit);
  if (typeof currentCost === "number") params.set("currentCost", String(currentCost));
  if (message) params.set("message", message);

  return `/ai?${params.toString()}`;
}

function buildResourceSearchText(resource: ResourceRecord) {
  return normalizeResourceSearchText(
    `${resource.code} ${resource.description} ${resource.unit} ${resource.code} - ${resource.description}`,
  );
}
