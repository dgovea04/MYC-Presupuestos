"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { Fragment, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { BotMessageSquare, ExternalLink, GitCompareArrows, GripVertical, PenLine, Search, Sparkles, Trash2 } from "lucide-react";
import { useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { BufferedInput } from "@/components/ui/buffered-input";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { getApuCategoryPresentation } from "@/lib/apu/presentation";
import { isSubpartidaResourceType } from "@/lib/apu/subpartidas";
import { buildApuResourcesFromCatalogProposal, parseAiDecimal, parseAiPerformance, selectCatalogProposalBasePartida } from "@/lib/ai/apu-suggestion";
import type { AiApuCatalogGenerationResult, AiApuStructuredData, AiEndpointResult } from "@/lib/ai/types";
import { getExcelViewCssVariables } from "@/lib/budget/excel-view-css";
import {
  APU_PRESENTATION_CATEGORY_ORDER,
  calculateApuSummary,
  getApuPresentationCategory,
  isCrewDrivenApuRow,
  isEquipmentApuRow,
  isLaborApuRow,
  isPercentageBasedApuRow,
} from "@/lib/calculations/apu";
import type { BudgetItemRecord } from "@/types/budget";
import type { ApuResourceRecord } from "@/types/apu";
import type { CatalogPartidaRecord, PartidaApuRowRecord } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";
import { PreviewDebugPanel } from "@/components/ai/debug-panel";
import { PartidaSimilarityGeneratorPageContent } from "@/components/partidas/partida-similarity-generator-page-content";
import { applyCatalogPartidaToDraftItem } from "@/lib/budgets/catalog-partida-application";
import { cn, formatCurrency } from "@/lib/utils";
import { useEditSession } from "@/hooks/use-edit-session";
import { useBudgetPresenceHeartbeat } from "@/hooks/use-budget-presence-heartbeat";
import type { PartidaGenerationSaveResult } from "@/types/partida-generation";

export type ApuEditorPresentation = "sheet" | "docked";

type ApuEditorSheetProps = {
  item: BudgetItemRecord | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (item: BudgetItemRecord) => void;
  resourcesCatalog: ResourceRecord[];
  catalogPartidas: CatalogPartidaRecord[];
  canUseKhipu?: boolean;
  canUsePartidaGenerator?: boolean;
  canUseCollaboration?: boolean;
  restoreFocusElement?: HTMLElement | null;
  densityMode: "compact" | "comfortable";
  budgetId?: string;
  presentation?: ApuEditorPresentation;
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
  catalogPartidas,
  canUseKhipu = true,
  canUsePartidaGenerator = true,
  canUseCollaboration = true,
  restoreFocusElement,
  densityMode,
  budgetId,
  presentation = "sheet",
}: ApuEditorSheetProps) {
  const { isExcelMode } = useBudgetViewMode();
  const isDocked = presentation === "docked";
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
  const [addSubpartidaOpen, setAddSubpartidaOpen] = useState(false);
  const [partidaGeneratorOpen, setPartidaGeneratorOpen] = useState(false);
  const [subpartidaApuPreview, setSubpartidaApuPreview] = useState<{
    resourceIndex: number;
    title: string;
    performance: number;
    unit: string;
  } | null>(null);
  const effectiveDensityMode = isExcelMode ? "compact" : densityMode;
  const deferredAddResourceQuery = useDeferredValue(addResourceQuery);
  const deferredEditingResourceQuery = useDeferredValue(editingResourceQuery);

  // Collaboration: edit session and presence when APU sheet is open
  const currentItemId = item?.id ?? null;
  const {
    activeSession,
    startEditSession,
    finishCurrentSession,
  } = useEditSession({ budgetId: budgetId ?? "", enabled: canUseCollaboration });

  useBudgetPresenceHeartbeat({
    budgetId: budgetId ?? "",
    route: `APU: ${item?.description ?? "APU"}`,
    module: "apu-editor",
    enabled: canUseCollaboration,
  });

  useEffect(() => {
    if (!canUseCollaboration || !budgetId || !open || !currentItemId) return;

    startEditSession("APU", currentItemId, "apu-editor");

    return () => {
      finishCurrentSession();
    };
  }, [canUseCollaboration, open, currentItemId, budgetId, startEditSession, finishCurrentSession]);
  const indexedResourcesCatalog = useMemo(
    () =>
      resourcesCatalog.map((resource) => ({
        resource,
        searchText: buildResourceSearchText(resource),
      })),
    [resourcesCatalog],
  );
  const resourcesById = useMemo(() => new Map(resourcesCatalog.map((resource) => [resource.id, resource])), [resourcesCatalog]);
  const resourcesByDescriptionUnit = useMemo(
    () =>
      new Map(
        resourcesCatalog.map((resource) => [
          `${normalizeResourceSearchText(resource.description)}|${normalizeResourceSearchText(resource.unit)}`,
          resource,
        ]),
      ),
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
    if (isDocked) {
      previousActiveElementRef.current = null;
      wasOpenRef.current = false;
      return;
    }

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
  }, [isDocked, item, open, restoreFocusElement]);

  useEffect(() => {
    if (!isDocked || !item?.id) return;

    const resetTimeout = window.setTimeout(() => {
      setAddResourceQuery("");
      setAddResourceHighlightedIndex(0);
      setAddResourceMenuOpen(false);
      setAddResourceMenuPosition(null);
      setDraggedResourceId(null);
      setEditingResourceRowId(null);
      setEditingResourceQuery("");
      setResourceHighlightedIndex(0);
      setResourceMenu(null);
      setAiApuResult(null);
      setAiApuError("");
      setAiApuLoading(false);
      setAddSubpartidaOpen(false);
      setPartidaGeneratorOpen(false);
      setSubpartidaApuPreview(null);
    }, 0);

    return () => window.clearTimeout(resetTimeout);
  }, [isDocked, item?.id]);

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

  function addCatalogSubpartida(partida: CatalogPartidaRecord) {
    const nestedRows = cloneCatalogPartidaApuRows(partida.apuRows, partida.id);
    const nestedSummary = calculateApuSummary(nestedRows, partida.performance);
    const unitPrice = nestedRows.length > 0 ? nestedSummary.totalUnitCost : partida.unitPrice;

    setAddSubpartidaOpen(false);
    onUpdate({
      ...currentItemRecord,
      apu: {
        ...currentApuRecord,
        resources: [
          ...currentApuRecord.resources,
          {
            id: crypto.randomUUID(),
            apuId: currentApuRecord.id,
            resourceId: null,
            catalogPartidaId: partida.id,
            resourceType: "SUBPARTIDA",
            crew: null,
            quantity: 1,
            unitPrice,
            subtotal: unitPrice,
            catalogPartida: partida,
            nestedApuRows: nestedRows,
          },
        ],
      },
    });
  }

  function patchNestedSubpartidaRow(
    resourceIndex: number,
    nestedIndex: number,
    changes: Partial<PartidaApuRowRecord>,
  ) {
    const resource = currentApuRecord.resources[resourceIndex];
    if (!resource || !isSubpartidaResourceType(resource.resourceType)) return;

    const sourceRows = resource.nestedApuRows ?? resource.catalogPartida?.apuRows ?? [];
    const nextRowsInput = sourceRows.map((row, rowIndex) => (rowIndex === nestedIndex ? { ...row, ...changes } : row));
    const nestedPerformance = resource.catalogPartida?.performance ?? 1;
    const nestedSummary = calculateApuSummary(nextRowsInput, nestedPerformance);
    const resources = [...currentApuRecord.resources];
    resources[resourceIndex] = {
      ...resource,
      nestedApuRows: nestedSummary.rows,
      unitPrice: nestedSummary.totalUnitCost,
    };

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

  function applyGeneratedPartida(result: PartidaGenerationSaveResult) {
    const hasExistingRows = currentApuRecord.resources.length > 0;
    if (hasExistingRows && !window.confirm("Esta partida ya tiene un APU. ¿Quieres reemplazarlo con la partida generada?")) {
      setPartidaGeneratorOpen(false);
      return;
    }

    onUpdate(
      applyCatalogPartidaToDraftItem({
        item: currentItemRecord,
        partida: result.catalogPartida,
        catalogPartidas: [...catalogPartidas, result.catalogPartida],
        resourcesById,
        resourcesByDescriptionUnit,
      }),
    );
    setAiApuResult(null);
    setAiApuError("");
    setPartidaGeneratorOpen(false);
  }

  return (
    <Dialog.Root open={open} modal={!isDocked} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <ApuPresentationBoundary docked={isDocked}>
        {!isDocked ? <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm" /> : null}
        <Dialog.Content
          asChild
          onOpenAutoFocus={(event) => {
            if (isDocked) {
              event.preventDefault();
              return;
            }

            event.preventDefault();
            closeButtonRef.current?.focus();
          }}
        >
          <div
            className={cn(
              "theme-surface-card outline-none",
              isDocked
                ? "relative flex h-full min-h-0 w-full flex-col overflow-x-hidden overflow-y-auto rounded-md border border-[var(--app-border-strong)] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.18)]"
                : "fixed inset-y-0 right-0 z-50 ml-auto h-full w-full overflow-y-auto shadow-2xl",
              !isDocked && (isExcelMode ? "max-w-6xl p-5 shadow-none" : "max-w-6xl p-5"),
              isDocked && "p-3 sm:p-4 xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]",
            )}
            data-apu-presentation={presentation}
            data-excel-field-border-scope="apu-editor"
            data-view-mode={isExcelMode ? "excel" : "modern"}
            data-density-mode={effectiveDensityMode}
            data-testid="apu-editor-sheet-panel"
            style={excelCssVariables}
          >
            <div className={cn("flex items-start justify-between gap-4", isExcelMode ? "mb-3" : "mb-5", isDocked && "gap-2")}>
              <div className={cn("min-w-0", isDocked && "max-w-[42%]")}>
                <p className={cn("theme-muted-text", isExcelMode ? "text-xs uppercase tracking-wide" : "text-sm")}>Editor APU</p>
                <Dialog.Title asChild>
                  <h3
                    data-testid="apu-header-title"
                    className={cn("theme-strong-text font-semibold", isDocked ? "text-sm leading-tight" : isExcelMode ? "text-xl" : "text-2xl")}
                  >
                    {currentItemRecord.description}
                  </h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p className={cn("theme-muted-text mt-1", isDocked ? "text-[10px]" : isExcelMode ? "text-xs" : "text-sm")}>Unidad: {currentItemRecord.unit}</p>
                </Dialog.Description>
                {activeSession ? (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-sky-600">
                    <PenLine className="h-3 w-3" />
                    Modo edicion colaborativa activo
                  </p>
                ) : null}
              </div>
              <div
                data-testid="apu-header-actions"
                className={cn("flex flex-wrap justify-end gap-2", isDocked && "max-w-[58%] gap-1")}
              >
                {canUseKhipu ? (
                  <Link href={buildAiHref("chat", currentItemRecord.description, currentItemRecord.unit, currentItemRecord.unitPrice, "Explica tecnicamente esta partida y valida su rendimiento.")}>
                    {isDocked ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 w-7 rounded-md p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover-strong)] hover:text-[var(--app-text-strong)]"
                        aria-label="Explicar partida"
                        title="Explicar partida"
                      >
                        <BotMessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button variant="ghost" className="gap-2">
                        <BotMessageSquare className="h-4 w-4" />
                        Explicar partida
                      </Button>
                    )}
                  </Link>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled
                    aria-disabled="true"
                    aria-label="Explicar partida — Disponible en Pro"
                    title="Explicar partida — Disponible en Pro"
                    className={cn(
                      "cursor-not-allowed border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] opacity-90 hover:bg-[var(--app-surface-muted)]",
                      isDocked ? "h-7 w-7 rounded-md p-0" : "gap-2 whitespace-nowrap",
                    )}
                  >
                    <BotMessageSquare className={cn("h-4 w-4", isDocked && "h-3.5 w-3.5")} aria-hidden="true" />
                    {!isDocked ? <><span>Explicar partida</span><ProLockBadge /></> : null}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  className={cn(
                    "gap-2",
                    !canUseKhipu && "cursor-not-allowed whitespace-nowrap border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] opacity-90 hover:bg-[var(--app-surface-muted)]",
                    isDocked ? "h-7 w-7 rounded-md p-0" : isExcelMode && "h-8 px-3 text-xs",
                  )}
                  onClick={() => {
                    if (canUseKhipu) void generateAiApuSuggestion();
                  }}
                  disabled={!canUseKhipu || aiApuLoading}
                  aria-disabled={!canUseKhipu ? "true" : undefined}
                  aria-label={canUseKhipu ? "Generar APU con IA" : "Generar APU con IA — Disponible en Pro"}
                  title={canUseKhipu ? "Generar APU con IA" : "Generar APU con IA — Disponible en Pro"}
                >
                  <Sparkles className={cn("h-4 w-4", isDocked && "h-3.5 w-3.5")} aria-hidden="true" />
                  {!isDocked ? <>{aiApuLoading ? "Generando..." : "Generar con IA"}{!canUseKhipu ? <ProLockBadge /> : null}</> : null}
                </Button>
                {canUsePartidaGenerator ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPartidaGeneratorOpen(true)}
                    aria-label="Abrir generador de partidas"
                    title="Abrir generador de partidas"
                    className={cn("gap-2", isDocked ? "h-7 w-7 rounded-md p-0" : "", isExcelMode && !isDocked && "h-8 px-3 text-xs")}
                  >
                    <GitCompareArrows className={cn("h-4 w-4", isDocked && "h-3.5 w-3.5")} aria-hidden="true" />
                    {!isDocked ? "Generador de partidas" : null}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled
                    aria-disabled="true"
                    aria-label="Generador de partidas — Disponible en Pro"
                    title="Generador de partidas — Disponible en Pro"
                    className={cn(
                      "cursor-not-allowed border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] opacity-90 hover:bg-[var(--app-surface-muted)]",
                      isDocked ? "h-7 w-7 rounded-md p-0" : "gap-2 whitespace-nowrap",
                    )}
                  >
                    <GitCompareArrows className={cn("h-4 w-4", isDocked && "h-3.5 w-3.5")} aria-hidden="true" />
                    {!isDocked ? <><span>Generador</span><ProLockBadge /></> : null}
                  </Button>
                )}
                {canUseKhipu ? (
                  <Link href={buildAiHref("apu", currentItemRecord.description, currentItemRecord.unit, currentItemRecord.unitPrice)}>
                    {isDocked ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-7 w-7 rounded-md p-0 text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover-strong)] hover:text-[var(--app-text-strong)]"
                        aria-label="Abrir en Khipu"
                        title="Abrir en Khipu"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    ) : (
                      <Button variant="ghost" className={cn(isExcelMode && "h-8 px-3 text-xs")}>
                        Abrir en Khipu
                      </Button>
                    )}
                  </Link>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled
                    aria-disabled="true"
                    aria-label="Abrir en Khipu — Disponible en Pro"
                    title="Abrir en Khipu — Disponible en Pro"
                    className={cn(
                      "cursor-not-allowed border-[var(--app-border)] bg-[var(--app-surface-muted)] text-[var(--app-text-muted)] opacity-90 hover:bg-[var(--app-surface-muted)]",
                      isDocked ? "h-7 w-7 rounded-md p-0" : "gap-2 whitespace-nowrap",
                    )}
                  >
                    {!isDocked ? "Khipu" : <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
                    {!isDocked ? <ProLockBadge /> : null}
                  </Button>
                )}
                {!isDocked ? (
                  <Dialog.Close asChild>
                    <Button ref={closeButtonRef} variant="outline" className={cn(isExcelMode && "h-8 px-3 text-xs")}>
                      Cerrar
                    </Button>
                  </Dialog.Close>
                ) : null}
              </div>
            </div>

            <PartidaGeneratorDialog
              open={partidaGeneratorOpen}
              currentItem={currentItemRecord}
              catalogPartidas={catalogPartidas}
              resourcesCatalog={resourcesCatalog}
              onSaved={applyGeneratedPartida}
              onClose={() => setPartidaGeneratorOpen(false)}
            />

            {aiApuError ? (
              <div className={cn("theme-status-error border", isExcelMode ? "rounded-md px-3 py-2 text-xs" : "rounded-2xl px-4 py-3 text-sm")}>
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
                khipuHref={canUseKhipu ? buildAiHref("apu", currentItemRecord.description, currentItemRecord.unit, currentItemRecord.unitPrice) : undefined}
              />
            ) : null}

            <div className={cn("grid", isExcelMode ? "mb-3 gap-2" : "mb-5 gap-4")}>
              <div className={cn("grid md:grid-cols-2", isExcelMode ? "gap-2" : "gap-4")}>
                <div className={cn("theme-muted-panel border", isExcelMode ? "rounded-md border-[var(--app-border-strong)] p-2" : "rounded-2xl p-4")}>
                  <p className={cn("theme-muted-text", isExcelMode ? "text-xs" : "text-sm")}>Rendimiento ({performanceLabel})</p>
                  <BufferedInput
                    type="number"
                    step="0.01"
                    value={currentApuRecord.performance}
                    data-testid="apu-performance-input"
                    className={getInputDensityClass(effectiveDensityMode, isExcelMode)}
                    style={{ fontSize: "1rem" }}
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
                <div className={cn("theme-muted-panel border", isExcelMode ? "rounded-md border-[var(--app-border-strong)] p-2" : "rounded-2xl p-4")}>
                  <p className={cn("theme-muted-text", isExcelMode ? "text-xs" : "text-sm")}>Costo unitario</p>
                  <p className={cn("theme-strong-text mt-2 font-semibold", isExcelMode ? "text-xl" : "text-2xl")}>
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

        <div className={cn("grid md:grid-cols-[1fr_180px_190px]", isExcelMode ? "mb-3 gap-2" : "mb-5 gap-3")}>
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
          <Button
            type="button"
            variant="outline"
            className={cn("gap-2", effectiveDensityMode === "compact" ? "h-8 text-xs" : "h-9 text-sm")}
            onClick={() => setAddSubpartidaOpen(true)}
          >
            <Search className="h-4 w-4" />
            Agregar subpartida
          </Button>
        </div>
        {addResourceMenuOpen && addResourceSuggestions.length > 0 && addResourceMenuPosition ? (
          <div
            className="theme-surface-card fixed z-[90] overflow-hidden rounded-md border shadow-2xl"
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
                    index === addResourceHighlightedIndex ? "theme-status-info" : "hover:bg-[var(--app-surface-hover)]",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addResource(resource.id);
                  }}
                  onMouseEnter={() => setAddResourceHighlightedIndex(index)}
                >
                  <div className="min-w-0">
                    <p className="theme-strong-text truncate text-sm font-medium">{resource.code} - {resource.description}</p>
                    <p className="theme-muted-text mt-0.5 text-xs">{resource.unit}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          className={cn(
            getTableFrameClassName(isExcelMode),
            isDocked &&
              "[&_th]:min-w-0 [&_th]:px-1 [&_th]:py-1 [&_th]:!text-[0.65rem] [&_td]:min-w-0 [&_td]:px-1 [&_td]:py-1 [&_td]:text-[9px] [&_input]:min-w-0 [&_input]:!px-0 [&_input]:text-[9px] [&_button]:min-w-0 [&_button]:text-[9px]",
          )}
          data-density-mode={effectiveDensityMode}
        >
          <Table className={cn(isDocked ? "table-fixed text-[10px]" : "table-auto")}>
            <colgroup>
              <col className={isDocked ? "w-[5%]" : "w-[36px]"} />
              <col className={isDocked ? "w-[35%]" : "w-[440px]"} />
              <col className={isDocked ? "w-[7%]" : "w-[84px]"} />
              <col className={isDocked ? "w-[8%]" : "w-[76px]"} />
              <col className={isDocked ? "w-[14%]" : "w-[112px]"} />
              <col className={isDocked ? "w-[14%]" : "w-[128px]"} />
              <col className={isDocked ? "w-[14%]" : "w-[104px]"} />
              <col className={isDocked ? "w-[3%]" : "w-[84px]"} />
            </colgroup>
            <THead className={cn(isExcelMode && !isDocked && "[&_th]:theme-muted-panel [&_th]:text-[11px] [&_th]:font-semibold")}>
              <TR className={cn("theme-muted-panel hover:theme-muted-panel", isExcelMode ? "theme-muted-panel hover:theme-muted-panel" : "")}>
                <TH className={getHeaderCellClass(isExcelMode, isDocked ? "text-center" : "w-[36px]", isDocked)} />
                <TH className={getHeaderCellClass(isExcelMode, undefined, isDocked)}>Insumo</TH>
                <TH className={getHeaderCellClass(isExcelMode, "text-center", isDocked)}>Und.</TH>
                <TH className={getHeaderCellClass(isExcelMode, "text-right", isDocked)}>Cuad.</TH>
                <TH className={getHeaderCellClass(isExcelMode, "text-right", isDocked)}>Cant.</TH>
                <TH className={getHeaderCellClass(isExcelMode, "text-right", isDocked)}>{isDocked ? "PU" : "Precio unitario"}</TH>
                <TH className={getHeaderCellClass(isExcelMode, "text-right", isDocked)}>{isDocked ? "Subtotal" : "Subtotal"}</TH>
                <TH className={getHeaderCellClass(isExcelMode, undefined, isDocked)} />
              </TR>
            </THead>
            <TBody>
              {currentApuRecord.resources.map((resource, index) => {
                const calculatedResource = calculatedResources[index] ?? resource;
                const presentationCategory = getApuPresentationCategory(calculatedResource);
                const categoryPresentation = getApuCategoryPresentation(presentationCategory);
                const isCrewDriven = isCrewDrivenApuRow(calculatedResource);
                const isPercentageBased = isPercentageBasedApuRow(calculatedResource);
                const canEditCrew = isLaborApuRow(calculatedResource) || isEquipmentApuRow(calculatedResource);
                const isEditingResource = editingResourceRowId === resource.id;
                const readonlyInputClass = "border-transparent bg-transparent px-0 shadow-none";
                const isSubpartida = isSubpartidaResourceType(resource.resourceType);
                const nestedRows = isSubpartida ? resource.nestedApuRows ?? resource.catalogPartida?.apuRows ?? [] : [];
                const resourceLabel = isSubpartida
                  ? `SUBPARTIDA - ${resource.catalogPartida?.description ?? resource.description ?? "Subpartida"}`
                  : resource.resource
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
                          <div className={cn("flex items-center", isDocked ? "gap-1" : "gap-2")}>

                        <button
                          type="button"
                          draggable={false}
                          data-excel-field-trigger="true"
                          data-testid={`apu-resource-picker-${resource.id}`}
                            className={cn(
                              "theme-surface-card theme-strong-text flex min-w-0 flex-1 items-center overflow-hidden rounded-sm border px-2 text-left text-xs shadow-none transition hover:border-sky-400 hover:bg-[var(--app-primary-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/20",
                              effectiveDensityMode === "compact" ? "h-8" : "h-9 text-sm",
                              isDocked && "h-6 px-1 text-[9px]",
                              !resource.resourceId && "theme-muted-text",
                            )}
                          onMouseDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            if (!isSubpartida) openResourceSearch(resource);
                          }}
                        >
                          <span className="truncate">{resourceLabel}</span>
                        </button>
                        {nestedRows.length > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className={cn("shrink-0", effectiveDensityMode === "compact" ? "h-8 px-2 text-[11px]" : "h-9 px-2 text-xs", isDocked && "h-6 px-1 text-[9px]")}
                            onClick={() =>
                              setSubpartidaApuPreview({
                                resourceIndex: index,
                                title: resource.catalogPartida?.description ?? resource.description ?? resourceLabel,
                                performance: resource.catalogPartida?.performance ?? 1,
                                unit: resource.catalogPartida?.unit ?? resource.unit ?? resource.resource?.unit ?? currentItemRecord.unit,
                              })
                            }
                          >
                            Ver APU
                          </Button>
                        ) : null}
                      </div>
                    )}
                  </TD>
                  <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "text-center")}>{calculatedResource.resource?.unit ?? resource.catalogPartida?.unit ?? "-"}</TD>
                  <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "text-right")}>
                    {canEditCrew ? (
                      <BufferedInput
                        data-testid={`apu-row-crew-${resource.id}`}
                        type="number"
                        step="0.0001"
                        value={resource.crew ?? ""}
                        className={cn(
                          getInputDensityClass(effectiveDensityMode, isExcelMode),
                          "text-right tabular-nums",
                          isDocked && "!px-0",
                        )}
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
                      "theme-subtle-text block text-right tabular-nums",
                          effectiveDensityMode === "compact" ? "py-1.5 text-xs" : "py-2 text-sm",
                        )}
                      >
                        -
                      </span>
                    )}
                  </TD>
                  <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "text-right")}>
                    <BufferedInput
                      type="number"
                      step="0.01"
                      value={calculatedResource.quantity}
                      readOnly={isCrewDriven}
                      className={cn(
                        getInputDensityClass(effectiveDensityMode, isExcelMode),
                        "text-right tabular-nums",
                        isDocked && "!px-0",
                        isCrewDriven ? readonlyInputClass : undefined,
                      )}
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
                  <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "text-right")}>
                    <BufferedInput
                      type="number"
                      step="0.01"
                      value={calculatedResource.unitPrice}
                      readOnly={isPercentageBased}
                      className={cn(
                        getInputDensityClass(effectiveDensityMode, isExcelMode),
                        "text-right tabular-nums",
                        isDocked && "!px-0",
                        isPercentageBased ? readonlyInputClass : undefined,
                      )}
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
                      "theme-strong-text text-right text-xs font-semibold tabular-nums",
                    )}
                  >
                    {formatCurrency(calculatedResource.subtotal, "PEN", currencyDecimals)}
                  </TD>
                  <TD
                    className={cn(
                      getCellPadding(effectiveDensityMode, isExcelMode),
                      isDocked && "!p-0",
                    )}
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Quitar recurso ${resourceLabel}`}
                      title={`Quitar ${resourceLabel}`}
                      className={cn(
                        effectiveDensityMode === "compact" ? "h-8 px-2 text-xs" : "h-9 px-2 text-sm",
                        isDocked && "!p-0",
                      )}
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
                      {isDocked ? <Trash2 className="h-3 w-3" aria-hidden="true" /> : "Quitar"}
                    </Button>
                  </TD>
                </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
        <EditableSubpartidaApuDialog
          currencyDecimals={currencyDecimals}
          densityMode={effectiveDensityMode}
          excelCssVariables={excelCssVariables}
          isExcelMode={isExcelMode}
          preview={
            subpartidaApuPreview
              ? {
                  ...subpartidaApuPreview,
                  rows:
                    currentApuRecord.resources[subpartidaApuPreview.resourceIndex]?.nestedApuRows ??
                    currentApuRecord.resources[subpartidaApuPreview.resourceIndex]?.catalogPartida?.apuRows ??
                    [],
                }
              : null
          }
          onClose={() => setSubpartidaApuPreview(null)}
          onPatchRow={(resourceIndex, nestedIndex, changes) => patchNestedSubpartidaRow(resourceIndex, nestedIndex, changes)}
        />
        <AddSubpartidaDialog
          catalogPartidas={catalogPartidas}
          currencyDecimals={currencyDecimals}
          densityMode={effectiveDensityMode}
          excelCssVariables={excelCssVariables}
          isExcelMode={isExcelMode}
          open={addSubpartidaOpen}
          onAdd={addCatalogSubpartida}
          onClose={() => setAddSubpartidaOpen(false)}
        />
        {editingResourceRowId && resourceSuggestions.length > 0 && resourceMenu?.rowId === editingResourceRowId ? (
          <div
            className="theme-surface-card fixed z-[90] overflow-hidden rounded-md border shadow-2xl"
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
                    suggestionIndex === resourceHighlightedIndex ? "theme-status-info" : "hover:bg-[var(--app-surface-hover)]",
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
                    <p className="theme-strong-text truncate text-sm font-medium">{candidate.code} - {candidate.description}</p>
                    <p className="theme-muted-text mt-0.5 text-xs">{candidate.unit}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
          </div>
        </Dialog.Content>
      </ApuPresentationBoundary>
    </Dialog.Root>
  );
}

function ApuPresentationBoundary({ docked, children }: { docked: boolean; children: ReactNode }) {
  if (docked) return <Fragment>{children}</Fragment>;
  return <Dialog.Portal>{children}</Dialog.Portal>;
}

function getHeaderCellClass(isExcelMode: boolean, className?: string, isDocked = false) {
  return cn(
    "budget-sticky-header sticky uppercase tracking-wide",
    isDocked ? "h-7 min-w-0 break-words px-1 py-1 !text-[0.65rem] leading-tight" : "h-10 text-xs",
    isExcelMode ? "z-30 theme-muted-panel border-b border-[var(--app-border-strong)] font-semibold text-[var(--app-text)]" : "z-20 theme-muted-panel",
    className,
  );
}

function getSubpartidaPreviewHeaderCellClass(isExcelMode: boolean, className?: string) {
  return cn(
    "budget-sticky-header h-10 text-xs uppercase tracking-wide",
    isExcelMode ? "theme-muted-panel border-b border-[var(--app-border-strong)] text-[11px] font-semibold text-[var(--app-text)]" : "theme-muted-panel",
    className,
  );
}

function getInputDensityClass(mode: "compact" | "comfortable", isExcelMode = false) {
  if (isExcelMode) return "h-8 rounded-sm border-[var(--app-border-soft)] px-2 text-xs shadow-none";
  return mode === "compact" ? "h-8 rounded-lg px-2 text-xs" : "h-9 rounded-xl px-3 text-sm";
}

function getCellPadding(mode: "compact" | "comfortable", isExcelMode = false) {
  return cn(mode === "compact" ? "py-2" : "py-3", isExcelMode && "border-b border-[var(--table-border-soft)] text-xs");
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

function buildCatalogPartidaSearchText(partida: CatalogPartidaRecord) {
  return normalizeResourceSearchText([partida.description, partida.unit, partida.unitPrice.toString()].join(" "));
}

function cloneCatalogPartidaApuRows(rows: PartidaApuRowRecord[], catalogPartidaId: string) {
  return rows.map((row, index) => ({
    ...row,
    id: crypto.randomUUID(),
    catalogPartidaId,
    sortOrder: index,
  }));
}

function AddSubpartidaDialog({
  open,
  catalogPartidas,
  currencyDecimals,
  densityMode,
  excelCssVariables,
  isExcelMode,
  onAdd,
  onClose,
}: {
  open: boolean;
  catalogPartidas: CatalogPartidaRecord[];
  currencyDecimals: number;
  densityMode: "compact" | "comfortable";
  excelCssVariables: CSSProperties;
  isExcelMode: boolean;
  onAdd: (partida: CatalogPartidaRecord) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0);
  const [selectedPartidaId, setSelectedPartidaId] = useState<string | null>(null);
  const indexedPartidas = useMemo(
    () =>
      catalogPartidas.map((partida) => ({
        partida,
        searchText: buildCatalogPartidaSearchText(partida),
      })),
    [catalogPartidas],
  );
  const suggestions = useMemo(() => {
    const normalizedQuery = normalizeResourceSearchText(query);
    return indexedPartidas
      .filter(({ searchText }) => {
        if (!normalizedQuery) return true;
        return searchText.includes(normalizedQuery);
      })
      .map(({ partida }) => partida)
      .slice(0, 40);
  }, [indexedPartidas, query]);
  const showSuggestions =
    (isSearchFocused || (query.trim().length > 0 && selectedPartidaId === null)) && suggestions.length > 0;
  const selectedPartida =
    suggestions.find((partida) => partida.id === selectedPartidaId) ??
    catalogPartidas.find((partida) => partida.id === selectedPartidaId) ??
    suggestions[0] ??
    null;
  const previewRows = selectedPartida?.apuRows ?? [];
  const previewSummary = selectedPartida ? calculateApuSummary(previewRows, selectedPartida.performance) : null;
  const previewUnitPrice = previewRows.length > 0 ? previewSummary?.totalUnitCost ?? 0 : selectedPartida?.unitPrice ?? 0;
  const readonlyInputClassName = cn(
    getInputDensityClass(densityMode, isExcelMode),
    "bg-transparent shadow-none",
    !isExcelMode && "border-transparent px-0",
  );
  const closeDialog = () => {
    setQuery("");
    setIsSearchFocused(false);
    setHighlightedSuggestionIndex(0);
    setSelectedPartidaId(null);
    onClose();
  };
  const addSelectedPartida = () => {
    if (!selectedPartida) return;
    setQuery("");
    setIsSearchFocused(false);
    setHighlightedSuggestionIndex(0);
    setSelectedPartidaId(null);
    onAdd(selectedPartida);
  };
  const selectSuggestion = (partida: CatalogPartidaRecord) => {
    setSelectedPartidaId(partida.id);
    setQuery(partida.description);
    setIsSearchFocused(false);
    setHighlightedSuggestionIndex(0);
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeDialog();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content
          className="theme-surface-card fixed left-1/2 top-1/2 z-[130] max-h-[88vh] w-[min(1180px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border shadow-2xl"
          data-excel-field-border-scope="apu-editor"
          data-view-mode={isExcelMode ? "excel" : "modern"}
          data-density-mode={densityMode}
          style={excelCssVariables}
        >
          <div className="theme-border-top flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <Dialog.Title className="theme-strong-text text-base font-semibold">Agregar subpartida</Dialog.Title>
              <Dialog.Description className="theme-muted-text mt-1 text-sm">
                Busca una partida del catalogo global y revisa su APU antes de insertarla.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">Cerrar</Button>
            </Dialog.Close>
          </div>
          <div className="flex max-h-[76vh] min-h-0 flex-col gap-4 overflow-hidden p-4">
            <div className="theme-surface-card relative z-10 flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Input
                  autoFocus
                  data-testid="apu-add-subpartida-search"
                  value={query}
                  className={getInputDensityClass(densityMode, isExcelMode)}
                  placeholder="Buscar partida por descripcion o unidad"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedPartidaId(null);
                    setHighlightedSuggestionIndex(0);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    window.setTimeout(() => setIsSearchFocused(false), 120);
                  }}
                  onKeyDown={(event) => {
                    if (suggestions.length === 0) return;

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setIsSearchFocused(true);
                      setHighlightedSuggestionIndex((current) => Math.min(current + 1, suggestions.length - 1));
                      return;
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setIsSearchFocused(true);
                      setHighlightedSuggestionIndex((current) => Math.max(current - 1, 0));
                      return;
                    }

                    if (event.key === "Enter" && isSearchFocused) {
                      event.preventDefault();
                      const suggestion = suggestions[highlightedSuggestionIndex] ?? suggestions[0];
                      if (suggestion) selectSuggestion(suggestion);
                      return;
                    }

                    if (event.key === "Escape") {
                      setIsSearchFocused(false);
                      setHighlightedSuggestionIndex(0);
                    }
                  }}
                />
                {showSuggestions ? (
                  <div className="theme-surface-card absolute left-0 right-0 top-[calc(100%+6px)] max-h-72 overflow-auto rounded-md border py-1 shadow-2xl">
                    {suggestions.map((partida, index) => (
                      <button
                        key={partida.id}
                        type="button"
                        data-testid={`apu-add-subpartida-option-${partida.id}`}
                        className={cn(
                          "flex w-full items-start justify-between gap-3 px-3 py-2 text-left",
                          index === highlightedSuggestionIndex ? "theme-status-info" : "hover:bg-[var(--app-surface-hover)]",
                        )}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          selectSuggestion(partida);
                        }}
                        onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                      >
                        <span className="min-w-0">
                          <span className="theme-strong-text block truncate text-sm font-medium">{partida.description}</span>
                          <span className="theme-muted-text mt-0.5 block text-xs">
                            Unidad: {partida.unit} - PU: {formatCurrency(partida.unitPrice, partida.currency, currencyDecimals)}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {isSearchFocused && suggestions.length === 0 ? (
                <p className="theme-muted-text text-sm sm:px-2">No se encontraron partidas.</p>
              ) : null}
            </div>
            <div className="min-h-0 overflow-auto">
              {selectedPartida ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="theme-strong-text text-sm font-semibold">{selectedPartida.description}</p>
                      <p className="theme-muted-text mt-1 text-sm">Unidad: {selectedPartida.unit}</p>
                    </div>
                    <Button
                      type="button"
                      className={cn(densityMode === "compact" ? "h-8 text-xs" : "h-9 text-sm")}
                      onClick={addSelectedPartida}
                    >
                      Agregar al APU
                    </Button>
                  </div>
                  <div className={cn("grid md:grid-cols-2", isExcelMode ? "gap-2" : "gap-4")}>
                    <div className={cn("theme-muted-panel border", isExcelMode ? "rounded-md border-[var(--app-border-strong)] p-2" : "rounded-2xl p-4")}>
                      <p className={cn("theme-muted-text", isExcelMode ? "text-xs" : "text-sm")}>Rendimiento ({selectedPartida.unit}/Dia)</p>
                      <Input value={selectedPartida.performance.toFixed(4)} readOnly className={cn(readonlyInputClassName, "tabular-nums")} />
                    </div>
                    <div className={cn("theme-muted-panel border", isExcelMode ? "rounded-md border-[var(--app-border-strong)] p-2" : "rounded-2xl p-4")}>
                      <p className={cn("theme-muted-text", isExcelMode ? "text-xs" : "text-sm")}>Costo unitario</p>
                      <p className={cn("theme-strong-text mt-2 font-semibold", isExcelMode ? "text-xl" : "text-2xl")}>
                        {formatCurrency(previewUnitPrice, selectedPartida.currency, currencyDecimals)}
                      </p>
                    </div>
                  </div>
                  {previewRows.length > 0 ? (
                    <SubpartidaPreviewRowsTable
                      rows={previewRows}
                      currency={selectedPartida.currency}
                      currencyDecimals={currencyDecimals}
                      densityMode={densityMode}
                      isExcelMode={isExcelMode}
                    />
                  ) : (
                    <div className="theme-dashed-panel theme-muted-text rounded-xl border p-5 text-sm">
                      Esta subpartida no tiene APU detallado en el catalogo global. Se agregara como subpartida sin filas internas.
                    </div>
                  )}
                </div>
              ) : (
                <div className="theme-dashed-panel theme-muted-text rounded-xl border p-5 text-sm">Selecciona una partida para previsualizarla.</div>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SubpartidaPreviewRowsTable({
  rows,
  currency,
  currencyDecimals,
  densityMode,
  isExcelMode,
}: {
  rows: PartidaApuRowRecord[];
  currency: string;
  currencyDecimals: number;
  densityMode: "compact" | "comfortable";
  isExcelMode: boolean;
}) {
  const readonlyInputClassName = cn(
    getInputDensityClass(densityMode, isExcelMode),
    "bg-transparent shadow-none",
    !isExcelMode && "border-transparent px-0",
  );

  return (
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
        <THead className={cn(isExcelMode && "[&_th]:theme-muted-panel [&_th]:text-[11px] [&_th]:font-semibold")}>
          <TR className={cn("hover:bg-[var(--app-surface-hover)]", isExcelMode ? "theme-muted-panel hover:theme-muted-panel" : "theme-muted-panel")}>
            <TH className={getSubpartidaPreviewHeaderCellClass(isExcelMode, "w-[36px]")} />
            <TH className={getSubpartidaPreviewHeaderCellClass(isExcelMode)}>Insumo</TH>
            <TH className={getSubpartidaPreviewHeaderCellClass(isExcelMode, "text-center")}>Unidad</TH>
            <TH className={getSubpartidaPreviewHeaderCellClass(isExcelMode, "whitespace-nowrap text-right")}>Cuadrilla</TH>
            <TH className={getSubpartidaPreviewHeaderCellClass(isExcelMode, "text-right")}>Cantidad</TH>
            <TH className={getSubpartidaPreviewHeaderCellClass(isExcelMode, "whitespace-nowrap text-right")}>Precio unitario</TH>
            <TH className={getSubpartidaPreviewHeaderCellClass(isExcelMode, "whitespace-nowrap text-right")}>Subtotal</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => (
            <TR key={row.id} className={getApuCategoryPresentation(getApuPresentationCategory(row)).rowClassName}>
              <TD className={cn(getCellPadding(densityMode, isExcelMode), "pr-0")}>
                <span
                  data-apu-category={getApuPresentationCategory(row)}
                  className={cn("inline-flex cursor-default", getApuCategoryPresentation(getApuPresentationCategory(row)).gripClassName)}
                >
                  <GripVertical className="h-4 w-4 opacity-40" />
                </span>
              </TD>
              <TD className={getCellPadding(densityMode, isExcelMode)}>
                <Input value={row.description} readOnly className={readonlyInputClassName} />
              </TD>
              <TD className={cn(getCellPadding(densityMode, isExcelMode), "text-center")}>
                <Input value={row.unit} readOnly className={cn(readonlyInputClassName, "text-center")} />
              </TD>
              <TD className={getCellPadding(densityMode, isExcelMode)}>
                <span className={cn("theme-subtle-text block text-right tabular-nums", densityMode === "compact" ? "py-1.5 text-xs" : "py-2 text-sm")}>-</span>
              </TD>
              <TD className={getCellPadding(densityMode, isExcelMode)}>
                <Input value={row.quantity} readOnly className={cn(readonlyInputClassName, "text-right tabular-nums")} />
              </TD>
              <TD className={getCellPadding(densityMode, isExcelMode)}>
                <Input value={row.unitPrice} readOnly className={cn(readonlyInputClassName, "text-right tabular-nums")} />
              </TD>
              <TD className={cn(getCellPadding(densityMode, isExcelMode), "theme-strong-text text-right text-xs font-semibold tabular-nums")}>
                {formatCurrency(row.subtotal, currency, currencyDecimals)}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

function EditableSubpartidaApuDialog({
  preview,
  currencyDecimals,
  densityMode,
  excelCssVariables,
  isExcelMode,
  onClose,
  onPatchRow,
}: {
  preview: { resourceIndex: number; title: string; performance: number; unit: string; rows: PartidaApuRowRecord[] } | null;
  currencyDecimals: number;
  densityMode: "compact" | "comfortable";
  excelCssVariables: CSSProperties;
  isExcelMode: boolean;
  onClose: () => void;
  onPatchRow: (resourceIndex: number, nestedIndex: number, changes: Partial<PartidaApuRowRecord>) => void;
}) {
  const summary = preview ? calculateApuSummary(preview.rows, preview.performance) : null;
  const readonlyInputClassName = cn(
    getInputDensityClass(densityMode, isExcelMode),
    "bg-transparent shadow-none",
    !isExcelMode && "border-transparent px-0",
  );
  const editableInputClassName = cn(
    getInputDensityClass(densityMode, isExcelMode),
    "text-right tabular-nums",
    !isExcelMode && "border-transparent bg-transparent px-0 shadow-none",
  );

  return (
    <Dialog.Root open={preview !== null} onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content
          className="theme-surface-card fixed left-1/2 top-1/2 z-[130] max-h-[82vh] w-[min(940px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border shadow-2xl"
          data-excel-field-border-scope="apu-editor"
          data-view-mode={isExcelMode ? "excel" : "modern"}
          data-density-mode={densityMode}
          style={excelCssVariables}
        >
          <div className="theme-border-top flex items-start justify-between gap-4 border-b px-5 py-4">
            <div>
              <Dialog.Title className="theme-strong-text text-base font-semibold">APU de subpartida</Dialog.Title>
              <p className="theme-muted-text mt-1 text-sm">{preview?.title}</p>
              <p className="theme-muted-text mt-1 text-sm">Unidad: {preview?.unit ?? ""}</p>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">Cerrar</Button>
            </Dialog.Close>
          </div>
          <div className="max-h-[64vh] overflow-auto p-4">
            <div className={cn("grid md:grid-cols-2", isExcelMode ? "mb-3 gap-2" : "mb-5 gap-4")}>
              <div className={cn("theme-muted-panel border", isExcelMode ? "rounded-md border-[var(--app-border-strong)] p-2" : "rounded-2xl p-4")}>
                <p className={cn("theme-muted-text", isExcelMode ? "text-xs" : "text-sm")}>Rendimiento ({preview?.unit ?? ""}/Día)</p>
                <Input
                  value={preview?.performance.toFixed(4) ?? ""}
                  readOnly
                  className={cn(readonlyInputClassName, "tabular-nums")}
                />
              </div>
              <div className={cn("theme-muted-panel border", isExcelMode ? "rounded-md border-[var(--app-border-strong)] p-2" : "rounded-2xl p-4")}>
                <p className={cn("theme-muted-text", isExcelMode ? "text-xs" : "text-sm")}>Costo unitario</p>
                <p className={cn("theme-strong-text mt-2 font-semibold", isExcelMode ? "text-xl" : "text-2xl")}>
                  {formatCurrency(summary?.totalUnitCost ?? 0, "PEN", currencyDecimals)}
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
                <THead className={cn(isExcelMode && "[&_th]:theme-muted-panel [&_th]:text-[11px] [&_th]:font-semibold")}>
                  <TR className={cn("hover:bg-[var(--app-surface-hover)]", isExcelMode ? "theme-muted-panel hover:theme-muted-panel" : "theme-muted-panel")}>
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
                {preview?.rows.map((row, nestedIndex) => (
                  <TR key={row.id} className={getApuCategoryPresentation(getApuPresentationCategory(row)).rowClassName}>
                    <TD className={cn(getCellPadding(densityMode, isExcelMode), "pr-0")}>
                      <span
                        data-apu-category={getApuPresentationCategory(row)}
                        className={cn("inline-flex cursor-default", getApuCategoryPresentation(getApuPresentationCategory(row)).gripClassName)}
                      >
                        <GripVertical className="h-4 w-4 opacity-40" />
                      </span>
                    </TD>
                    <TD className={getCellPadding(densityMode, isExcelMode)}>
                      <Input value={row.description} readOnly className={readonlyInputClassName} />
                    </TD>
                    <TD className={cn(getCellPadding(densityMode, isExcelMode), "text-center")}>
                      <Input value={row.unit} readOnly className={cn(readonlyInputClassName, "text-center")} />
                    </TD>
                    <TD className={getCellPadding(densityMode, isExcelMode)}>
                      <span className={cn("theme-subtle-text block text-right tabular-nums", densityMode === "compact" ? "py-1.5 text-xs" : "py-2 text-sm")}>-</span>
                    </TD>
                    <TD className={getCellPadding(densityMode, isExcelMode)}>
                      <BufferedInput
                        type="number"
                        step="0.0001"
                        value={row.quantity}
                        className={editableInputClassName}
                        onCommit={(value) => {
                          if (preview) onPatchRow(preview.resourceIndex, nestedIndex, { quantity: Number(value) });
                        }}
                      />
                    </TD>
                    <TD className={getCellPadding(densityMode, isExcelMode)}>
                      <BufferedInput
                        type="number"
                        step="0.0001"
                        value={row.unitPrice}
                        className={editableInputClassName}
                        onCommit={(value) => {
                          if (preview) onPatchRow(preview.resourceIndex, nestedIndex, { unitPrice: Number(value) });
                        }}
                      />
                    </TD>
                    <TD className={cn(getCellPadding(densityMode, isExcelMode), "theme-strong-text text-right text-xs font-semibold tabular-nums")}>
                      {formatCurrency(row.subtotal, "PEN", currencyDecimals)}
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

function PartidaGeneratorDialog({
  open,
  currentItem,
  catalogPartidas,
  resourcesCatalog,
  onClose,
  onSaved,
}: {
  open: boolean;
  currentItem: BudgetItemRecord;
  catalogPartidas: CatalogPartidaRecord[];
  resourcesCatalog: ResourceRecord[];
  onClose: () => void;
  onSaved: (result: PartidaGenerationSaveResult) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] flex max-h-[92vh] w-[min(1180px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] shadow-2xl outline-none">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--app-border)] px-5 py-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-[var(--app-text-strong)]">Generar partida por similitud</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-[var(--app-text-muted)]">
                Crea una partida desde referencias similares y aplícala al APU actual sin salir del subpresupuesto.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="outline" className="h-8 px-3 text-xs">
                Cerrar
              </Button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-0 pt-4">
            <PartidaSimilarityGeneratorPageContent
              mode="embedded"
              partidas={catalogPartidas}
              resourcesCatalog={resourcesCatalog}
              initialSourceText={currentItem.description}
              initialGeneratedName={currentItem.description}
              initialUnit={currentItem.unit}
              onSaved={onSaved}
            />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ProLockBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5 text-[10px] font-semibold leading-none text-[var(--app-text-muted)]">
      Pro
    </span>
  );
}

function AiApuPreview({
  result,
  isExcelMode,
  onApply,
  onDismiss,
  onSelectSimilarPartida,
  khipuHref,
}: {
  result: AiApuPreviewResult;
  isExcelMode: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onSelectSimilarPartida: (partidaId: string) => void;
  khipuHref?: string;
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
        "theme-status-info border shadow-[0_16px_30px_-28px_rgba(2,132,199,0.35)]",
        isExcelMode ? "rounded-md p-3 text-xs" : "rounded-2xl p-4 text-sm",
      )}
      aria-label="Vista previa IA"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="theme-status-info-strong text-xs font-semibold uppercase tracking-wide">Vista previa IA</p>
          <h4 className={cn("theme-strong-text font-semibold", isExcelMode ? "text-base" : "text-lg")}>Propuesta APU pendiente de aplicar</h4>
          <p className="theme-muted-text mt-1 text-xs">
            Modelo usado: {result.model} · Solicitado: {result.requestedModel}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {result.fallbackUsed ? <span className="theme-status-warning rounded-full border px-2.5 py-1 text-xs font-medium">Fallback activo</span> : null}
          {khipuHref ? (
            <Link href={khipuHref}>
              <Button variant="ghost" className={cn(isExcelMode && "h-8 px-3 text-xs")}>Abrir en Khipu</Button>
            </Link>
          ) : null}
        </div>
      </div>

      {result.warnings.length > 0 ? (
        <div className="theme-status-warning theme-status-warning-strong mt-3 rounded-xl border px-3 py-2 text-xs">{result.warnings.join(" ")}</div>
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
        <p className="theme-status-warning theme-status-warning-strong mt-3 rounded-xl border px-3 py-2 text-xs">
          La IA devolvio texto libre. Puedes revisarlo en Khipu antes de aplicar cambios manuales.
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

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="theme-surface-card rounded-xl border px-3 py-2">
      <p className="theme-muted-text text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <p className="theme-strong-text mt-1 font-semibold">{value}</p>
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
    <div className="theme-surface-card rounded-xl border">
      <div className="theme-border-top theme-muted-text border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide">Partidas similares</div>
      <div className="divide-y divide-[var(--app-border)]">
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
                isSelected ? "theme-status-info" : "hover:bg-[var(--app-surface-hover)]",
                !hasItems && "cursor-not-allowed opacity-60",
              )}
            >
              <span className="theme-strong-text font-medium">{item.description}</span>
              <span className="theme-muted-text">{item.unit}</span>
              <span className="text-right tabular-nums text-[var(--app-text)]">{Math.round(item.similarity * 100)}%</span>
              <span className={cn("text-right text-xs font-semibold", isSelected ? "theme-status-info-strong" : "theme-muted-text")}>
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
    <div className="theme-surface-card rounded-xl border">
      <div className="theme-border-top theme-muted-text border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide">Insumos del catalogo</div>
      {items.length > 0 ? (
        <div className="divide-y divide-[var(--app-border)]">
          {items.map((item) => (
            <div key={item.resource_id} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_72px_96px]">
              <span className="theme-strong-text font-medium">{item.name}</span>
              <span className="theme-muted-text">{item.unit}</span>
              <span className="text-right tabular-nums text-[var(--app-text)]">{item.quantity}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="theme-muted-text px-3 py-2 text-xs">Sin insumos validos sugeridos.</p>
      )}
    </div>
  );
}

function PreviewSuggestedResources({ items }: { items: AiApuCatalogGenerationResult["proposal"]["suggested_new_resources"] }) {
  if (items.length === 0) return null;

  return (
    <div className="theme-status-warning theme-status-warning-strong rounded-xl border px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-wide">Insumos faltantes</p>
      <ul className="mt-2 space-y-1 text-xs">
        {items.map((item, index) => (
          <li key={`${item.based_on}-${index}`}>{item.based_on}: {item.reason}</li>
        ))}
      </ul>
    </div>
  );
}

function PreviewResourceGroup({ title, items }: { title: string; items: AiApuStructuredData["materials"] }) {
  return (
    <div className="theme-surface-card rounded-xl border">
      <div className="theme-border-top theme-muted-text border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide">{title}</div>
      {items.length > 0 ? (
        <div className="divide-y divide-[var(--app-border)]">
          {items.map((item, index) => (
            <div key={`${title}-${index}-${item.description}`} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_72px_96px]">
              <span className="theme-strong-text font-medium">{item.description || "Recurso sugerido sin descripcion"}</span>
              <span className="theme-muted-text">{item.unit || "s/u"}</span>
              <span className="text-right tabular-nums text-[var(--app-text)]">{item.quantity || "0"}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="theme-muted-text px-3 py-2 text-xs">Sin recursos sugeridos.</p>
      )}
    </div>
  );
}

function PreviewTextList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div className="theme-surface-card rounded-xl border px-3 py-2">
      <p className="theme-muted-text text-xs font-semibold uppercase tracking-wide">{title}</p>
      <ul className="theme-muted-text mt-2 space-y-1 text-xs">
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
