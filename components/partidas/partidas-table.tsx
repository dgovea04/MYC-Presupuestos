"use client";

import * as Dialog from "@radix-ui/react-dialog";
import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { AlertTriangle, Copy, Edit, Eye, GitCompareArrows, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { PartidaCreateSheet } from "@/components/partidas/partida-create-sheet";
import { CompactRowActions } from "@/components/spreadsheet/compact-row-actions";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { useVirtualTableWindow } from "@/hooks/use-virtual-table-window";
import { Input } from "@/components/ui/input";
import { OperationalMetricBadge, OperationalPanel } from "@/components/ui/operational-surfaces";
import { SaveStateBadge } from "@/components/ui/save-state-badge";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { VirtualizedTableFrame, VirtualizedTableSpacerRow } from "@/components/ui/virtualized-table-frame";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { cn } from "@/lib/utils";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { formatCurrency } from "@/lib/utils";
import type { CatalogPartidaPatchFields, CatalogPartidaPatchResult, CatalogPartidaRecord, CatalogPartidaStatePatch } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";
import type { AiAutocompletePartidaSuggestion } from "@/lib/ai/types";
import { KhipuActionRegistryProvider } from "@/components/ai/khipu-action-registry";

type EditableCatalogPartida = CatalogPartidaRecord & {
  isEditing?: boolean;
  isNew?: boolean;
  isDirty?: boolean;
};
type PartidaPasteRow = Partial<Pick<CatalogPartidaRecord, "description" | "unit" | "unitPrice" | "source">> & {
  performance?: number;
};
type PendingPaste = {
  rows: PartidaPasteRow[];
  previewRows: PartidaPasteRow[];
};
type ApuFilter = "ALL" | "WITH_APU" | "WITHOUT_APU";

const PartidaApuSheet = dynamic(() =>
  import("@/components/partidas/partida-apu-sheet").then((module) => module.PartidaApuSheet),
);
const PARTIDA_ROW_HEIGHT = 74;
const PARTIDA_ROW_OVERSCAN = 8;
const PARTIDA_TABLE_COLUMN_COUNT = 6;

export function PartidasTable({
  initialFilter = "",
  partidas,
  resourcesCatalog,
  canUseKhipu = true,
  canUsePartidaGenerator = true,
}: {
  initialFilter?: string;
  partidas: CatalogPartidaRecord[];
  resourcesCatalog: ResourceRecord[];
  canUseKhipu?: boolean;
  canUsePartidaGenerator?: boolean;
}) {
  const { isExcelMode } = useAppViewMode();
  const { currencyDecimals, excelRowHeight } = useFormattingSettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<EditableCatalogPartida[]>(() => partidas.map(toEditablePartida));
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false);
  const [autocompleteSuggestion, setAutocompleteSuggestion] = useState<AiAutocompletePartidaSuggestion | null>(null);
  const [filter, setFilter] = useState(initialFilter);
  const [apuFilter, setApuFilter] = useState<ApuFilter>("ALL");
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [pendingPaste, setPendingPaste] = useState<PendingPaste | null>(null);
  const deferredFilter = useDeferredValue(filter);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const text = `${row.description} ${row.unit} ${row.performanceRate ?? ""}`.toLowerCase();
        const matchesText = text.includes(deferredFilter.toLowerCase());
        const matchesApu =
          apuFilter === "ALL" ||
          (apuFilter === "WITH_APU" && row.apuRows.length > 0) ||
          (apuFilter === "WITHOUT_APU" && row.apuRows.length === 0);

        return matchesText && matchesApu;
      }),
    [apuFilter, deferredFilter, rows],
  );
  const filteredRowsWithApu = useMemo(() => filteredRows.filter((row) => row.apuRows.length > 0).length, [filteredRows]);

  const dirtyRows = useMemo(() => rows.filter((row) => row.isDirty || row.isNew), [rows]);
  const selectedPartida = rows.find((row) => row.id === selectedId) ?? null;
  const { scrollContainerRef, scrollProps, virtualRange } = useVirtualTableWindow({
    items: filteredRows,
    rowHeight: isExcelMode ? excelRowHeight : PARTIDA_ROW_HEIGHT,
    overscan: PARTIDA_ROW_OVERSCAN,
    fallbackVisibleRows: 10,
    resetKey: `${deferredFilter}:${apuFilter}`,
  });

  const patchRow = useCallback((id: string, changes: Partial<EditableCatalogPartida>) => {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              ...changes,
              isDirty: true,
              isEditing: true,
            }
          : row,
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

  const cancelRow = useCallback((id: string) => {
    setRows((current) =>
      current.flatMap((row) => {
        if (row.id !== id) return [row];
        if (row.isNew) return [];

        const base = partidas.find((partida) => partida.id === id);
        return base ? [toEditablePartida(base)] : [row];
      }),
    );
  }, [partidas]);

  const handlePartidaCreated = useCallback((partida: CatalogPartidaRecord) => {
    setRows((current) => sortEditablePartidas([...current, toEditablePartida(partida)]));
    setIsCreateSheetOpen(false);
  }, []);

  const applyPendingPaste = useCallback(() => {
    if (!pendingPaste) return;

    setRows((current) =>
      sortEditablePartidas([
        ...current,
        ...pendingPaste.rows.map((row) => createEditablePartidaDraft(row)),
      ]),
    );
    setFeedback(
      `Pegado listo: ${pendingPaste.rows.length} ${
        pendingPaste.rows.length === 1 ? "partida preparada" : "partidas preparadas"
      } para guardar.`,
    );
    setPendingPaste(null);
  }, [pendingPaste]);

  const closePastePreview = useCallback(() => {
    setPendingPaste(null);
  }, []);

  const handleImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");

    try {
      const importedRows = await parsePartidaRowsFromWorkbook(file);
      if (!importedRows.length) {
        setError("No se encontraron filas validas para importar en el archivo Excel.");
        return;
      }

      setPendingPaste({
        rows: importedRows,
        previewRows: importedRows,
      });
      setFeedback(
        `Archivo listo: ${importedRows.length} ${
          importedRows.length === 1 ? "partida detectada" : "partidas detectadas"
        } para revisar.`,
      );
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "No se pudo leer el archivo Excel");
    } finally {
      event.target.value = "";
    }
  }, []);

  const duplicateRow = useCallback((id: string) => {
    const source = rows.find((row) => row.id === id);
    if (!source) return;

    const duplicateId = crypto.randomUUID();
    const duplicate: EditableCatalogPartida = {
      ...source,
      id: duplicateId,
      description: `${source.description} (copia)`,
      source: `Duplicado desde: ${source.description}`,
      apuRows: source.apuRows.map((apuRow, index) => ({
        ...apuRow,
        id: crypto.randomUUID(),
        catalogPartidaId: duplicateId,
        sortOrder: index,
      })),
      isEditing: true,
      isDirty: true,
      isNew: true,
    };

    setRows((current) => [duplicate, ...current]);
    setSelectedId(duplicateId);
  }, [rows]);

  const reconcilePatchResult = useCallback((result: CatalogPartidaPatchResult) => {
    setRows((current) => {
      const createdMap = new Map(result.created.map((entry) => [entry.clientId, entry.partida]));
      const updatedMap = new Map(result.updated.map((entry) => [entry.id, entry]));
      const deletedIds = new Set(result.deleted);

      return current
        .flatMap((row) => {
          if (deletedIds.has(row.id)) return [];

          if (row.isNew) {
            const created = createdMap.get(row.id);
            return created ? [toEditablePartida(created)] : [];
          }

          const updated = updatedMap.get(row.id);
          return [updated ? toEditablePartida(updated) : { ...row, isDirty: false, isEditing: false, isNew: false }];
        })
        .concat(
          result.created
            .filter((entry) => !current.some((row) => row.id === entry.clientId))
            .map((entry) => toEditablePartida(entry.partida)),
        );
    });
  }, []);

  const saveAllDirtyRows = useCallback(async () => {
    const patch = buildCatalogPartidasPatch(dirtyRows);
    if (!patch) return;

    setError("");
    setFeedback("");
    setPendingIds(dirtyRows.map((row) => row.id));

    try {
      const response = await fetch("/api/partidas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudieron guardar las partidas");
      }

      const result = (await response.json()) as CatalogPartidaPatchResult;
      reconcilePatchResult(result);
      setLastSavedAt(result.savedAt);
      setFeedback("Catalogo de partidas guardado.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar las partidas");
    } finally {
      setPendingIds([]);
    }
  }, [dirtyRows, reconcilePatchResult]);

  const removeRow = useCallback(async (id: string) => {
    const target = rows.find((row) => row.id === id);
    if (!target) return;

    if (target.isNew) {
      setRows((current) => current.filter((row) => row.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
      return;
    }

    setPendingIds((current) => [...current, id]);

    try {
      const response = await fetch("/api/partidas", {
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
        throw new Error(data.error ?? "No se pudo eliminar la partida");
      }

      const result = (await response.json()) as CatalogPartidaPatchResult;
      reconcilePatchResult(result);
      setLastSavedAt(result.savedAt);
      if (selectedId === id) {
        setSelectedId(null);
      }
    } finally {
      setPendingIds((current) => current.filter((currentId) => currentId !== id));
    }
  }, [reconcilePatchResult, rows, selectedId]);

  return (
    <KhipuActionRegistryProvider
      onOpenPartidaForm={(suggestion) => {
        setAutocompleteSuggestion(suggestion);
        setIsCreateSheetOpen(true);
      }}
      onOpenPartidaApu={(suggestion) => {
        if (suggestion.id) setSelectedId(suggestion.id);
      }}
    >
    <div className="space-y-4">
      <PartidaCreateSheet open={isCreateSheetOpen} onClose={() => { setIsCreateSheetOpen(false); setAutocompleteSuggestion(null); }} onCreated={handlePartidaCreated} initialSuggestion={autocompleteSuggestion} />

      <OperationalPanel
        title="Tabla operativa"
        description="Busca partidas, revisa rendimiento y abre su APU sin salir del catalogo."
        metrics={
          <div className="flex flex-wrap items-center gap-2">
            <OperationalMetricBadge tone="accent">
              {filteredRows.length} {filteredRows.length === 1 ? "partida visible" : "partidas visibles"}
            </OperationalMetricBadge>
            <OperationalMetricBadge>
              {rows.length} en catalogo
            </OperationalMetricBadge>
            <OperationalMetricBadge>
              {filteredRowsWithApu} {filteredRowsWithApu === 1 ? "APU con filas" : "APUs con filas"}
            </OperationalMetricBadge>
          </div>
        }
        controls={
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <Input
                placeholder="Buscar partida, unidad o rendimiento"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
              />
              <Select value={apuFilter} onChange={(event) => setApuFilter(event.target.value as ApuFilter)}>
                <option value="ALL">Todos los APU</option>
                <option value="WITH_APU">Con APU</option>
                <option value="WITHOUT_APU">Sin APU</option>
              </Select>
            </div>
            <div className={cn("flex flex-col gap-3 border bg-[var(--app-surface)] p-3 lg:flex-row lg:items-center lg:justify-between", isExcelMode ? "rounded-md border-[var(--app-border-strong)]" : "rounded-2xl border-[var(--app-border)]")}>
              <div className="space-y-1">
                <p className="text-sm font-medium text-[var(--app-text)]">
                  {getPartidasFilterSummary(filter, apuFilter, filteredRows.length)}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--app-text-muted)]">
                  <span>{getApuFilterLabel(apuFilter)}</span>
                  <span className="hidden h-1 w-1 rounded-full bg-slate-300 md:inline-flex" />
                  <span>{dirtyRows.length > 0 ? `${dirtyRows.length} cambios por guardar` : "Sin cambios pendientes"}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SaveBadge dirtyCount={dirtyRows.length} lastSavedAt={lastSavedAt} isSaving={pendingIds.length > 0} />
                <Button variant="secondary" size="sm" onClick={() => setIsCreateSheetOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva partida
                </Button>
                {canUsePartidaGenerator ? (
                  <Link href="/partidas/generar">
                    <Button variant="outline" size="sm" className="gap-2 bg-[var(--app-surface)]">
                      <GitCompareArrows className="h-4 w-4" />
                      Generar por similitud
                    </Button>
                  </Link>
                ) : null}
                <Button variant="outline" size="sm" className="bg-[var(--app-surface)]" onClick={() => fileInputRef.current?.click()}>
                  Importar Excel
                </Button>
                {dirtyRows.length > 0 ? (
                  <Button variant="outline" size="sm" className="bg-[var(--app-surface)]" onClick={saveAllDirtyRows} disabled={pendingIds.length > 0}>
                    {`Guardar cambios (${dirtyRows.length})`}
                  </Button>
                ) : null}
              </div>
            </div>
            <p className="hidden">
              {filter.trim() ? `Mostrando ${filteredRows.length} coincidencias para "${filter}"` : "Vista general del catalogo de partidas"}
              {lastSavedAt ? ` · Ultimo guardado: ${new Date(lastSavedAt).toLocaleTimeString("es-PE")}` : ""}
            </p>
          </div>
        }
      />

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleImportFile(event)} />

      {error ? <p className={cn("border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700", isExcelMode ? "rounded-md" : "rounded-2xl")}>{error}</p> : null}
      {feedback ? <p className={cn("border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700", isExcelMode ? "rounded-md" : "rounded-2xl")}>{feedback}</p> : null}

      <VirtualizedTableFrame scrollContainerRef={scrollContainerRef} onScroll={scrollProps.onScroll}>
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[45%]" />
              <col className="w-[100px]" />
              <col className="w-[140px]" />
              <col className="w-[170px]" />
              <col className="w-[100px]" />
              <col className="w-[160px]" />
            </colgroup>
            <THead className="sticky top-0 z-20 [&_tr]:border-b-[var(--app-border)]">
              <TR className="bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface-muted)]">
                <TH className="text-xs uppercase tracking-wide">Partida</TH>
                <TH className="text-xs uppercase tracking-wide">Unidad</TH>
                <TH className="text-xs uppercase tracking-wide text-right">P. Unitario</TH>
                <TH className="text-xs uppercase tracking-wide">Rendimiento</TH>
                <TH className="text-xs uppercase tracking-wide">APU</TH>
                <TH className="text-right text-xs uppercase tracking-wide">Acciones</TH>
              </TR>
            </THead>
            <TBody>
              <VirtualizedTableSpacerRow colSpan={PARTIDA_TABLE_COLUMN_COUNT} height={virtualRange.topSpacerHeight} />
              {filteredRows.length === 0 ? (
                <TR>
                  <TD colSpan={PARTIDA_TABLE_COLUMN_COUNT} className="py-10 text-center text-sm text-slate-500">
                    No encontramos partidas con el filtro actual.
                  </TD>
                </TR>
              ) : null}
              {virtualRange.visibleRows.map((row) => (
                <PartidaTableRow
                  key={row.id}
                  row={row}
                  currencyDecimals={currencyDecimals}
                  isExcelMode={isExcelMode}
                  excelRowHeight={excelRowHeight}
                  isPending={pendingIds.includes(row.id)}
                  onPatchRow={patchRow}
                  onSelect={setSelectedId}
                  onSaveAllDirtyRows={saveAllDirtyRows}
                  onCancelRow={cancelRow}
                  onStartEditing={startEditing}
                  onDuplicateRow={duplicateRow}
                  onRemoveRow={removeRow}
                />
              ))}
              <VirtualizedTableSpacerRow colSpan={PARTIDA_TABLE_COLUMN_COUNT} height={virtualRange.bottomSpacerHeight} />
            </TBody>
          </Table>
      </VirtualizedTableFrame>

      <PartidaApuSheet
        open={Boolean(selectedPartida)}
        partida={selectedPartida}
        resourcesCatalog={resourcesCatalog}
        onClose={() => setSelectedId(null)}
        onChange={(partida) => patchRow(partida.id, partida)}
        canUseKhipu={canUseKhipu}
      />
      <PartidaPastePreviewSheet pendingPaste={pendingPaste} onClose={closePastePreview} onConfirm={applyPendingPaste} />
    </div>
    </KhipuActionRegistryProvider>
  );
}

