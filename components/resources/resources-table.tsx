"use client";

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { ResourceCategory, ResourcePatchFields, ResourcePatchResult, ResourceRecord, ResourceStatePatch } from "@/types/resource";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { useVirtualTableWindow } from "@/hooks/use-virtual-table-window";
import { Input } from "@/components/ui/input";
import { OperationalMetricBadge, OperationalPanel } from "@/components/ui/operational-surfaces";
import { normalizeResourceIuCode } from "@/lib/resources/iu";
import { suggestResourceIuCodes } from "@/lib/resources/iu-suggestions";
import { SaveStateBadge } from "@/components/ui/save-state-badge";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VirtualizedTableFrame, VirtualizedTableSpacerRow } from "@/components/ui/virtualized-table-frame";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { cn } from "@/lib/utils";
import type { UnifiedIndexDictionaryRow, UnifiedIndexRelationRow } from "@/types/unified-index";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type EditableColumn = "code" | "description" | "unit" | "unitPrice" | "category" | "iu" | "iuCurrent" | "source";
type IuCurrentFilter = "ALL" | "WITH_IU" | "WITHOUT_IU" | "AUTO_ASSIGNED" | "MANUAL_ASSIGNED";
type EditableResource = ResourceRecord & {
  isEditing?: boolean;
  isNew?: boolean;
  isDirty?: boolean;
  needsCodeGeneration?: boolean;
};
type PendingPaste = {
  rows: ResourcePasteRow[];
  previewRows: ResourcePasteRow[];
  targetId: string;
  startColumn: EditableColumn;
};
type ResourcePasteRow = Partial<Pick<ResourceRecord, EditableColumn | "source">>;

const editableColumnOrder: EditableColumn[] = ["code", "description", "unit", "unitPrice", "category", "iu", "iuCurrent", "source"];
const resourceCodePrefixes: Record<ResourceCategory, string> = {
  MATERIAL: "MAT",
  LABOR: "MO",
  EQUIPMENT: "EQ",
  TOOLS: "HER",
  SUBCONTRACT: "SUB",
};
const RESOURCE_ROW_HEIGHT = 74;
const RESOURCE_ROW_OVERSCAN = 8;
const RESOURCE_TABLE_COLUMN_COUNT = 9;
const AUTOCREATED_APU_SOURCE = "Autocreado desde APU del catalogo de partidas";

function isAutocreatedApuResource(resource: Pick<ResourceRecord, "source">) {
  return resource.source?.trim() === AUTOCREATED_APU_SOURCE;
}

function needsManualIuReview(resource: Pick<ResourceRecord, "source" | "iuCurrent">) {
  return isAutocreatedApuResource(resource) && !resource.iuCurrent?.trim();
}

function needsAutomaticIuReview(resource: Pick<ResourceRecord, "source" | "iuCurrent" | "iuCurrentReviewStatus">) {
  return isAutocreatedApuResource(resource) && Boolean(resource.iuCurrent?.trim()) && resource.iuCurrentReviewStatus === "AUTO_ASSIGNED";
}

function isManuallyAssignedIu(resource: Pick<ResourceRecord, "source" | "iuCurrent" | "iuCurrentReviewStatus">) {
  return isAutocreatedApuResource(resource) && Boolean(resource.iuCurrent?.trim()) && resource.iuCurrentReviewStatus === "MANUAL_ASSIGNED";
}

function formatIuSuggestionTitle(suggestions: Array<{ code: string; label: string }>) {
  return suggestions.map((suggestion) => `${suggestion.code}: ${suggestion.label}`).join("\n");
}

