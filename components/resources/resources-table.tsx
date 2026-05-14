"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ExcelJS from "exceljs";
import { Plus } from "lucide-react";
import type { ResourceCategory, ResourcePatchFields, ResourcePatchResult, ResourceRecord, ResourceStatePatch } from "@/types/resource";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperationalPanel } from "@/components/ui/operational-surfaces";
import { SaveStateBadge } from "@/components/ui/save-state-badge";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";
type EditableColumn = "code" | "description" | "unit" | "unitPrice" | "category" | "iu" | "source";
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

const editableColumnOrder: EditableColumn[] = ["code", "description", "unit", "unitPrice", "category", "iu", "source"];
const resourceCodePrefixes: Record<ResourceCategory, string> = {
  MATERIAL: "MAT",
  LABOR: "MO",
  EQUIPMENT: "EQ",
  TOOLS: "HER",
};

export function ResourcesTable({ resources, companyId }: { resources: ResourceRecord[]; companyId?: string }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<EditableResource[]>(() => resources.map((resource) => toEditableResource(resource)));
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState("ALL");
  const [error, setError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [saveClock, setSaveClock] = useState(() => Date.now());
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [pendingPaste, setPendingPaste] = useState<PendingPaste | null>(null);
  const [feedback, setFeedback] = useState("");
  const baseRowsRef = useRef(new Map(resources.map((resource) => [resource.id, resource])));

  const filtered = useMemo(
    () =>
      rows.filter((resource) => {
        const matchesCategory = category === "ALL" || resource.category === category;
        const text = `${resource.code} ${resource.description} ${resource.iu ?? ""}`.toLowerCase();
        return matchesCategory && text.includes(filter.toLowerCase());
      }),
    [category, filter, rows],
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

  function updateDraft(id: string, patch: Partial<EditableResource>) {
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

  function addBlankRow() {
    setRows((current) =>
      applyGeneratedCodes([
        ...current,
        createEditableDraft(companyId, {
          description: "",
          unit: "",
          unitPrice: 0,
          category: "MATERIAL",
          iu: "",
        }),
      ]),
    );
  }

  async function persistRow(resource: EditableResource) {
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
  }

  async function saveRow(resource: EditableResource) {
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
  }

  async function saveAllDirtyRows() {
    const rowsToSave = rows.filter((row) => row.isDirty || row.isNew);
    const patch = buildResourcesBatchPatch(rowsToSave, baseRowsRef.current, companyId);
    if (!patch) return;

    setError("");
    setPendingIds(rowsToSave.map((row) => row.id));

    try {
      const response = await fetch("/api/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "No se pudieron guardar los cambios");
      }

      const result = (await response.json()) as ResourcePatchResult;
      reconcilePatchResult(result);
      updateLastSavedAt(result.savedAt);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los cambios");
    } finally {
      setPendingIds((current) => current.filter((id) => !rowsToSave.some((row) => row.id === id)));
    }
  }

  async function duplicateRow(resource: EditableResource) {
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
  }

  async function removeRow(id: string) {
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
  }

  function reconcilePatchResult(result: ResourcePatchResult) {
    for (const entry of result.created) {
      baseRowsRef.current.set(entry.resource.id, entry.resource);
    }

    for (const resource of result.updated) {
      baseRowsRef.current.set(resource.id, resource);
    }

    for (const id of result.deleted) {
      baseRowsRef.current.delete(id);
    }

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
  }

  function updateLastSavedAt(savedAt: string) {
    const nextSavedAt = Date.parse(savedAt);
    if (Number.isNaN(nextSavedAt)) return;

    setLastSavedAt(nextSavedAt);
    setSaveClock(nextSavedAt);
  }

  function cancelRow(id: string) {
    setRows((current) =>
      current.flatMap((row) => {
        if (row.id !== id) return [row];
        if (row.isNew) return [];

        const base = baseRowsRef.current.get(id);
        return base ? [toEditableResource(base)] : [row];
      }),
    );
  }

  function handlePaste(event: React.ClipboardEvent<HTMLElement>, targetId: string, startColumn: EditableColumn) {
    const pastedRows = parsePastedResourceRows(event.clipboardData.getData("text"), startColumn);
    if (!pastedRows) return;

    event.preventDefault();
    setPendingPaste({
      rows: pastedRows,
      previewRows: simulatePastedPreviewRows(rows, companyId, targetId, pastedRows),
      targetId,
      startColumn,
    });
  }

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
        description="Busca, filtra y actualiza insumos del catálogo general sin salir de la tabla."
        metrics={
          <>
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">
              {filtered.length} {filtered.length === 1 ? "insumo" : "insumos"}
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-600">
              {rows.length} total
            </span>
          </>
        }
        controls={
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 md:grid-cols-[1fr_220px]">
              <Input placeholder="Buscar por código, insumo o IU" value={filter} onChange={(event) => setFilter(event.target.value)} />
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="ALL">Todas las categorías</option>
                <option value="MATERIAL">Materiales</option>
                <option value="LABOR">Mano de obra</option>
                <option value="EQUIPMENT">Equipos</option>
              </Select>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-slate-500">
                {filter.trim() ? `Mostrando ${filtered.length} coincidencias para "${filter}"` : "Vista general del catálogo de insumos"}
              </p>
              <div className="flex flex-wrap gap-2">
                <SaveStateBadge state={derivedSaveState} lastSavedLabel={formatLastSavedLabel(lastSavedAt, saveClock)} savedLabel="Guardado" className="min-w-[152px]" />
                <Button variant="default" onClick={addBlankRow} className="gap-2 shadow-sm shadow-sky-950/10">
                  <Plus className="h-4 w-4" />
                  Crear insumo
                </Button>
                <Button variant="outline" className="bg-white" onClick={() => fileInputRef.current?.click()}>
                  Importar Excel
                </Button>
                <Button variant="secondary" onClick={() => void saveAllDirtyRows()} disabled={dirtyCount === 0 || pendingIds.length > 0}>
                  {dirtyCount > 0 ? `Guardar cambios (${dirtyCount})` : "Sin cambios"}
                </Button>
              </div>
            </div>
          </div>
        }
      />

      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => void handleImportFile(event)} />

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      {feedback ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</p> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="max-h-[68vh] overflow-auto">
          <Table>
            <THead className="sticky top-0 z-20 [&_tr]:border-b-slate-200">
              <TR className="bg-slate-50 hover:bg-slate-50">
                <TH>CÓDIGO</TH>
                <TH>INSUMO</TH>
                <TH>UNIDAD</TH>
                <TH>PRECIO</TH>
                <TH>CATEGORÍA</TH>
                <TH>IU</TH>
                <TH>FUENTE</TH>
                <TH className="text-right">ACCIONES</TH>
              </TR>
            </THead>
            <TBody>
            {filtered.map((resource) => {
              const isOwned = !!resource.companyId || resource.isNew;
              const isPending = pendingIds.includes(resource.id);

              return (
                <TR key={resource.id} className={resource.isNew ? "bg-emerald-50/60" : resource.isDirty ? "bg-amber-50/50" : ""}>
                  <TD>
                    <Input
                      value={resource.code || "Auto"}
                      readOnly
                      onPaste={(event) => handlePaste(event, resource.id, "code")}
                      className="border-transparent bg-slate-50 px-2 font-medium tabular-nums text-slate-700 shadow-none"
                    />
                  </TD>
                  <TD>
                    <Input
                      value={resource.description}
                      disabled={!resource.isEditing}
                      onPaste={(event) => handlePaste(event, resource.id, "description")}
                      onChange={(event) => updateDraft(resource.id, { description: event.target.value })}
                      className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                    />
                  </TD>
                  <TD>
                    <Input
                      value={resource.unit}
                      disabled={!resource.isEditing}
                      onPaste={(event) => handlePaste(event, resource.id, "unit")}
                      onChange={(event) => updateDraft(resource.id, { unit: event.target.value })}
                      className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                    />
                  </TD>
                  <TD>
                    <Input
                      type="number"
                      step="0.01"
                      value={resource.unitPrice}
                      disabled={!resource.isEditing}
                      onPaste={(event) => handlePaste(event, resource.id, "unitPrice")}
                      onChange={(event) => updateDraft(resource.id, { unitPrice: Number(event.target.value) })}
                      className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                    />
                  </TD>
                  <TD>
                    <Select
                      value={resource.category}
                      disabled={!resource.isEditing}
                      onPaste={(event) => handlePaste(event, resource.id, "category")}
                      onChange={(event) => updateDraft(resource.id, { category: event.target.value as ResourceCategory })}
                      className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                    >
                      <option value="MATERIAL">Materiales</option>
                      <option value="LABOR">Mano de obra</option>
                      <option value="EQUIPMENT">Equipos</option>
                    </Select>
                  </TD>
                  <TD>
                    <Input
                      value={resource.iu ?? ""}
                      disabled={!resource.isEditing}
                      onPaste={(event) => handlePaste(event, resource.id, "iu")}
                      onChange={(event) => updateDraft(resource.id, { iu: event.target.value })}
                      className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                    />
                  </TD>
                  <TD>
                    <Input
                      value={resource.source ?? ""}
                      disabled={!resource.isEditing}
                      onPaste={(event) => handlePaste(event, resource.id, "source")}
                      onChange={(event) => updateDraft(resource.id, { source: event.target.value })}
                      className={!resource.isEditing ? "border-transparent bg-transparent px-0 shadow-none" : undefined}
                    />
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-2">
                      {resource.isEditing ? (
                        <>
                          <ActionButton action="save" label="Guardar" size="sm" variant="secondary" disabled={isPending} onClick={() => void saveRow(resource)} />
                          <ActionButton action="cancel" label="Cancelar" size="sm" variant="ghost" disabled={isPending} onClick={() => cancelRow(resource.id)} />
                        </>
                      ) : (
                        <>
                          <ActionButton
                            action="edit"
                            label="Editar"
                            size="sm"
                            variant="ghost"
                            disabled={!isOwned || isPending}
                            onClick={() => startEditing(resource.id)}
                          />
                          <ActionButton
                            action="duplicate"
                            label="Duplicar"
                            size="sm"
                            variant="ghost"
                            disabled={isPending}
                            onClick={() => void duplicateRow(resource)}
                          />
                          <ActionButton
                            action="delete"
                            label="Eliminar"
                            size="sm"
                            variant="ghost"
                            disabled={!isOwned || isPending}
                            onClick={() => void removeRow(resource.id)}
                          />
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

      <PastePreviewSheet pendingPaste={pendingPaste} onClose={closePastePreview} onConfirm={applyPendingPaste} />
    </div>
  );
}

function PastePreviewSheet({
  pendingPaste,
  onClose,
  onConfirm,
}: {
  pendingPaste: PendingPaste | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!pendingPaste) return null;

  const previewRows = pendingPaste.previewRows.slice(0, 20);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-sm">
      <div className="mx-auto mt-10 w-[min(1100px,calc(100%-2rem))] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm text-slate-500">Previsualización de pegado</p>
            <h3 className="text-2xl font-semibold text-slate-900">Revisa antes de aplicar</h3>
            <p className="mt-1 text-sm text-slate-500">
              Se prepararán {pendingPaste.rows.length} {pendingPaste.rows.length === 1 ? "insumo" : "insumos"} desde la columna{" "}
              <span className="font-medium text-slate-700">{pendingPaste.startColumn}</span>.
            </p>
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
        </div>

        <div className="max-h-[56vh] overflow-auto px-6 py-5">
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <Table>
              <THead>
                <TR className="bg-slate-50 hover:bg-slate-50">
                  <TH>CÓDIGO</TH>
                  <TH>INSUMO</TH>
                  <TH>UNIDAD</TH>
                  <TH className="text-right">PRECIO</TH>
                  <TH>CATEGORÍA</TH>
                  <TH>IU</TH>
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
                    <TD>{row.source ?? "-"}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-slate-500">El pegado solo se aplicará al confirmar.</p>
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

function toEditableResource(resource: ResourceRecord): EditableResource {
  return {
    ...resource,
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
    iu: row.iu ?? "",
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

function buildResourcesBatchPatch(
  rowsToSave: EditableResource[],
  baseRows: Map<string, ResourceRecord>,
  fallbackCompanyId?: string,
): ResourceStatePatch | null {
  const create: ResourceStatePatch["create"] = [];
  const update: ResourceStatePatch["update"] = [];

  for (const row of rowsToSave) {
    const patch = buildResourcePatch(row.isNew ? null : (baseRows.get(row.id) ?? null), row, fallbackCompanyId);
    if (!patch) continue;
    create.push(...patch.create);
    update.push(...patch.update);
  }

  if (!create.length && !update.length) return null;

  return {
    create,
    update,
    delete: [],
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
    iu: resource.iu ?? "",
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
    iu: row.iu ?? resource.iu,
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

        draft[column] = cell.trim();
      });

      return draft;
    })
    .filter((row) => Object.values(row).some((value) => value !== undefined && value !== ""));
}

async function parseResourceRowsFromWorkbook(file: File) {
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
    if (["iu", "indiceunificado"].includes(normalized)) headerMap.iu = index;
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
      iu: getWorkbookCell(row, headerMap.iu),
      source: getWorkbookCell(row, headerMap.source),
    };
  }

  const code = row[0]?.trim() ?? "";
  const description = row[1]?.trim() ?? "";
  const thirdValue = row[2]?.trim() ?? "";
  const fourthValue = row[3]?.trim() ?? "";
  const fifthValue = row[4]?.trim() ?? "";
  const sixthValue = row[5]?.trim() ?? "";

  const category = isCategoryLike(fifthValue) ? normalizeResourceCategory(fifthValue) : "MATERIAL";
  const unit = thirdValue;
  const unitPrice = parseSpreadsheetNumber(fourthValue);
  const iu = sixthValue;

  if (!code && !description) return null;

  return {
    code,
    description,
    category,
    unit,
    unitPrice,
    iu,
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
  ].includes(normalized);
}

function getCategoryLabel(category: ResourceCategory | undefined) {
  if (category === "LABOR") return "Mano de obra";
  if (category === "EQUIPMENT") return "Equipos";
  return "Materiales";
}

function formatLastSavedLabel(lastSavedAt: number | null, currentTime: number) {
  if (!lastSavedAt) return null;

  const seconds = Math.max(0, Math.floor((currentTime - lastSavedAt) / 1000));
  if (seconds < 60) {
    return `Último guardado hace ${seconds} ${seconds === 1 ? "segundo" : "segundos"}`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Último guardado hace ${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
  }

  const hours = Math.floor(minutes / 60);
  return `Último guardado hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
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