const PartidaTableRow = memo(function PartidaTableRow({
  row,
  currencyDecimals,
  isExcelMode,
  excelRowHeight,
  isPending,
  onPatchRow,
  onSelect,
  onSaveAllDirtyRows,
  onCancelRow,
  onStartEditing,
  onDuplicateRow,
  onRemoveRow,
}: {
  row: EditableCatalogPartida;
  currencyDecimals: number;
  isExcelMode: boolean;
  excelRowHeight: number;
  isPending: boolean;
  onPatchRow: (id: string, changes: Partial<EditableCatalogPartida>) => void;
  onSelect: (id: string) => void;
  onSaveAllDirtyRows: () => Promise<void>;
  onCancelRow: (id: string) => void;
  onStartEditing: (id: string) => void;
  onDuplicateRow: (id: string) => void;
  onRemoveRow: (id: string) => Promise<void>;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError("");
    try {
      await onRemoveRow(row.id);
      setDeleteOpen(false);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "No se pudo eliminar la partida");
    } finally {
      setIsDeleting(false);
    }
  }

  const isLockedPreloaded = isPreloadedPartida(row) && !row.isNew;
  const isReadonly = !row.isEditing;
  const textSizeClass = isExcelMode ? "text-xs" : "text-sm";

  return (
    <>
      <TR className={row.isNew ? "bg-emerald-50/60" : row.isDirty ? "bg-amber-50/50" : ""} style={{ height: isExcelMode ? excelRowHeight : PARTIDA_ROW_HEIGHT }}>
      <TD className="align-middle">
        <Input
          value={row.description}
          readOnly={isReadonly}
          onChange={(event) => onPatchRow(row.id, { description: event.target.value })}
          className={cn(textSizeClass, isReadonly ? "border-transparent bg-transparent px-0 shadow-none focus:border-transparent" : undefined)}
        />
      </TD>
      <TD className="align-middle">
        <Input
          value={row.unit}
          readOnly={isReadonly}
          onChange={(event) => onPatchRow(row.id, { unit: event.target.value })}
          className={cn(textSizeClass, "text-center", isReadonly ? "border-transparent bg-transparent px-0 shadow-none focus:border-transparent" : undefined)}
        />
      </TD>
      <TD className={cn("align-middle text-right font-medium tabular-nums text-slate-900", textSizeClass)}>
        {formatCurrency(row.unitPrice, row.currency, currencyDecimals)}
      </TD>
      <TD className="align-middle">
        {isReadonly ? (
          <span className={cn(textSizeClass)}>{row.performanceRate ?? buildPerformanceRate(row.performance, row.performanceUnit ?? row.unit)}</span>
        ) : (
          <Input
            type="number"
            step="0.0001"
            value={row.performance}
            className={textSizeClass}
            onChange={(event) =>
              onPatchRow(row.id, {
                performance: Number(event.target.value),
                performanceRate: buildPerformanceRate(Number(event.target.value), row.performanceUnit ?? row.unit),
              })
            }
          />
        )}
      </TD>
      <TD className={cn("align-middle text-slate-500", textSizeClass)}>{row.apuRows.length} filas</TD>
      <TD className="align-middle">
        <div className="flex justify-end gap-2">
          {isExcelMode ? (
            <CompactRowActions
              triggerLabel="Abrir acciones de fila"
              actions={
                row.isEditing
                  ? [
                      {
                        id: "save",
                        label: "Guardar",
                        icon: <Save className="h-3.5 w-3.5" aria-hidden="true" />,
                        onSelect: () => void onSaveAllDirtyRows(),
                        disabled: isPending,
                      },
                      {
                        id: "cancel",
                        label: "Cancelar",
                        icon: <X className="h-3.5 w-3.5" aria-hidden="true" />,
                        onSelect: () => onCancelRow(row.id),
                        disabled: isPending,
                      },
                    ]
                  : [
                      {
                        id: "open",
                        label: "Ver APU",
                        icon: <Eye className="h-3.5 w-3.5" aria-hidden="true" />,
                        onSelect: () => onSelect(row.id),
                      },
                      {
                        id: "edit",
                        label: "Editar",
                        icon: <Edit className="h-3.5 w-3.5" aria-hidden="true" />,
                        onSelect: () => onStartEditing(row.id),
                        disabled: isLockedPreloaded,
                      },
                      {
                        id: "duplicate",
                        label: "Duplicar",
                        icon: <Copy className="h-3.5 w-3.5" aria-hidden="true" />,
                        onSelect: () => onDuplicateRow(row.id),
                        disabled: isPending,
                      },
                      {
                        id: "delete",
                        label: "Eliminar",
                        icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
                        onSelect: () => setDeleteOpen(true),
                        disabled: isLockedPreloaded || isPending || isDeleting,
                      },
                    ]
              }
            />
          ) : (
            <>
              <ActionButton action="open" label="Ver APU" size="sm" variant="outline" onClick={() => onSelect(row.id)} />
              {row.isEditing ? (
                <>
                  <ActionButton action="save" label="Guardar" size="sm" variant="secondary" disabled={isPending} onClick={() => void onSaveAllDirtyRows()} />
                  <ActionButton action="cancel" label="Cancelar" size="sm" variant="ghost" disabled={isPending} onClick={() => onCancelRow(row.id)} />
                </>
              ) : (
                <>
                  <ActionButton action="edit" label="Editar" size="sm" variant="ghost" disabled={isLockedPreloaded} onClick={() => onStartEditing(row.id)} />
                  <ActionButton action="duplicate" label="Duplicar" size="sm" variant="ghost" disabled={isPending} onClick={() => onDuplicateRow(row.id)} />
                  <ActionButton action="delete" label="Eliminar" size="sm" variant="ghost" disabled={isLockedPreloaded || isPending || isDeleting} data-partida-action="delete" data-partida-id={row.id} onClick={() => setDeleteOpen(true)} />
                </>
              )}
            </>
          )}
        </div>
      </TD>
    </TR>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)] outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-[var(--app-text-strong)]">
                  Eliminar partida
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">
                  Se eliminara <span className="font-medium text-[var(--app-text)]">{row.description}</span> del catalogo de
                  partidas, incluyendo su APU y datos asociados.
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="flex items-start gap-2 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Esta accion no se puede deshacer. La partida se eliminara de forma permanente del catalogo.
              </p>
            </div>

            {deleteError ? (
              <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {deleteError}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline" disabled={isDeleting}>
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Eliminar partida
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
});