export function ResourcesTable({
  resources,
  companyId,
  unifiedIndexDictionaryRows,
  unifiedIndexRows,
  onRequestCreate,
}: {
  resources: ResourceRecord[];
  companyId?: string;
  unifiedIndexDictionaryRows: UnifiedIndexDictionaryRow[];
  unifiedIndexRows: UnifiedIndexRelationRow[];
  onRequestCreate?: () => void;
}) {
  const { isExcelMode } = useAppViewMode();
  const { excelRowHeight } = useFormattingSettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<EditableResource[]>(() => resources.map((resource) => toEditableResource(resource)));
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<"ALL" | ResourceCategory>("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [iuCurrentFilter, setIuCurrentFilter] = useState<IuCurrentFilter>("ALL");
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveClock, setSaveClock] = useState(() => Date.now());
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [pendingPaste, setPendingPaste] = useState<PendingPaste | null>(null);
  const [feedback, setFeedback] = useState("");
  const baseRowsRef = useRef(new Map(resources.map((resource) => [resource.id, resource])));
  const [persistedRowsById, setPersistedRowsById] = useState(() => new Map(resources.map((resource) => [resource.id, resource])));
  const deferredFilter = useDeferredValue(filter);
  const [measuredRowHeight, setMeasuredRowHeight] = useState<number | null>(null);
  const activeRowHeight = isExcelMode ? excelRowHeight : measuredRowHeight ?? RESOURCE_ROW_HEIGHT;

  const filtered = useMemo(
    () =>
      rows
        .filter((resource) => {
          const matchesCategory = category === "ALL" || resource.category === category;
          const matchesSource = sourceFilter === "ALL" || (resource.source ?? "") === sourceFilter;
          const persistedResource = persistedRowsById.get(resource.id);
          const filterIuCurrent = resource.isEditing && persistedResource ? persistedResource.iuCurrent : resource.iuCurrent;
          const filterReviewStatus =
            resource.isEditing && persistedResource ? persistedResource.iuCurrentReviewStatus : resource.iuCurrentReviewStatus;
          const hasIuCurrent = Boolean(filterIuCurrent?.trim());
          const matchesIuCurrent =
            iuCurrentFilter === "ALL" ||
            (iuCurrentFilter === "WITH_IU" && hasIuCurrent) ||
            (iuCurrentFilter === "WITHOUT_IU" && !hasIuCurrent) ||
            (iuCurrentFilter === "AUTO_ASSIGNED" &&
              needsAutomaticIuReview({
                source: resource.source,
                iuCurrent: filterIuCurrent,
                iuCurrentReviewStatus: filterReviewStatus,
              })) ||
            (iuCurrentFilter === "MANUAL_ASSIGNED" &&
              isManuallyAssignedIu({
                source: resource.source,
                iuCurrent: filterIuCurrent,
                iuCurrentReviewStatus: filterReviewStatus,
              }));
          const text = `${resource.code} ${resource.description} ${resource.iu ?? ""} ${resource.iuCurrent ?? ""}`.toLowerCase();
          return matchesCategory && matchesSource && matchesIuCurrent && text.includes(deferredFilter.toLowerCase());
        })
        .sort((left, right) => {
          const descriptionComparison = left.description.localeCompare(right.description);
          if (descriptionComparison !== 0) {
            return descriptionComparison;
          }

          return left.code.localeCompare(right.code);
        }),
    [category, deferredFilter, iuCurrentFilter, persistedRowsById, rows, sourceFilter],
  );
  const sourceOptions = useMemo(
    () =>
      [...new Set(rows.map((resource) => resource.source?.trim()).filter((source): source is string => Boolean(source)))]
        .sort((left, right) => left.localeCompare(right)),
    [rows],
  );
  const dirtyCount = useMemo(() => rows.filter((row) => row.isDirty || row.isNew).length, [rows]);
  const derivedSaveState = useMemo<SaveState>(() => {
    if (pendingIds.length > 0) return "saving";
    if (error) return "error";
    if (dirtyCount > 0) return "dirty";
    if (lastSavedAt) return "saved";
    return "idle";
  }, [dirtyCount, error, lastSavedAt, pendingIds.length]);
  useEffect(() => {
    if (!lastSavedAt) return;

    const interval = setInterval(() => setSaveClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [lastSavedAt]);
  const measuredRowObserverRef = useRef<ResizeObserver | null>(null);
  const { scrollContainerRef, scrollProps, virtualRange } = useVirtualTableWindow({
    items: filtered,
    rowHeight: activeRowHeight,
    overscan: RESOURCE_ROW_OVERSCAN,
    fallbackVisibleRows: 10,
    resetKey: `${category}:${deferredFilter}:${sourceFilter}:${iuCurrentFilter}`,
  });
  const measureVisibleRow = useCallback((node: HTMLTableRowElement | null) => {
    measuredRowObserverRef.current?.disconnect();
    measuredRowObserverRef.current = null;

    if (!node || isExcelMode) {
      return;
    }

    const commitHeight = () => {
      const nextHeight = Math.round(node.getBoundingClientRect().height);
      if (nextHeight > 0) {
        setMeasuredRowHeight((current) => (current === nextHeight ? current : nextHeight));
      }
    };

    commitHeight();

    const ResizeObserverConstructor = globalThis.ResizeObserver;
    if (!ResizeObserverConstructor) {
      return;
    }

    const observer = new ResizeObserverConstructor(() => commitHeight());
    observer.observe(node);
    measuredRowObserverRef.current = observer;
  }, [isExcelMode]);

  useEffect(() => () => measuredRowObserverRef.current?.disconnect(), []);

  const updateDraft = useCallback((id: string, patch: Partial<EditableResource>) => {
    setRows((current) =>
      applyGeneratedCodes(
        current.map((row) => {
          if (row.id !== id) return row;

          const categoryChanged = patch.category !== undefined && patch.category !== row.category;
          return {
            ...row,
            ...patch,
            code: categoryChanged ? "" : row.code,
            needsCodeGeneration: categoryChanged ? true : row.needsCodeGeneration,
            isDirty: true,
            isEditing: true,
          };
        }),
      ),
    );
  }, []);

  const startEditing = useCallback((id: string) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              isEditing: true,
            }
          : row,
      ),
    );
  }, []);

  const reconcilePatchResult = useCallback((result: ResourcePatchResult) => {
    for (const entry of result.created) {
      baseRowsRef.current.set(entry.resource.id, entry.resource);
    }

    for (const resource of result.updated) {
      baseRowsRef.current.set(resource.id, resource);
    }

    for (const id of result.deleted) {
      baseRowsRef.current.delete(id);
    }

    setPersistedRowsById((current) => {
      const next = new Map(current);
      for (const entry of result.created) {
        next.set(entry.resource.id, entry.resource);
        next.delete(entry.clientId);
      }
      for (const resource of result.updated) {
        next.set(resource.id, resource);
      }
      for (const id of result.deleted) {
        next.delete(id);
      }
      return next;
    });

    setRows((current) => {
      let nextRows = current.filter((row) => !result.deleted.includes(row.id));

      for (const entry of result.created) {
        nextRows = nextRows.map((row) =>
          row.id === entry.clientId
            ? {
                ...entry.resource,
                isEditing: false,
                isDirty: false,
                isNew: false,
                needsCodeGeneration: false,
              }
            : row,
        );
      }

      for (const resource of result.updated) {
        nextRows = nextRows.map((row) =>
          row.id === resource.id
            ? {
                ...resource,
                isEditing: false,
                isDirty: false,
                isNew: false,
                needsCodeGeneration: false,
              }
            : row,
        );
      }

      return nextRows;
    });
  }, []);

  const updateLastSavedAt = useCallback((savedAt: string) => {
    const nextSavedAt = Date.parse(savedAt);
    if (Number.isNaN(nextSavedAt)) return;

    setLastSavedAt(nextSavedAt);
    setSaveClock(nextSavedAt);
  }, []);

  const persistRow = useCallback(async (resource: EditableResource) => {
    const patch = buildResourcePatch(
      resource.isNew ? null : (baseRowsRef.current.get(resource.id) ?? null),
      resource,
      companyId,
    );

    if (!patch) {
      return null;
    }

    const response = await fetch("/api/resources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error ?? "No se pudo guardar el insumo");
    }

    return (await response.json()) as ResourcePatchResult;
  }, [companyId]);

  const saveRow = useCallback(async (resource: EditableResource) => {
    setPendingIds((current) => [...current, resource.id]);
    setError("");

    try {
      const result = await persistRow(resource);
      if (result) {
        reconcilePatchResult(result);
        updateLastSavedAt(result.savedAt);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el insumo");
    } finally {
      setPendingIds((current) => current.filter((id) => id !== resource.id));
    }
  }, [persistRow, reconcilePatchResult, updateLastSavedAt]);

  const duplicateRow = useCallback(async (resource: EditableResource) => {
    setPendingIds((current) => [...current, resource.id]);
    setError("");

    try {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: resource.companyId ?? companyId,
          description: `${resource.description} (copia)`,
          category: resource.category,
          iu: resource.iu ?? "",
          iuCurrent: resource.iuCurrent ?? "",
          unit: resource.unit,
          unitPrice: resource.unitPrice,
          currency: resource.currency,
          source: resource.source ?? "",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo duplicar el insumo");
      }

      const created = (await response.json()) as ResourceRecord;
      baseRowsRef.current.set(created.id, created);
      setRows((current) => [...current, { ...created, isEditing: false, isDirty: false, isNew: false }]);
    } catch (duplicateError) {
      setError(duplicateError instanceof Error ? duplicateError.message : "No se pudo duplicar el insumo");
    } finally {
      setPendingIds((current) => current.filter((id) => id !== resource.id));
    }
  }, [companyId]);

  const removeRow = useCallback(async (id: string) => {
    const target = rows.find((row) => row.id === id);
    if (!target) return;

    if (target.isNew) {
      setRows((current) => current.filter((row) => row.id !== id));
      return;
    }

    setPendingIds((current) => [...current, id]);
    setError("");

    try {
      const response = await fetch("/api/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          create: [],
          update: [],
          delete: [id],
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudo eliminar el insumo");
      }

      const result = (await response.json()) as ResourcePatchResult;
      reconcilePatchResult(result);
      updateLastSavedAt(result.savedAt);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "No se pudo eliminar el insumo");
    } finally {
      setPendingIds((current) => current.filter((resourceId) => resourceId !== id));
    }
  }, [reconcilePatchResult, rows, updateLastSavedAt]);

  const cancelRow = useCallback((id: string) => {
    setRows((current) =>
      current.flatMap((row) => {
        if (row.id !== id) return [row];
        if (row.isNew) return [];

        const base = baseRowsRef.current.get(id);
        return base ? [toEditableResource(base)] : [row];
      }),
    );
  }, []);

  const handlePaste = useCallback((event: React.ClipboardEvent<HTMLElement>, targetId: string, startColumn: EditableColumn) => {
    const pastedRows = parsePastedResourceRows(event.clipboardData.getData("text"), startColumn);
    if (!pastedRows) return;

    event.preventDefault();
    setPendingPaste({
      rows: pastedRows,
      previewRows: simulatePastedPreviewRows(rows, companyId, targetId, pastedRows),
      targetId,
      startColumn,
    });
  }, [companyId, rows]);

  function applyPendingPaste() {
    if (!pendingPaste) return;

    const { rows: pastedRows, targetId } = pendingPaste;
    const targetIndex = rows.findIndex((row) => row.id === targetId);
    if (targetIndex === -1) {
      setPendingPaste(null);
      return;
    }

    setRows((current) => {
      const nextRows = [...current];
      const currentTarget = nextRows[targetIndex];
      nextRows[targetIndex] = applyPastedValuesToResource(currentTarget, pastedRows[0]);

      if (pastedRows.length > 1) {
        const extraRows = pastedRows.slice(1).map((row) => createEditableDraft(companyId, row));
        nextRows.splice(targetIndex + 1, 0, ...extraRows);
      }

      return applyGeneratedCodes(nextRows);
    });

    setFeedback(
      `Pegado listo: ${pastedRows.length} ${pastedRows.length === 1 ? "insumo preparado" : "insumos preparados"} para guardar.`,
    );
    setPendingPaste(null);
  }

  function closePastePreview() {
    setPendingPaste(null);
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    try {
      const importedRows = await parseResourceRowsFromWorkbook(file);
      if (!importedRows.length) {
        setError("No se encontraron filas validas para importar en el archivo Excel.");
        return;
      }

      const nextRows = rows.length ? rows : applyGeneratedCodes([createEditableDraft(companyId, {})]);
      const firstEditableRow = nextRows.find((row) => row.isEditing) ?? nextRows[0];

      if (!rows.length) {
        setRows(nextRows);
      }

      setPendingPaste({
        rows: importedRows,
        previewRows: simulatePastedPreviewRows(nextRows, companyId, firstEditableRow.id, importedRows),
        targetId: firstEditableRow.id,
        startColumn: "code",
      });
      setFeedback(
        `Archivo listo: ${importedRows.length} ${importedRows.length === 1 ? "insumo detectado" : "insumos detectados"} para revisar.`,
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "No se pudo leer el archivo Excel");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <OperationalPanel
        title="Tabla operativa"
        description="Busca, filtra y actualiza insumos del catalogo general sin salir de la tabla."
        metrics={
          <div className="flex flex-wrap items-center gap-2">
            <OperationalMetricBadge tone="accent">
              {filtered.length} {filtered.length === 1 ? "insumo visible" : "insumos visibles"}
            </OperationalMetricBadge>
            <OperationalMetricBadge>
              {rows.length} en catalogo
            </OperationalMetricBadge>
          </div>
        }
        controls={
            <div className="flex flex-col gap-3">
              <div className="grid gap-3 md:grid-cols-[minmax(240px,1fr)_180px_220px_160px]">
                <Input
                  placeholder="Buscar por codigo, insumo o IU"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                />
                <Select
                  value={category}
                  onChange={(event) => setCategory(event.target.value as "ALL" | ResourceCategory)}
                >
                <option value="ALL">Todas las categorias</option>
                <option value="MATERIAL">Materiales</option>
                <option value="LABOR">Mano de obra</option>
                <option value="EQUIPMENT">Equipos</option>
                <option value="TOOLS">Herramientas</option>
                <option value="SUBCONTRACT">Sub contratos</option>
              </Select>
              <Select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value)}
              >
                <option value="ALL">Todas las fuentes</option>
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </Select>
              <Select
                value={iuCurrentFilter}
                onChange={(event) => setIuCurrentFilter(event.target.value as IuCurrentFilter)}
              >
                <option value="ALL">IU 2026: todos</option>
                <option value="WITH_IU">Con IU 2026</option>
                <option value="WITHOUT_IU">Sin IU 2026</option>
                <option value="AUTO_ASSIGNED">IU autoasignado</option>
                <option value="MANUAL_ASSIGNED">Adjudicados manualmente</option>
              </Select>
            </div>
            <div
              className={cn(
                "flex flex-col gap-3 border bg-[var(--app-surface-elevated)] p-3 lg:flex-row lg:items-center lg:justify-between",
                isExcelMode ? "rounded-md border-[var(--app-border)]" : "rounded-2xl border-[var(--app-border-soft)]",
              )}
            >
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--app-text-strong)]">
                  {filter.trim() ? `Mostrando ${filtered.length} coincidencias para "${filter}"` : "Vista general del catalogo de insumos"}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
                  <span>{category === "ALL" ? "Todas las categorias" : getCategoryLabel(category)}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-[var(--app-border-strong)] md:inline-flex" />
                  <span>{sourceFilter === "ALL" ? "Todas las fuentes" : sourceFilter}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-[var(--app-border-strong)] md:inline-flex" />
                  <span>{getIuCurrentFilterLabel(iuCurrentFilter)}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-[var(--app-border-strong)] md:inline-flex" />
                  <span>{dirtyCount > 0 ? `${dirtyCount} cambios por guardar` : "Sin cambios pendientes"}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SaveStateBadge
                  state={derivedSaveState}
                  lastSavedLabel={formatLastSavedLabel(lastSavedAt, saveClock)}
                  savedLabel="Guardado"
                  compact
                  bordered
                  className="min-w-[152px]"
                />
                <Button variant="secondary" size="sm" onClick={onRequestCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Crear insumo
                </Button>
                <Button variant="outline" size="sm" className="bg-[var(--app-surface)]" onClick={() => fileInputRef.current?.click()}>
                  Importar Excel
                </Button>
              </div>
            </div>
          </div>
        }
      />

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleImportFile(event)} />

      {error ? (
        <p className={cn("theme-status-error border px-4 py-3 text-sm", isExcelMode ? "rounded-md" : "rounded-2xl")}>
          {error}
        </p>
      ) : null}
      {feedback ? (
        <p className={cn("theme-status-success border px-4 py-3 text-sm", isExcelMode ? "rounded-md" : "rounded-2xl")}>
          {feedback}
        </p>
      ) : null}

      <VirtualizedTableFrame scrollContainerRef={scrollContainerRef} onScroll={scrollProps.onScroll}>
          <Table className="table-fixed">
            <ResourceTableColGroup />
            <THead className="sticky top-0 z-20 [&_tr]:border-b-[var(--app-border)]">
              <TR className="bg-[var(--app-surface-elevated)] hover:bg-[var(--app-surface-elevated)]">
                <TH>CODIGO</TH>
                <TH>INSUMO</TH>
                <TH>UNIDAD</TH>
                <TH>PRECIO</TH>
                <TH>CATEGORIA</TH>
                <TH>IU (Base Julio 1992=100)</TH>
                <TH>IU 2026</TH>
                <TH>FUENTE</TH>
                <TH className="text-right">ACCIONES</TH>
              </TR>
            </THead>
            <TBody>
              <VirtualizedTableSpacerRow colSpan={RESOURCE_TABLE_COLUMN_COUNT} height={virtualRange.topSpacerHeight} />
              {filtered.length === 0 ? (
                <TR>
                  <TD colSpan={RESOURCE_TABLE_COLUMN_COUNT} className="py-10 text-center text-sm text-[var(--app-text-muted)]">
                    No encontramos insumos con los filtros actuales.
                  </TD>
                </TR>
              ) : null}
              {virtualRange.visibleRows.map((resource) => (
                <ResourceTableRow
                  key={resource.id}
                  rowRef={virtualRange.visibleRows[0]?.id === resource.id ? measureVisibleRow : undefined}
                  resource={resource}
                  isExcelMode={isExcelMode}
                  excelRowHeight={excelRowHeight}
                  isPending={pendingIds.includes(resource.id)}
                  unifiedIndexDictionaryRows={unifiedIndexDictionaryRows}
                  unifiedIndexRows={unifiedIndexRows}
                  onPaste={handlePaste}
                  onUpdateDraft={updateDraft}
                  onStartEditing={startEditing}
                  onSaveRow={saveRow}
                  onCancelRow={cancelRow}
                  onDuplicateRow={duplicateRow}
                  onRemoveRow={removeRow}
                />
              ))}
              <VirtualizedTableSpacerRow colSpan={RESOURCE_TABLE_COLUMN_COUNT} height={virtualRange.bottomSpacerHeight} />
            </TBody>
          </Table>
      </VirtualizedTableFrame>

      <PastePreviewSheet pendingPaste={pendingPaste} onClose={closePastePreview} onConfirm={applyPendingPaste} />
    </div>
  );
}

