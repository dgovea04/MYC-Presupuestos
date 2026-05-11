"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { useBudgetViewMode } from "@/components/budget/view-mode-provider";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { calculateApuRows, calculateApuTotalUnitCost, isCrewDrivenApuRow, isLaborApuRow, isPercentageBasedApuRow } from "@/lib/calculations/apu";
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
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);
  const [draggedResourceId, setDraggedResourceId] = useState<string | null>(null);
  const [pendingResourceId, setPendingResourceId] = useState("");
  const effectiveDensityMode = isExcelMode ? "compact" : densityMode;

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

  if (!open || !item?.apu) return null;
  const currentItem = item;
  const currentApu = item.apu;
  const calculatedResources = calculateApuRows(currentApu.resources, currentApu.performance);
  const calculatedUnitCost = calculateApuTotalUnitCost(currentApu.resources, currentApu.performance);
  const performanceLabel = `${currentItem.unit}/Dia`;

  function addResource(resourceId: string) {
    const selected = resourcesCatalog.find((resource) => resource.id === resourceId);
    if (!selected) return;

    setPendingResourceId("");
    onUpdate({
      ...currentItem,
      apu: {
        ...currentApu,
        resources: [
          ...currentApu.resources,
          {
            id: crypto.randomUUID(),
            apuId: currentApu.id,
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
      ...currentItem,
      apu: {
        ...currentApu,
        resources: moveEntityToTarget(currentApu.resources, draggedResourceId, targetId),
      },
    });

    setDraggedResourceId(null);
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
                  <h3 className={cn("font-semibold text-slate-900", isExcelMode ? "text-xl" : "text-2xl")}>{currentItem.description}</h3>
                </Dialog.Title>
                <Dialog.Description asChild>
                  <p className={cn("mt-1 text-slate-500", isExcelMode ? "text-xs" : "text-sm")}>Unidad: {currentItem.unit}</p>
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
                <Input
                  type="number"
                  step="0.01"
                  value={currentApu.performance}
                  data-testid="apu-performance-input"
                  className={getInputDensityClass(effectiveDensityMode, isExcelMode)}
                  onChange={(event) =>
                    onUpdate({
                      ...currentItem,
                      apu: {
                        ...currentApu,
                        performance: Number(event.target.value),
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
          <Select
            value={pendingResourceId}
            onChange={(event) => {
              setPendingResourceId(event.target.value);
              addResource(event.target.value);
            }}
            className={getInputDensityClass(effectiveDensityMode, isExcelMode)}
            data-testid="apu-add-resource-select"
          >
            <option value="" disabled>
              Agregar insumo desde el catalogo
            </option>
            {resourcesCatalog.map((resource) => (
              <option key={resource.id} value={resource.id}>
                {resource.code} - {resource.description}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            className={cn(effectiveDensityMode === "compact" ? "h-8 text-xs" : "h-9 text-sm")}
            onClick={() =>
              onUpdate({
                ...currentItem,
                apu: {
                  ...currentApu,
                  resources: [
                    ...currentApu.resources,
                    {
                      id: crypto.randomUUID(),
                      apuId: currentApu.id,
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
              {currentApu.resources.map((resource, index) => {
                const calculatedResource = calculatedResources[index] ?? resource;
                const isCrewDriven = isCrewDrivenApuRow(calculatedResource);
                const isPercentageBased = isPercentageBasedApuRow(calculatedResource);
                const isLabor = isLaborApuRow(calculatedResource);
                const readonlyInputClass = "border-transparent bg-transparent px-0 shadow-none";

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
                    <Select
                      value={resource.resourceId}
                      className={getInputDensityClass(effectiveDensityMode, isExcelMode)}
                      onChange={(event) => {
                        const selected = resourcesCatalog.find((candidate) => candidate.id === event.target.value);
                        const resources = [...currentApu.resources];
                        resources[index] = {
                          ...resource,
                          resourceId: selected?.id ?? "",
                          resourceType: selected?.category ?? resource.resourceType,
                          unitPrice: selected?.unitPrice ?? resource.unitPrice,
                          resource: selected,
                        };
                        onUpdate({
                          ...currentItem,
                          apu: {
                            ...currentApu,
                            resources,
                          },
                        });
                      }}
                    >
                      <option value="">Selecciona un insumo</option>
                      {resourcesCatalog.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.code} - {candidate.description}
                        </option>
                      ))}
                    </Select>
                  </TD>
                  <TD className={cn(getCellPadding(effectiveDensityMode, isExcelMode), "text-center")}>{calculatedResource.resource?.unit ?? "-"}</TD>
                  <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                    {isLabor ? (
                      <Input
                        type="number"
                        step="0.0001"
                        value={resource.crew ?? ""}
                        className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), "text-right tabular-nums")}
                        onChange={(event) => {
                          const resources = [...currentApu.resources];
                          resources[index] = {
                            ...resource,
                            crew: event.target.value === "" ? null : Number(event.target.value),
                          };
                          onUpdate({
                            ...currentItem,
                            apu: {
                              ...currentApu,
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
                    <Input
                      type="number"
                      step="0.01"
                      value={calculatedResource.quantity}
                      readOnly={isCrewDriven}
                      className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), "text-right tabular-nums", isCrewDriven ? readonlyInputClass : undefined)}
                      onChange={(event) => {
                        const resources = [...currentApu.resources];
                        resources[index] = {
                          ...resource,
                          quantity: Number(event.target.value),
                        };
                        onUpdate({
                          ...currentItem,
                          apu: {
                            ...currentApu,
                            resources,
                          },
                        });
                      }}
                    />
                  </TD>
                  <TD className={getCellPadding(effectiveDensityMode, isExcelMode)}>
                    <Input
                      type="number"
                      step="0.01"
                      value={calculatedResource.unitPrice}
                      readOnly={isPercentageBased}
                      className={cn(getInputDensityClass(effectiveDensityMode, isExcelMode), "text-right tabular-nums", isPercentageBased ? readonlyInputClass : undefined)}
                      onChange={(event) => {
                        const resources = [...currentApu.resources];
                        resources[index] = {
                          ...resource,
                          unitPrice: Number(event.target.value),
                        };
                        onUpdate({
                          ...currentItem,
                          apu: {
                            ...currentApu,
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
                          ...currentItem,
                          apu: {
                            ...currentApu,
                            resources: currentApu.resources.filter((_, currentIndex) => currentIndex !== index),
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