function toEditablePartida(partida: CatalogPartidaRecord): EditableCatalogPartida {
  return {
    ...partida,
    isDirty: false,
    isEditing: false,
    isNew: false,
  };
}

function buildCatalogPartidasPatch(rows: EditableCatalogPartida[]) {
  const create = rows.filter((row) => row.isNew).map((row) => ({
    clientId: row.id,
    data: serializePatchFields(row),
  }));
  const update = rows
    .filter((row) => !row.isNew && row.isDirty)
    .map((row) => ({
      id: row.id,
      changes: serializePatchFields(row),
    }));

  if (!create.length && !update.length) return null;

  return {
    create,
    update,
    delete: [],
  } satisfies CatalogPartidaStatePatch;
}

function serializePatchFields(row: EditableCatalogPartida): CatalogPartidaPatchFields {
  return {
    description: row.description,
    unit: row.unit,
    unitPrice: row.unitPrice,
    currency: row.currency,
    source: row.source ?? undefined,
    performance: row.performance,
    performanceUnit: row.performanceUnit ?? undefined,
    performanceRate: row.performanceRate ?? undefined,
    apuRows: row.apuRows.map((apuRow, index) => ({
      id: apuRow.id,
      resourceId: apuRow.resourceId ?? undefined,
      description: apuRow.description,
      unit: apuRow.unit,
      crew: apuRow.crew ?? undefined,
      quantity: apuRow.quantity,
      unitPrice: apuRow.unitPrice,
      subtotal: apuRow.subtotal,
      resourceType: apuRow.resourceType ?? undefined,
      groupLabel: apuRow.groupLabel ?? undefined,
      sortOrder: index,
    })),
  };
}