const ResourceTableRow = memo(function ResourceTableRow({
  rowRef,
  resource,
  isExcelMode,
  excelRowHeight,
  isPending,
  onPaste,
  onUpdateDraft,
  onStartEditing,
  onSaveRow,
  onCancelRow,
  onDuplicateRow,
  onRemoveRow,
  unifiedIndexDictionaryRows,
  unifiedIndexRows,
}: {
  rowRef?: (node: HTMLTableRowElement | null) => void;
  resource: EditableResource;
  isExcelMode: boolean;
  excelRowHeight: number;
  isPending: boolean;
  unifiedIndexDictionaryRows: UnifiedIndexDictionaryRow[];
  unifiedIndexRows: UnifiedIndexRelationRow[];
  onPaste: (event: React.ClipboardEvent<HTMLElement>, targetId: string, startColumn: EditableColumn) => void;
  onUpdateDraft: (id: string, patch: Partial<EditableResource>) => void;
  onStartEditing: (id: string) => void;
  onSaveRow: (resource: EditableResource) => Promise<void>;
  onCancelRow: (id: string) => void;
  onDuplicateRow: (resource: EditableResource) => Promise<void>;
  onRemoveRow: (id: string) => Promise<void>;
}) {
  const isOwned = !!resource.companyId || resource.isNew;
  const canEditIuCurrent = isOwned || isAutocreatedApuResource(resource);
  const canEditCatalogFields = isOwned;
  const shouldReviewIu = needsManualIuReview(resource);
  const shouldReviewAutomaticIu = needsAutomaticIuReview(resource);
  const shouldShowManualAssignedIu = isManuallyAssignedIu(resource);
  const iuSuggestions = useMemo(
    () =>
      resource.isEditing && canEditIuCurrent && !resource.iuCurrent?.trim()
        ? suggestResourceIuCodes({
            description: resource.description,
            dictionaryRows: unifiedIndexDictionaryRows,
            unifiedIndexRows,
          })
        : [],
    [canEditIuCurrent, resource.description, resource.isEditing, resource.iuCurrent, unifiedIndexDictionaryRows, unifiedIndexRows],
  );
  const primaryIuSuggestion = iuSuggestions[0] ?? null;
  const remainingIuSuggestionsCount = Math.max(0, iuSuggestions.length - 1);

  return (
    <TR
      ref={rowRef}
      className={cn(
        resource.isNew && "theme-status-success-row",
        resource.isDirty && "theme-status-warning-row",
        shouldReviewAutomaticIu && !resource.isDirty && "theme-status-warning-row",
        shouldReviewIu && !resource.isDirty && "theme-status-error-row",
      )}
      style={{ height: isExcelMode ? excelRowHeight : RESOURCE_ROW_HEIGHT }}
    >
      <TD className="align-middle">
        <Input
          value={resource.code || "Auto"}
          readOnly
          onPaste={(event) => onPaste(event, resource.id, "code")}
          className="border-transparent bg-[var(--app-surface-elevated)] px-2 font-medium tabular-nums text-[var(--app-text-strong)] shadow-none"
        />
      </TD>
      <TD className="align-middle">
        <Input
          value={resource.description}
          disabled={!resource.isEditing || !canEditCatalogFields}
          onPaste={(event) => onPaste(event, resource.id, "description")}
          onChange={(event) => onUpdateDraft(resource.id, { description: event.target.value })}
          className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
        />
      </TD>
      <TD className="align-middle">
        <Input
          value={resource.unit}
          disabled={!resource.isEditing || !canEditCatalogFields}
          onPaste={(event) => onPaste(event, resource.id, "unit")}
          onChange={(event) => onUpdateDraft(resource.id, { unit: event.target.value })}
          className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
        />
      </TD>
      <TD className="align-middle">
        <Input
          type="number"
          step="0.01"
          value={resource.unitPrice}
          disabled={!resource.isEditing || !canEditCatalogFields}
          onPaste={(event) => onPaste(event, resource.id, "unitPrice")}
          onChange={(event) => onUpdateDraft(resource.id, { unitPrice: Number(event.target.value) })}
          className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
        />
      </TD>
      <TD className="align-middle">
        <Select
          value={resource.category}
          disabled={!resource.isEditing || !canEditCatalogFields}
          onPaste={(event) => onPaste(event, resource.id, "category")}
          onChange={(event) => onUpdateDraft(resource.id, { category: event.target.value as ResourceCategory })}
          className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
        >
          <option value="MATERIAL">Materiales</option>
          <option value="LABOR">Mano de obra</option>
          <option value="EQUIPMENT">Equipos</option>
          <option value="TOOLS">Herramientas</option>
          <option value="SUBCONTRACT">Sub contratos</option>
        </Select>
      </TD>
      <TD className="align-middle">
        <Input
          value={resource.iu ?? ""}
          disabled={!resource.isEditing || !canEditCatalogFields}
          onPaste={(event) => onPaste(event, resource.id, "iu")}
          onChange={(event) => onUpdateDraft(resource.id, { iu: normalizeResourceIuCode(event.target.value) ?? "" })}
          className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
        />
      </TD>
      <TD className="align-middle">
        <div className="flex items-center gap-2">
            <Input
              value={resource.iuCurrent ?? ""}
              disabled={!resource.isEditing || !canEditIuCurrent}
              onPaste={(event) => onPaste(event, resource.id, "iuCurrent")}
              onChange={(event) => onUpdateDraft(resource.id, { iuCurrent: normalizeResourceIuCode(event.target.value) ?? "" })}
              className={cn(
                "min-w-0 flex-1",
                !resource.isEditing && "border-transparent bg-transparent px-0 shadow-none",
                shouldReviewAutomaticIu && "theme-status-warning-field",
                shouldShowManualAssignedIu && "theme-status-success-field",
                shouldReviewIu && "theme-status-error-field",
              )}
            />
            {primaryIuSuggestion ? (
              <button
                type="button"
                className="inline-flex max-w-[132px] shrink-0 items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100"
                title={formatIuSuggestionTitle(iuSuggestions)}
                onClick={() => onUpdateDraft(resource.id, { iuCurrent: primaryIuSuggestion.code })}
              >
                <span className="tabular-nums">{primaryIuSuggestion.code}</span>
                {remainingIuSuggestionsCount > 0 ? (
                  <span className="ml-1 shrink-0 text-[9px] font-semibold text-blue-500">+{remainingIuSuggestionsCount}</span>
                ) : null}
              </button>
            ) : shouldReviewIu ? (
              <span className="theme-status-error ml-auto inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                Revisar IU
              </span>
            ) : shouldReviewAutomaticIu ? (
              <span className="theme-status-warning ml-auto inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                IU autoasignado
              </span>
            ) : shouldShowManualAssignedIu ? (
              <span className="theme-status-success ml-auto inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                IU adjudicado
              </span>
            ) : null}
          </div>
      </TD>
      <TD className="align-middle">
        <Input
          value={resource.source ?? ""}
          disabled={!resource.isEditing || !canEditCatalogFields}
          onPaste={(event) => onPaste(event, resource.id, "source")}
          onChange={(event) => onUpdateDraft(resource.id, { source: event.target.value })}
          className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
        />
      </TD>
      <TD className="align-middle">
        <div className="flex flex-nowrap justify-end gap-1">
          {resource.isEditing ? (
            <>
              <ActionButton action="save" label="Guardar" size="sm" variant="secondary" iconOnly disabled={isPending} className={resourceActionButtonClassName} onClick={() => void onSaveRow(resource)} />
              <ActionButton action="cancel" label="Cancelar" size="sm" variant="ghost" iconOnly disabled={isPending} className={resourceActionButtonClassName} onClick={() => onCancelRow(resource.id)} />
            </>
          ) : (
            <>
              <ActionButton action="edit" label="Editar" size="sm" variant="ghost" iconOnly disabled={(!isOwned && !canEditIuCurrent) || isPending} className={resourceActionButtonClassName} onClick={() => onStartEditing(resource.id)} />
              <ActionButton action="duplicate" label="Duplicar" size="sm" variant="ghost" iconOnly disabled={isPending} className={resourceActionButtonClassName} onClick={() => void onDuplicateRow(resource)} />
              <ActionButton action="delete" label="Eliminar" size="sm" variant="ghost" iconOnly disabled={!isOwned || isPending} className={resourceActionButtonClassName} onClick={() => void onRemoveRow(resource.id)} />
            </>
          )}
        </div>
      </TD>
    </TR>
  );
});

