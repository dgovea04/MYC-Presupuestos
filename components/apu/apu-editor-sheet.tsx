"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { BufferedInput } from "@/components/ui/buffered-input";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { calculateApuSummary, isCrewDrivenApuRow, isLaborApuRow, isPercentageBasedApuRow } from "@/lib/calculations/apu";
import type { BudgetItemRecord } from "@/types/budget";
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
  const { currencyDecimals } = useFormattingSettings();
  const addResourceSearchRef = useRef<HTMLInputElement | null>(null);
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
  const [resourceHighlightedIndex, setResourceHighlightedIndex] = useState(0);
  const [resourceMenu, setResourceMenu] = useState<ResourceMenuState | null>(null);
  const effectiveDensityMode = isExcelMode ? "compact" : densityMode;
  const addResourceSuggestions = useMemo(() => {
    const query = normalizeResourceSearchText(addResourceQuery);
    return resourcesCatalog
      .filter((resource) => {
        if (!query) return true;
        return buildResourceSearchText(resource).includes(query);
      })
      .slice(0, 8);
  }, [addResourceQuery, resourcesCatalog]);
  const resourceSuggestions = useMemo(() => {
    if (!editingResourceRowId) return [];

    const query = normalizeResourceSearchText(editingResourceQuery);
    return resourcesCatalog
      .filter((resource) => {
        if (!query) return true;
        return buildResourceSearchText(resource).includes(query);
      })
      .slice(0, 8);
  }, [editingResourceQuery, editingResourceRowId, resourcesCatalog]);

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
      return { rows: [], totalUnitCost: 0 };
    }

    return calculateApuSummary(currentApu.resources, currentApu.performance);
  }, [currentApu]);

  if (!open || !currentItem || !currentApu) return null;
  const currentItemRecord = currentItem;
  const currentApuRecord = currentApu;
  const { rows: calculatedResources, totalUnitCost: calculatedUnitCost } = apuSummary;
  const performanceLabel = `${currentItemRecord.unit}/Dia`;

  function addResource(resourceId: string) {
    const selected = resourcesCatalog.find((resource) => resource.id === resourceId);
    if (!selected) return;

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
              isExcelMode ? "max-w-[92rem] p-3 shadow-none" : "max-w-6xl p-5",
            )}
            data-view-mode={isExcelMode ? "excel" : "modern"}
            data-density-mode={effectiveDensityMode}
            data-testid="apu-editor-sheet-panel"
          >
            <div className={cn("flex items-start justify-between", isExcelMode ? "mb-3" : "mb-5")}>
              <div>
                <p className={cn("text-slate-500", isExcelMode ? "text-xs uppercase tracking-wide" : "text-sm")}>Editor APU</p>
                <Dialog.Title asChild>
                  <h3 className={cn("font-semibold text-slate-900", isExcelMode ? "text-xl" : "text-2xl")}>{currentItemRecord.description}</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p className={cn("mt-1 text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Unidad: {currentItemRecord.unit}</p>
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button ref={closeButtonRef} variant="outline" className={cn(isExcelMode && "h-8 px-3 text-xs")}>
                  Cerrar
                </Button>
              </Dialog.Close>
            </div>

            <div className={cn("grid md:grid-cols-2", isExcelMode ? "mb-3 gap-2" : "mb-5 gap-4")}>
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

        <div className={cn("grid md:grid-cols-[1fr_180px]", isExcelMode ? "mb-3 gap-2" : "mb-5 gap-3")}>
          <Input
            ref={addResourceSearchRef}
            value={addResourceQuery}
            onFocus={openAddResourceSearch}
            onChange={(event) => {
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
              window.setTimeout(() => {
                setAddResourceMenuOpen(false);
                setAddResourceMenuPosition(null);
                setAddResourceHighlightedIndex(0);
              }, 120);
            }}
            className={getInputDensityClass(effectiveDensityMode, isExcelMode)}
            data-testid="apu-add-resource-search"
            placeholder="Agregar insumo desde el catalogo"
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

        <div
          className={cn(
            "overflow-hidden border border-slate-200",
            isExcelMode ? "rounded-md border-slate-300" : "rounded-2xl",
          )}
          data-density-mode={effectiveDensityMode}
        >
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
                  className={cn(draggedResourceId === resource.id ? "scale-[0.995] opacity-60 ring-2 ring-sky-300" : "")}
                >
                  <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "pr-0")}>
                    <span className="inline-flex cursor-grab text-slate-400">
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
                          placeholder="Buscar insumo por codigo o descripcion"
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

function buildResourceSearchText(resource: ResourceRecord) {
  return normalizeResourceSearchText(
    `${resource.code} ${resource.description} ${resource.unit} ${resource.code} - ${resource.description}`,
  );
}