function buildPerformanceRate(performance: number, unit: string) {
  const normalizedUnit = unit.trim();
  return normalizedUnit ? `${performance.toFixed(4)} ${normalizedUnit}/DIA` : `${performance.toFixed(4)}`;
}

function createEditablePartidaDraft(row: PartidaPasteRow): EditableCatalogPartida {
  const unit = row.unit ?? "";
  const performance = row.performance ?? 1;

  return {
    id: `temp-${crypto.randomUUID()}`,
    description: row.description ?? "",
    unit,
    unitPrice: row.unitPrice ?? 0,
    currency: "PEN",
    source: row.source ?? "",
    performance,
    performanceUnit: unit,
    performanceRate: buildPerformanceRate(performance, unit),
    apuRows: [],
    isEditing: true,
    isNew: true,
    isDirty: true,
  };
}

function sortEditablePartidas(rows: EditableCatalogPartida[]) {
  return [...rows].sort((left, right) => {
    const descriptionComparison = left.description.localeCompare(right.description);
    if (descriptionComparison !== 0) {
      return descriptionComparison;
    }

    return left.unit.localeCompare(right.unit);
  });
}

function getPartidasFilterSummary(filter: string, apuFilter: ApuFilter, filteredCount: number) {
  const trimmedFilter = filter.trim();
  const apuLabel = getApuFilterLabel(apuFilter).toLowerCase();

  if (trimmedFilter && apuFilter !== "ALL") {
    return `Mostrando ${filteredCount} coincidencias ${apuLabel} para "${trimmedFilter}"`;
  }

  if (trimmedFilter) {
    return `Mostrando ${filteredCount} coincidencias para "${trimmedFilter}"`;
  }

  if (apuFilter !== "ALL") {
    return `Mostrando ${filteredCount} partidas ${apuLabel}`;
  }

  return "Vista general del catalogo de partidas";
}