function PastePreviewSheet({
  pendingPaste,
  onClose,
  onConfirm,
}: {
  pendingPaste: PendingPaste | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { isExcelMode } = useAppViewMode();
  if (!pendingPaste) return null;

  const previewRows = pendingPaste.previewRows.slice(0, 20);

  return (
    <div className={cn("fixed inset-0 z-50 bg-slate-950/30", isExcelMode ? "backdrop-blur-0" : "backdrop-blur-sm")}>
      <div className={cn("mx-auto mt-10 w-[min(1100px,calc(100%-2rem))] overflow-hidden border bg-[var(--app-surface)]", isExcelMode ? "rounded-md border-[var(--app-border)] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]" : "rounded-3xl border-[var(--app-border-soft)] shadow-2xl")}>
        <div className="flex items-start justify-between border-b border-[var(--app-border-soft)] px-6 py-5">
          <div>
            <p className="text-sm text-[var(--app-text-muted)]">Previsualizacion de pegado</p>
            <h3 className="text-2xl font-semibold text-[var(--app-text-strong)]">Revisa antes de aplicar</h3>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              Se prepararan {pendingPaste.rows.length} {pendingPaste.rows.length === 1 ? "insumo" : "insumos"} desde la columna{" "}
              <span className="font-medium text-[var(--app-text-strong)]">{pendingPaste.startColumn}</span>.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>

        <div className="max-h-[56vh] overflow-auto px-6 py-5">
          <div className={getTableFrameClassName(isExcelMode)}>
            <Table className="table-fixed">
              <ResourceTableColGroup includeActions={false} />
              <THead>
                <TR className="bg-[var(--app-surface-elevated)] hover:bg-[var(--app-surface-elevated)]">
                  <TH>CODIGO</TH>
                  <TH>INSUMO</TH>
                  <TH>UNIDAD</TH>
                  <TH className="text-right">PRECIO</TH>
                  <TH>CATEGORIA</TH>
                  <TH>IU (Base Julio 1992=100)</TH>
                  <TH>IU 2026</TH>
                  <TH>FUENTE</TH>
                </TR>
              </THead>
              <TBody>
                {previewRows.map((row, index) => (
                  <TR key={index}>
                    <TD>{row.code ?? "Auto"}</TD>
                    <TD>{row.description ?? "-"}</TD>
                    <TD>{row.unit ?? "-"}</TD>
                    <TD className="text-right tabular-nums">{row.unitPrice ?? "-"}</TD>
                    <TD>{getCategoryLabel(row.category)}</TD>
                    <TD>{row.iu ?? "-"}</TD>
                    <TD>{row.iuCurrent ?? "-"}</TD>
                    <TD>{row.source ?? "-"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--app-border-soft)] px-6 py-4">
          <p className="text-sm text-[var(--app-text-muted)]">El pegado solo se aplicara al confirmar.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={onConfirm}>Aplicar pegado</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResourceTableColGroup({ includeActions = true }: { includeActions?: boolean }) {
  return (
    <colgroup>
      <col style={{ width: "110px" }} />
      <col style={{ width: "320px" }} />
      <col style={{ width: "96px" }} />
      <col style={{ width: "120px" }} />
      <col style={{ width: "170px" }} />
      <col style={{ width: "112px" }} />
      <col style={{ width: "240px" }} />
      <col style={{ width: "160px" }} />
      {includeActions ? <col style={{ width: "124px" }} /> : null}
    </colgroup>
  );
}

const resourceActionButtonClassName = "h-7 w-7 rounded-md p-0 [&_svg]:h-3.5 [&_svg]:w-3.5";

function toEditableResource(resource: ResourceRecord): EditableResource {
  return {
    ...resource,
    iu: normalizeResourceIuCode(resource.iu) ?? "",
    iuCurrent: normalizeResourceIuCode(resource.iuCurrent) ?? "",
    isEditing: false,
    isNew: false,
    isDirty: false,
    needsCodeGeneration: false,
  };
}

function createEditableDraft(companyId: string | undefined, row: ResourcePasteRow): EditableResource {
  return {
    id: `temp-${crypto.randomUUID()}`,
    companyId: companyId ?? null,
    code: "",
    description: row.description ?? "",
    category: row.category ?? "MATERIAL",
    iu: normalizeResourceIuCode(row.iu) ?? "",
    iuCurrent: normalizeResourceIuCode(row.iuCurrent) ?? "",
    subcategory: "",
    unit: row.unit ?? "",
    unitPrice: row.unitPrice ?? 0,
    currency: "PEN",
    source: row.source ?? "",
    isEditing: true,
    isNew: true,
    isDirty: true,
    needsCodeGeneration: true,
  };
}

function buildResourcePatch(
  previous: ResourceRecord | null,
  current: EditableResource,
  fallbackCompanyId?: string,
): ResourceStatePatch | null {
  const normalizedCurrent = getResourcePatchFields(current, fallbackCompanyId);

  if (!previous) {
    return {
      create: [
        {
          clientId: current.id,
          data: normalizedCurrent,
        },
      ],
      update: [],
      delete: [],
    };
  }

  if (previous.companyId == null && isAutocreatedApuResource(previous)) {
    const previousIuCurrent = normalizeResourceIuCode(previous.iuCurrent) ?? "";
    const currentIuCurrent = normalizeResourceIuCode(current.iuCurrent) ?? "";
    if (previousIuCurrent === currentIuCurrent) return null;

    return {
      create: [],
      update: [
        {
          id: current.id,
          changes: {
            iuCurrent: currentIuCurrent,
          },
        },
      ],
      delete: [],
    };
  }

  const changes = getResourceFieldChanges(getResourcePatchFields(previous, fallbackCompanyId), normalizedCurrent);
  if (Object.keys(changes).length === 0) return null;

  return {
    create: [],
    update: [
      {
        id: current.id,
        changes,
      },
    ],
    delete: [],
  };
}

function getResourcePatchFields(resource: ResourceRecord, fallbackCompanyId?: string): ResourcePatchFields {
  return {
    companyId: resource.companyId ?? fallbackCompanyId,
    code: resource.code,
    description: resource.description,
    category: resource.category,
    iu: normalizeResourceIuCode(resource.iu) ?? "",
    iuCurrent: normalizeResourceIuCode(resource.iuCurrent) ?? "",
    subcategory: resource.subcategory ?? "",
    unit: resource.unit,
    unitPrice: resource.unitPrice,
    currency: resource.currency,
    source: resource.source ?? "",
  };
}

function getResourceFieldChanges(previous: ResourcePatchFields, current: ResourcePatchFields) {
  const changes: Partial<ResourcePatchFields> = {};

  for (const key of Object.keys(current) as Array<keyof ResourcePatchFields>) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
      (changes as Record<keyof ResourcePatchFields, ResourcePatchFields[keyof ResourcePatchFields]>)[key] = current[key];
    }
  }

  return changes;
}

function applyPastedValuesToResource(resource: EditableResource, row: ResourcePasteRow): EditableResource {
  const nextCategory = row.category ?? resource.category;
  const shouldRegenerateCode = resource.isNew || !resource.code || nextCategory !== resource.category;

  return {
    ...resource,
    description: row.description ?? resource.description,
    category: nextCategory,
    iu: normalizeResourceIuCode(row.iu) ?? resource.iu,
    iuCurrent: normalizeResourceIuCode(row.iuCurrent) ?? resource.iuCurrent,
    subcategory: resource.subcategory,
    unit: row.unit ?? resource.unit,
    unitPrice: row.unitPrice ?? resource.unitPrice,
    source: row.source ?? resource.source,
    code: shouldRegenerateCode ? "" : resource.code,
    needsCodeGeneration: shouldRegenerateCode,
    isEditing: true,
    isDirty: true,
  };
}

function applyGeneratedCodes(rows: EditableResource[]) {
  const maxSequenceByCategory = new Map<ResourceCategory, number>();

  for (const row of rows) {
    if (row.needsCodeGeneration || !row.code) continue;

    const prefix = resourceCodePrefixes[row.category];
    const match = row.code.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (!match) continue;

    const nextValue = Number(match[1]);
    if (!Number.isFinite(nextValue)) continue;

    maxSequenceByCategory.set(row.category, Math.max(maxSequenceByCategory.get(row.category) ?? 0, nextValue));
  }

  return rows.map((row) => {
    if (!row.needsCodeGeneration && row.code) {
      return row;
    }

    const nextSequence = (maxSequenceByCategory.get(row.category) ?? 0) + 1;
    maxSequenceByCategory.set(row.category, nextSequence);

    return {
      ...row,
      code: `${resourceCodePrefixes[row.category]}-${String(nextSequence).padStart(3, "0")}`,
      needsCodeGeneration: false,
    };
  });
}

function simulatePastedPreviewRows(
  currentRows: EditableResource[],
  companyId: string | undefined,
  targetId: string,
  pastedRows: ResourcePasteRow[],
) {
  const targetIndex = currentRows.findIndex((row) => row.id === targetId);
  if (targetIndex === -1 || pastedRows.length === 0) return pastedRows;

  const nextRows = [...currentRows];
  nextRows[targetIndex] = applyPastedValuesToResource(nextRows[targetIndex], pastedRows[0]);

  if (pastedRows.length > 1) {
    nextRows.splice(targetIndex + 1, 0, ...pastedRows.slice(1).map((row) => createEditableDraft(companyId, row)));
  }

  const preparedRows = applyGeneratedCodes(nextRows);
  return preparedRows.slice(targetIndex, targetIndex + pastedRows.length).map((row) => ({
    code: row.code,
    description: row.description,
    unit: row.unit,
    unitPrice: row.unitPrice,
    category: row.category,
    iu: row.iu,
    iuCurrent: row.iuCurrent,
    source: row.source,
  }));
}

function parsePastedResourceRows(rawText: string, startColumn: EditableColumn): ResourcePasteRow[] | null {
  const rows = rawText
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split("\t"));

  if (rows.length === 0) return null;
  if (rows.length === 1 && rows[0].length === 1) return null;

  const startIndex = editableColumnOrder.indexOf(startColumn);
  if (startIndex === -1) return null;

  return rows
    .map((cells) => {
      const draft: ResourcePasteRow = {};

      cells.forEach((cell, cellIndex) => {
        const column = editableColumnOrder[startIndex + cellIndex];
        if (!column) return;

        if (column === "category") {
          draft.category = normalizeResourceCategory(cell);
          return;
        }

        if (column === "unitPrice") {
          draft.unitPrice = parseSpreadsheetNumber(cell);
          return;
        }

        draft[column] = column === "iu" || column === "iuCurrent" ? (normalizeResourceIuCode(cell) ?? "") : cell.trim();
      });

      return draft;
    })
    .filter((row) => Object.values(row).some((value) => value !== undefined && value !== ""));
}

async function parseResourceRowsFromWorkbook(file: File) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  for (const worksheet of workbook.worksheets) {
    const rows = worksheet.getSheetValues().slice(1);
    const matrix = rows
      .map((row) => normalizeWorksheetRow(row))
      .filter((row) => row.some((cell) => cell.trim().length > 0));

    const headerIndex = matrix.findIndex((row) => looksLikeResourceHeader(row));
    const headerMap = headerIndex >= 0 ? buildHeaderMap(matrix[headerIndex]) : null;
    const dataRows = (headerIndex >= 0 ? matrix.slice(headerIndex + 1) : matrix).filter((row) => looksLikeResourceDataRow(row));
    const parsedRows = dataRows.map((row) => parseWorkbookDataRow(row, headerMap)).filter((row): row is ResourcePasteRow => row !== null);

    if (parsedRows.length) {
      return parsedRows;
    }
  }

  return [];
}

function normalizeWorksheetRow(row: unknown) {
  if (!Array.isArray(row)) return [];

  return row.slice(1).map((cell) => {
    if (cell == null) return "";
    if (typeof cell === "object" && cell && "text" in cell && typeof cell.text === "string") {
      return cell.text;
    }
    return String(cell).trim();
  });
}

function looksLikeResourceHeader(row: string[]) {
  const normalized = row.map((cell) => normalizeHeaderCell(cell));
  return (
    normalized.some((cell) => ["codigo", "code", "item"].includes(cell)) &&
    normalized.some((cell) => ["descripcion", "description", "insumo", "recurso"].includes(cell)) &&
    normalized.some((cell) => ["unidad", "unit", "und"].includes(cell))
  );
}

function buildHeaderMap(row: string[]) {
  const headerMap: Partial<Record<EditableColumn | "source", number>> = {};

  row.forEach((cell, index) => {
    const normalized = normalizeHeaderCell(cell);

    if (["codigo", "code", "item"].includes(normalized)) headerMap.code = index;
    if (["descripcion", "description", "insumo", "recurso"].includes(normalized)) headerMap.description = index;
    if (["unidad", "unit", "und"].includes(normalized)) headerMap.unit = index;
    if (["precio", "punitario", "pu", "unitprice"].includes(normalized)) headerMap.unitPrice = index;
    if (["categoria", "category"].includes(normalized)) headerMap.category = index;
    if (["iu", "indiceunificado", "iubasejulio1992100", "iubase"].includes(normalized)) headerMap.iu = index;
    if (["iuvigente", "iu2026", "iunuevo", "iucurrent", "indiceunificadovigente"].includes(normalized)) {
      headerMap.iuCurrent = index;
    }
    if (["fuente", "source", "origen"].includes(normalized)) headerMap.source = index;
  });

  return headerMap;
}

function normalizeHeaderCell(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function looksLikeResourceDataRow(row: string[]) {
  const joined = row.join(" ").trim().toLowerCase();
  if (!joined) return false;

  if (/^(catalogo|listado de insumos|proyecto:|cliente:|ubicacion:|fecha:|moneda:)/.test(joined)) {
    return false;
  }

  return row.filter((cell) => cell.trim().length > 0).length >= 3;
}

function parseWorkbookDataRow(
  row: string[],
  headerMap: Partial<Record<EditableColumn | "source", number>> | null,
): ResourcePasteRow | null {
  if (headerMap) {
    const description = getWorkbookCell(row, headerMap.description);
    const unit = getWorkbookCell(row, headerMap.unit);
    const categoryRaw = getWorkbookCell(row, headerMap.category);
    const unitPrice = parseSpreadsheetNumber(getWorkbookCell(row, headerMap.unitPrice));

    if (!description && !unit && unitPrice === 0) return null;

    return {
      code: getWorkbookCell(row, headerMap.code),
      description,
      unit,
      unitPrice,
      category: categoryRaw ? normalizeResourceCategory(categoryRaw) : "MATERIAL",
      iu: normalizeResourceIuCode(getWorkbookCell(row, headerMap.iu)) ?? "",
      iuCurrent: normalizeResourceIuCode(getWorkbookCell(row, headerMap.iuCurrent)) ?? "",
      source: getWorkbookCell(row, headerMap.source),
    };
  }

  const code = row[0]?.trim() ?? "";
  const description = row[1]?.trim() ?? "";
  const thirdValue = row[2]?.trim() ?? "";
  const fourthValue = row[3]?.trim() ?? "";
  const fifthValue = row[4]?.trim() ?? "";
  const sixthValue = row[5]?.trim() ?? "";
  const seventhValue = row[6]?.trim() ?? "";
  const eighthValue = row[7]?.trim() ?? "";

  const category = isCategoryLike(fifthValue) ? normalizeResourceCategory(fifthValue) : "MATERIAL";
  const unit = thirdValue;
  const unitPrice = parseSpreadsheetNumber(fourthValue);
  const iu = normalizeResourceIuCode(sixthValue) ?? "";
  const iuCurrent = normalizeResourceIuCode(seventhValue) ?? "";

  if (!code && !description) return null;

  return {
    code,
    description,
    category,
    unit,
    unitPrice,
    iu,
    iuCurrent,
    source: eighthValue,
  };
}

function getWorkbookCell(row: string[], index: number | undefined) {
  if (index === undefined) return "";
  return row[index]?.trim() ?? "";
}

function normalizeResourceCategory(value: string): ResourceCategory {
  const normalized = value.trim().toLowerCase();

  if (["material", "materiales", "mat"].includes(normalized)) return "MATERIAL";
  if (["labor", "mano de obra", "mo"].includes(normalized)) return "LABOR";
  if (["equipment", "equipo", "equipos", "eq"].includes(normalized)) return "EQUIPMENT";
  if (["tools", "herramienta", "herramientas", "her"].includes(normalized)) return "TOOLS";
  if (["subcontract", "sub contrato", "sub contratos", "subcontrato", "subcontratos", "sub"].includes(normalized)) return "SUBCONTRACT";

  return "MATERIAL";
}

function isCategoryLike(value: string) {
  const normalized = value.trim().toLowerCase();
  return [
    "material",
    "materiales",
    "mat",
    "labor",
    "mano de obra",
    "mo",
    "equipment",
    "equipo",
    "equipos",
    "eq",
    "tools",
    "herramienta",
    "herramientas",
    "her",
    "subcontract",
    "sub contrato",
    "sub contratos",
    "subcontrato",
    "subcontratos",
    "sub",
  ].includes(normalized);
}

function getCategoryLabel(category: ResourceCategory | undefined) {
  if (category === "LABOR") return "Mano de obra";
  if (category === "EQUIPMENT") return "Equipos";
  if (category === "TOOLS") return "Herramientas";
  if (category === "SUBCONTRACT") return "Sub contratos";
  return "Materiales";
}

function getIuCurrentFilterLabel(filter: IuCurrentFilter) {
  if (filter === "WITH_IU") return "Con IU 2026";
  if (filter === "WITHOUT_IU") return "Sin IU 2026";
  if (filter === "AUTO_ASSIGNED") return "IU autoasignado";
  if (filter === "MANUAL_ASSIGNED") return "Adjudicados manualmente";
  return "IU 2026: todos";
}

function formatLastSavedLabel(lastSavedAt: number | null, currentTime: number) {
  if (!lastSavedAt) return null;

  const seconds = Math.max(0, Math.floor((currentTime - lastSavedAt) / 1000));
  if (seconds < 60) {
    return `Ultimo guardado hace ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Ultimo guardado hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }

  const hours = Math.floor(minutes / 60);
  return `Ultimo guardado hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
}

function parseSpreadsheetNumber(value: string) {
  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return 0;

  const lastComma = trimmed.lastIndexOf(",");
  const lastDot = trimmed.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    const normalized = trimmed.replaceAll(thousandsSeparator, "").replace(decimalSeparator, ".");
    return Number(normalized) || 0;
  }

  if (lastComma !== -1) {
    return Number(trimmed.replaceAll(".", "").replace(",", ".")) || 0;
  }

  return Number(trimmed.replaceAll(",", "")) || 0;
}

