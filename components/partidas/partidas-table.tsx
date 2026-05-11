"use client";

import { useMemo, useState } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { PartidaApuSheet } from "@/components/partidas/partida-apu-sheet";
import { useFormattingSettings } from "@/components/providers/formatting-settings-provider";
import { formatCurrency } from "@/lib/utils";
import type { CatalogPartidaPatchFields, CatalogPartidaPatchResult, CatalogPartidaRecord, CatalogPartidaStatePatch } from "@/types/partida";
import type { ResourceRecord } from "@/types/resource";

type EditableCatalogPartida = CatalogPartidaRecord & {
  isEditing?: boolean;
  isNew?: boolean;
  isDirty?: boolean;
};

export function PartidasTable({
  partidas,
  resourcesCatalog,
}: {
  partidas: CatalogPartidaRecord[];
  resourcesCatalog: ResourceRecord[];
}) {
  const { currencyDecimals } = useFormattingSettings();
  const [rows, setRows] = useState<EditableCatalogPartida[]>(() => partidas.map(toEditablePartida));
  const [filter, setFilter] = useState("");
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const text = `${row.description} ${row.unit} ${row.performanceRate ?? ""}`.toLowerCase();
        return text.includes(filter.toLowerCase());
      }),
    [filter, rows],
  );

  const dirtyRows = rows.filter((row) => row.isDirty || row.isNew);
  const selectedPartida = rows.find((row) => row.id === selectedId) ?? null;

  function patchRow(id: string, changes: Partial<EditableCatalogPartida>) {
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
  }

  function startEditing(id: string) {
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
  }

  function cancelRow(id: string) {
    setRows((current) =>
      current.flatMap((row) => {
        if (row.id !== id) return [row];
        if (row.isNew) return [];

        const base = partidas.find((partida) => partida.id === id);
        return base ? [toEditablePartida(base)] : [row];
      }),
    );
  }

  function addBlankRow() {
    const id = crypto.randomUUID();
    setRows((current) => [
      ...current,
      {
        id,
        description: "",
        unit: "",
        unitPrice: 0,
        currency: "PEN",
        source: "Catalogo de partidas precargado",
        performance: 1,
        performanceUnit: "",
        performanceRate: "1.0000",
        apuRows: [],
        isDirty: true,
        isEditing: true,
        isNew: true,
      },
    ]);
    setSelectedId(id);
  }

  function duplicateRow(id: string) {
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
  }

  async function saveAllDirtyRows() {
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
  }

  async function removeRow(id: string) {
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
    setError("");
    setFeedback("");

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
      setFeedback("Partida eliminada del catalogo.");
      if (selectedId === id) {
        setSelectedId(null);
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "No se pudo eliminar la partida");
    } finally {
      setPendingIds((current) => current.filter((currentId) => currentId !== id));
    }
  }

  function reconcilePatchResult(result: CatalogPartidaPatchResult) {
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
  }

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <Input
            placeholder="Buscar partida, unidad o rendimiento"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="md:max-w-xl"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SaveBadge dirtyCount={dirtyRows.length} lastSavedAt={lastSavedAt} isSaving={pendingIds.length > 0} />
          <Button variant="outline" onClick={addBlankRow}>
            Nueva partida
          </Button>
          <Button onClick={saveAllDirtyRows} disabled={!dirtyRows.length || pendingIds.length > 0}>
            {pendingIds.length > 0 ? "Guardando..." : dirtyRows.length > 0 ? `Guardar cambios (${dirtyRows.length})` : "Sin cambios"}
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
        <span>{rows.length} partidas en catalogo</span>
        <span>{dirtyRows.length} pendientes</span>
        {lastSavedAt ? <span>Ultimo guardado: {new Date(lastSavedAt).toLocaleTimeString("es-PE")}</span> : null}
      </div>

      {error ? <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {feedback ? <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="max-h-[68vh] overflow-auto">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[42%]" />
              <col className="w-[92px]" />
              <col className="w-[140px]" />
              <col className="w-[170px]" />
              <col className="w-[84px]" />
              <col className="w-[320px]" />
            </colgroup>
            <THead className="sticky top-0 z-20 [&_tr]:border-b-slate-200">
              <TR className="bg-slate-50 hover:bg-slate-50">
                <TH className="text-xs uppercase tracking-wide">Partida</TH>
                <TH className="text-xs uppercase tracking-wide">Unidad</TH>
                <TH className="text-xs uppercase tracking-wide text-right">P. Unitario</TH>
                <TH className="text-xs uppercase tracking-wide">Rendimiento</TH>
                <TH className="text-xs uppercase tracking-wide">APU</TH>
                <TH className="text-right text-xs uppercase tracking-wide">Acciones</TH>
              </TR>
            </THead>
            <TBody>
            {filteredRows.map((row) => {
              const isLockedPreloaded = isPreloadedPartida(row) && !row.isNew;
              const isReadonly = !row.isEditing;
              const isPending = pendingIds.includes(row.id);

              return (
                <TR key={row.id} className={row.isNew ? "bg-emerald-50/60" : row.isDirty ? "bg-amber-50/50" : ""}>
                  <TD className="align-top">
                    <Input
                      value={row.description}
                      readOnly={isReadonly}
                      onChange={(event) => patchRow(row.id, { description: event.target.value })}
                      className={isReadonly ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                    />
                  </TD>
                  <TD className="align-top">
                    <Input
                      value={row.unit}
                      readOnly={isReadonly}
                      onChange={(event) => patchRow(row.id, { unit: event.target.value })}
                      className={isReadonly ? "border-transparent bg-transparent px-0 shadow-none text-center" : "text-center"}
                    />
                  </TD>
                  <TD className="align-top text-right font-medium tabular-nums text-slate-900">
                    {formatCurrency(row.unitPrice, row.currency, currencyDecimals)}
                  </TD>
                  <TD className="align-top">
                    {isReadonly ? (
                      <span className="text-sm text-slate-600">{row.performanceRate ?? buildPerformanceRate(row.performance, row.performanceUnit ?? row.unit)}</span>
                    ) : (
                      <Input
                        type="number"
                        step="0.0001"
                        value={row.performance}
                        onChange={(event) =>
                          patchRow(row.id, {
                            performance: Number(event.target.value),
                            performanceRate: buildPerformanceRate(Number(event.target.value), row.performanceUnit ?? row.unit),
                          })
                        }
                      />
                    )}
                  </TD>
                  <TD className="align-top text-sm text-slate-500">{row.apuRows.length} filas</TD>
                  <TD className="align-top">
                    <div className="flex justify-end gap-2">
                      <ActionButton action="open" label="Ver APU" size="sm" variant="outline" onClick={() => setSelectedId(row.id)} />
                      {row.isEditing ? (
                        <>
                          <ActionButton action="save" label="Guardar" size="sm" variant="secondary" disabled={isPending} onClick={() => void saveAllDirtyRows()} />
                          <ActionButton action="cancel" label="Cancelar" size="sm" variant="ghost" disabled={isPending} onClick={() => cancelRow(row.id)} />
                        </>
                      ) : (
                        <>
                          <ActionButton action="edit" label="Editar" size="sm" variant="ghost" disabled={isLockedPreloaded} onClick={() => startEditing(row.id)} />
                          <ActionButton action="duplicate" label="Duplicar" size="sm" variant="ghost" disabled={isPending} onClick={() => duplicateRow(row.id)} />
                          <ActionButton action="delete" label="Eliminar" size="sm" variant="ghost" disabled={isLockedPreloaded || isPending} onClick={() => void removeRow(row.id)} />
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              );
            })}
            </TBody>
          </Table>
        </div>
      </div>

      <PartidaApuSheet
        open={Boolean(selectedPartida)}
        partida={selectedPartida}
        resourcesCatalog={resourcesCatalog}
        onClose={() => setSelectedId(null)}
        onChange={(partida) => patchRow(partida.id, partida)}
      />
    </>
  );
}

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
  const label = isSaving ? "Guardando..." : dirtyCount > 0 ? "Cambios pendientes" : "Sin cambios";
  const tone = isSaving
    ? "bg-sky-100 text-sky-700"
    : dirtyCount > 0
      ? "bg-amber-100 text-amber-700"
      : "bg-slate-100 text-slate-600";

  return (
    <span className={`inline-flex min-w-[152px] flex-col rounded-full px-3 py-2 text-xs font-medium ${tone}`}>
      <span>{label}</span>
      {lastSavedAt ? (
        <span className="mt-0.5 text-[11px] font-normal opacity-80">
          Ultimo guardado: {new Date(lastSavedAt).toLocaleTimeString("es-PE")}
        </span>
      ) : null}
    </span>
  );
}