function getApuFilterLabel(apuFilter: ApuFilter) {
  if (apuFilter === "WITH_APU") return "Con APU";
  if (apuFilter === "WITHOUT_APU") return "Sin APU";
  return "Todos los APU";
}

function isPreloadedPartida(row: EditableCatalogPartida) {
  return row.source === "Catalogo de partidas precargado";
}

function SaveBadge({
  dirtyCount,
  lastSavedAt,
  isSaving,
}: {
  dirtyCount: number;
  lastSavedAt: string | null;
  isSaving: boolean;
}) {
  const state = isSaving ? "saving" : dirtyCount > 0 ? "dirty" : "idle";

  return (
    <SaveStateBadge
      state={state}
      lastSavedLabel={lastSavedAt ? `Ultimo guardado: ${new Date(lastSavedAt).toLocaleTimeString("es-PE")}` : null}
      compact
      bordered
      className="min-w-[152px]"
    />
  );
}

function PartidaPastePreviewSheet({
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
      <div className={cn("mx-auto mt-10 w-[min(1100px,calc(100%-2rem))] overflow-hidden border bg-[var(--app-surface)]", isExcelMode ? "rounded-md border-[var(--app-border-strong)] shadow-[0_12px_28px_-24px_rgba(15,23,42,0.18)]" : "rounded-3xl border-[var(--app-border)] shadow-2xl")}>
        <div className="flex items-start justify-between border-b border-[var(--app-border)] px-6 py-5">
          <div>
            <p className="text-sm text-[var(--app-text-muted)]">Previsualizacion de importacion</p>
            <h3 className="text-2xl font-semibold text-[var(--app-text-strong)]">Revisa antes de aplicar</h3>
            <p className="mt-1 text-sm text-[var(--app-text-muted)]">
              Se prepararan {pendingPaste.rows.length} {pendingPaste.rows.length === 1 ? "partida" : "partidas"} desde el archivo Excel.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>

        <div className="max-h-[56vh] overflow-auto px-6 py-5">
          <div className={getTableFrameClassName(isExcelMode)}>
            <Table>
              <THead>
                <TR className="bg-[var(--app-surface-muted)] hover:bg-[var(--app-surface-muted)]">
                  <TH>PARTIDA</TH>
                  <TH>UNIDAD</TH>
                  <TH className="text-right">P. UNITARIO</TH>
                  <TH className="text-right">RENDIMIENTO</TH>
                  <TH>FUENTE</TH>
                </TR>
              </THead>
              <TBody>
                {previewRows.map((row, index) => (
                  <TR key={index}>
                    <TD>{row.description ?? "-"}</TD>
                    <TD>{row.unit ?? "-"}</TD>
                    <TD className="text-right tabular-nums">{row.unitPrice ?? "-"}</TD>
                    <TD className="text-right tabular-nums">{row.performance ?? "-"}</TD>
                    <TD>{row.source ?? "-"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[var(--app-border)] px-6 py-4">
          <p className="text-sm text-[var(--app-text-muted)]">La importacion solo se aplicara al confirmar.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button onClick={onConfirm}>Aplicar importacion</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function parsePartidaRowsFromWorkbook(file: File) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  for (const worksheet of workbook.worksheets) {
    const rows = worksheet.getSheetValues().slice(1);
    const matrix = rows
      .map((row) => normalizeWorksheetRow(row))
      .filter((row) => row.some((cell) => cell.trim().length > 0));

    const headerIndex = matrix.findIndex((row) => looksLikePartidaHeader(row));
    const headerMap = headerIndex >= 0 ? buildPartidaHeaderMap(matrix[headerIndex]) : null;
    const dataRows = (headerIndex >= 0 ? matrix.slice(headerIndex + 1) : matrix).filter((row) => looksLikePartidaDataRow(row));
    const parsedRows = dataRows.map((row) => parsePartidaWorkbookDataRow(row, headerMap)).filter((row): row is PartidaPasteRow => row !== null);

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

function looksLikePartidaHeader(row: string[]) {
  const normalized = row.map((cell) => normalizeHeaderCell(cell));
  return (
    normalized.some((cell) => ["descripcion", "description", "partida", "detalle"].includes(cell)) &&
    normalized.some((cell) => ["unidad", "unit", "und"].includes(cell)) &&
    normalized.some((cell) => ["preciounitario", "precio", "punitario", "pu", "unitprice"].includes(cell))
  );
}

function buildPartidaHeaderMap(row: string[]) {
  const headerMap: Partial<Record<"description" | "unit" | "unitPrice" | "performance" | "source", number>> = {};

  row.forEach((cell, index) => {
    const normalized = normalizeHeaderCell(cell);

    if (["descripcion", "description", "partida", "detalle"].includes(normalized)) headerMap.description = index;
    if (["unidad", "unit", "und"].includes(normalized)) headerMap.unit = index;
    if (["preciounitario", "precio", "punitario", "pu", "unitprice"].includes(normalized)) headerMap.unitPrice = index;
    if (["rendimiento", "performance", "rend"].includes(normalized)) headerMap.performance = index;
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

function looksLikePartidaDataRow(row: string[]) {
  const joined = row.join(" ").trim().toLowerCase();
  if (!joined) return false;

  if (/^(catalogo|listado de partidas|proyecto:|cliente:|ubicacion:|fecha:|moneda:)/.test(joined)) {
    return false;
  }

  return row.filter((cell) => cell.trim().length > 0).length >= 2;
}

function parsePartidaWorkbookDataRow(
  row: string[],
  headerMap: Partial<Record<"description" | "unit" | "unitPrice" | "performance" | "source", number>> | null,
): PartidaPasteRow | null {
  if (headerMap) {
    const description = getWorkbookCell(row, headerMap.description);
    const unit = getWorkbookCell(row, headerMap.unit);
    const unitPrice = parseSpreadsheetNumber(getWorkbookCell(row, headerMap.unitPrice));
    const performance = parseSpreadsheetNumber(getWorkbookCell(row, headerMap.performance));

    if (!description && !unit && unitPrice === 0 && performance === 0) return null;

    return {
      description,
      unit,
      unitPrice,
      performance: performance || 1,
      source: getWorkbookCell(row, headerMap.source),
    };
  }

  const description = row[0]?.trim() ?? "";
  const unit = row[1]?.trim() ?? "";
  const unitPrice = parseSpreadsheetNumber(row[2] ?? "");
  const performance = parseSpreadsheetNumber(row[3] ?? "");
  const source = row[4]?.trim() ?? "";

  if (!description && !unit) return null;

  return {
    description,
    unit,
    unitPrice,
    performance: performance || 1,
    source,
  };
}

function getWorkbookCell(row: string[], index: number | undefined) {
  if (index === undefined) return "";
  return row[index]?.trim() ?? "";
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
