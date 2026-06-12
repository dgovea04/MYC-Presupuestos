"use client";

import { CheckSquare, Copy, FolderOpen, GripHorizontal, PencilLine, Plus, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { useAppViewMode } from "@/components/view-mode/app-view-mode-provider";
import { getTableFrameClassName } from "@/components/view-mode/view-mode-styles";
import { cn, formatNumber } from "@/lib/utils";
import type {
  MetradoFormulaInputKey,
  MetradoFormulaRecord,
  MetradoRowRecord,
  MetradoUnit,
} from "@/types/metrado";

const units = ["m", "m2", "m3", "kg", "und", "glb", "p2", "ml", "pza", "bol", "gal", "ton", "mes", "día", "viaje", "pto", "jgo", "pln", "mll"] as const satisfies MetradoUnit[];

type ActiveCellField = "sector" | "eje" | "nivel" | "description" | MetradoFormulaInputKey;

export type MetradoActiveCell = {
  rowId: string;
  field: ActiveCellField;
};

type BatchAction = "apply_formula" | "fill_down" | "delete";

/** Describes a drag-fill operation in progress */
type DragFillState = {
  sourceRowId: string;
  field: string;
  /** The raw value to fill (string for text cells, undefined | number for numeric) */
  rawValue: string | number | undefined;
  /** true = calls onInputChange, false = calls onPatchRow */
  isInput: boolean;
  /** Row IDs currently being targeted (excludes source) */
  targetRowIds: string[];
};

type MetradoSheetTableProps = {
  rows: MetradoRowRecord[];
  formulas: MetradoFormulaRecord[];
  inputColumns: MetradoFormulaInputKey[];
  activeCell: MetradoActiveCell | null;
  selectedRowIds: ReadonlySet<string>;
  onActiveCellChange: (cell: MetradoActiveCell) => void;
  onAddRow: () => void;
  onDuplicateRow: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onPatchRow: (rowId: string, patch: Partial<Pick<MetradoRowRecord, "sector" | "eje" | "nivel" | "description" | "unit" | "formulaKey">>) => void;
  onInputChange: (rowId: string, key: MetradoFormulaInputKey, value: string) => void;
  onAddGroupRow: () => void;
  onChangeGroupLabel?: (rowId: string, label: string) => void;
  onSelectionChange: (rowIds: Set<string>) => void;
  onBatchAction: (action: BatchAction) => void;
};

export function MetradoSheetTable({
  rows,
  formulas,
  inputColumns,
  activeCell,
  selectedRowIds,
  onActiveCellChange,
  onAddRow,
  onDuplicateRow,
  onDeleteRow,
  onPatchRow,
  onInputChange,
  onAddGroupRow,
  onChangeGroupLabel,
  onSelectionChange,
  onBatchAction,
}: MetradoSheetTableProps) {
  const { isExcelMode } = useAppViewMode();
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [dragFill, setDragFill] = useState<DragFillState | null>(null);
  const dragFillRef = useRef<DragFillState | null>(null);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const normalRowIdsByIndex = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row, index) => {
      if (!row.groupLabel) {
        map.set(index, row.id);
      }
    });
    return map;
  }, [rows]);

  // Drag-fill: use live refs to avoid stale closures in document event handlers
  const onInputChangeRef = useRef(onInputChange);
  const onPatchRowRef = useRef(onPatchRow);
  const rowsRef = useRef(rows);
  const normalRowIdsByIndexRef = useRef(normalRowIdsByIndex);
  // Sync refs after every render so the pointer-enter handlers always have fresh values
  useEffect(() => {
    onInputChangeRef.current = onInputChange;
    onPatchRowRef.current = onPatchRow;
    rowsRef.current = rows;
    normalRowIdsByIndexRef.current = normalRowIdsByIndex;
  });

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const state = dragFillRef.current;
      if (!state) return;

      // elementFromPoint finds the actual element under the pointer
      // (unlike event.target which may be the pointer-capture target)
      const el = document.elementFromPoint(event.clientX, event.clientY);
      if (!el) return;

      let target = el as HTMLElement | null;
      while (target && target.tagName !== "TR") {
        target = target.parentElement;
      }

      const rowId = target?.getAttribute("data-row-id");
      if (!rowId || rowId === state.sourceRowId) return;

      const currentRows = rowsRef.current;
      const targetRow = currentRows.find((r) => r.id === rowId);
      if (targetRow?.groupLabel) return;

      const sourceIndex = currentRows.findIndex((r) => r.id === state.sourceRowId);
      const targetIndex = currentRows.findIndex((r) => r.id === rowId);
      if (sourceIndex === -1 || targetIndex === -1) return;

      const [start, end] =
        sourceIndex < targetIndex
          ? [sourceIndex + 1, targetIndex]
          : [targetIndex, sourceIndex - 1];

      const idxMap = normalRowIdsByIndexRef.current;
      const targetIds: string[] = [];
      for (let i = start; i <= end; i++) {
        const id = idxMap.get(i);
        if (id) targetIds.push(id);
      }

      dragFillRef.current = { ...state, targetRowIds: targetIds };
      // Trigger re-render for visual highlighting
      setDragFill(dragFillRef.current);
    }

    function handlePointerUp() {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);

      const state = dragFillRef.current;
      if (!state) return;

      const currentOnInputChange = onInputChangeRef.current;
      const currentOnPatchRow = onPatchRowRef.current;

      for (const targetRowId of state.targetRowIds) {
        if (state.isInput) {
          currentOnInputChange(targetRowId, state.field, String(state.rawValue ?? ""));
        } else {
          const raw = String(state.rawValue ?? "");
          // Only patch known text fields
          if (state.field === "sector" || state.field === "eje" || state.field === "nivel" || state.field === "description") {
            currentOnPatchRow(targetRowId, {
              [state.field]: raw,
            } as Partial<Pick<MetradoRowRecord, "sector" | "eje" | "nivel" | "description">>);
          }
        }
      }

      dragFillRef.current = null;
      setDragFill(null);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, []); // empty deps: handlers read refs, never stale

  function startDragFill(
    sourceRowId: string,
    field: string,
    rawValue: string | number | undefined,
    isInput: boolean,
  ) {
    const state: DragFillState = {
      sourceRowId,
      field,
      rawValue,
      isInput,
      targetRowIds: [],
    };
    dragFillRef.current = state;
    setDragFill(state);
  }

  const subtotals = useMemo(() => {
    const groups: Array<{ label: string; subtotal: number; index: number; rowId: string }> = [];
    let currentGroupSum = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.groupLabel) {
        groups.push({ label: row.groupLabel, subtotal: currentGroupSum, index: i, rowId: row.id });
        currentGroupSum = 0;
      } else {
        currentGroupSum += row.partial;
      }
    }

    return groups;
  }, [rows]);

  const allNormalSelected = useMemo(
    () =>
      normalRowIdsByIndex.size > 0 &&
      rows.filter((row) => !row.groupLabel).every((row) => selectedRowIds.has(row.id)),
    [normalRowIdsByIndex.size, rows, selectedRowIds],
  );

  function toggleSelectRow(rowId: string, event?: React.MouseEvent) {
    const next = new Set(selectedRowIds);
    const isShift = event?.shiftKey;

    if (isShift && lastClickedIndex !== null) {
      const normalRows = rows.filter((r) => !r.groupLabel);
      const clickedIdx = normalRows.findIndex((r) => r.id === rowId);
      if (clickedIdx !== -1 && lastClickedIndex !== -1) {
        const [start, end] = clickedIdx > lastClickedIndex
          ? [lastClickedIndex, clickedIdx]
          : [clickedIdx, lastClickedIndex];
        for (let i = start; i <= end; i++) {
          const normalRow = normalRows[i];
          if (normalRow) next.add(normalRow.id);
        }
      }
    } else {
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
    }

    if (!isShift) {
      const normalRows = rows.filter((r) => !r.groupLabel);
      setLastClickedIndex(normalRows.findIndex((r) => r.id === rowId));
    }

    onSelectionChange(next);
  }

  function toggleSelectAll() {
    if (allNormalSelected) {
      onSelectionChange(new Set());
    } else {
      const next = new Set(rows.filter((row) => !row.groupLabel).map((row) => row.id));
      onSelectionChange(next);
    }
  }

  const hasSelection = selectedRowIds.size > 0;

  // Determine drag targets for visual highlighting (includes source row for continuous look)
  const dragTargetSet = useMemo(() => {
    if (!dragFill) return null;
    const ids = new Set(dragFill.targetRowIds);
    ids.add(dragFill.sourceRowId);
    return ids;
  }, [dragFill]);

  return (
    <div className={getTableFrameClassName(isExcelMode)}>
      <div className={cn("flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3", isExcelMode && "px-3 py-2")}>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Hoja de metrado</h3>
          <p className="text-xs text-slate-500">
            {rows.length} filas
            {hasSelection && ` · ${selectedRowIds.size} seleccionadas`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasSelection ? (
            <div className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1">
              <span className="mr-1 text-xs font-medium text-blue-700">
                {selectedRowIds.size} sel.
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-blue-700 hover:bg-blue-100"
                onClick={() => onBatchAction("apply_formula")}
                title="Aplicar formula a seleccion"
              >
                Formula
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-blue-700 hover:bg-blue-100"
                onClick={() => onBatchAction("fill_down")}
                title="Llenar hacia abajo desde la primera fila seleccionada"
              >
                Rellenar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-100"
                onClick={() => onBatchAction("delete")}
                title="Eliminar filas seleccionadas"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Eliminar
              </Button>
            </div>
          ) : null}
          <Button size="sm" variant="outline" onClick={onAddGroupRow}>
            <Plus className="mr-2 h-4 w-4" />
            Grupo
          </Button>
          <Button size="sm" variant="outline" onClick={onAddRow}>
            <Plus className="mr-2 h-4 w-4" />
            Fila
          </Button>
        </div>
      </div>
      <div className="max-h-[62vh] overflow-auto">
        <Table className={cn("min-w-[1320px] table-fixed text-xs", isExcelMode && "w-full min-w-[1180px]")}>
          <THead className={cn("sticky top-0 z-20", isExcelMode ? "bg-slate-100" : "bg-slate-50")}>
            <TR className={cn(isExcelMode ? "bg-slate-100/90 hover:bg-slate-100" : "bg-slate-50 hover:bg-slate-50")}>
              <TH className="w-10 text-center">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center justify-center text-slate-500 transition hover:text-slate-700"
                  aria-label={allNormalSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                  title={allNormalSelected ? "Deseleccionar todo" : "Seleccionar todo"}
                >
                  {allNormalSelected ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </TH>
              <TH className="w-10 text-center">#</TH>
              <TH className="w-20">Sector</TH>
              <TH className="w-16">Eje</TH>
              <TH className="w-16">Nivel</TH>
              <TH className="w-72">Descripcion</TH>
              <TH className="w-36">Formula</TH>
              <TH className="w-20">Und</TH>
              {inputColumns.map((key) => (
                <TH key={key} className="w-24 text-right">
                  {key}
                </TH>
              ))}
              <TH className="w-28 text-right">Parcial</TH>
              <TH className="w-24 text-center">Acciones</TH>
            </TR>
          </THead>
          <TBody ref={tableBodyRef}>
            {rows.map((row) =>
              row.groupLabel ? (
                <GroupRow
                  key={row.id}
                  row={row}
                  subtotal={subtotals.find((g) => g.rowId === row.id)?.subtotal ?? 0}
                  inputColumns={inputColumns}
                  onDeleteRow={onDeleteRow}
                  onChangeLabel={(label) => onChangeGroupLabel?.(row.id, label)}
                />
              ) : (
                <NormalRow
                  key={row.id}
                  row={row}
                  formulas={formulas}
                  inputColumns={inputColumns}
                  units={units}
                  activeCell={activeCell}
                  selected={selectedRowIds.has(row.id)}
                  dragHighlighted={dragTargetSet?.has(row.id) ?? false}
                  onSelect={(event) => toggleSelectRow(row.id, event)}
                  onActiveCellChange={onActiveCellChange}
                  onPatchRow={onPatchRow}
                  onInputChange={onInputChange}
                  onDuplicateRow={onDuplicateRow}
                  onDeleteRow={onDeleteRow}
                  onDragFillStart={(field, rawValue, isInput, pointerEvent) =>
                    startDragFill(row.id, field, rawValue, isInput, pointerEvent)
                  }
                />
              ),
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DragHandle — small visible handle at the bottom-right of a cell    */
/* ------------------------------------------------------------------ */

function DragHandle({ onPointerDown }: { onPointerDown: (event: React.PointerEvent) => void }) {
  return (
    <div
      className="absolute -bottom-px -right-px z-10 h-3 w-3 cursor-ns-resize rounded-bl-sm bg-slate-400/80 transition-all hover:h-4 hover:w-4 hover:bg-blue-500 active:bg-blue-600"
      onPointerDown={onPointerDown}
      aria-hidden
    >
      <GripHorizontal className="h-full w-full rotate-90 p-[1.5px] text-white" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TextCell                                                           */
/* ------------------------------------------------------------------ */

function TextCell({
  ariaLabel,
  value,
  active,
  onFocus,
  onChange,
  onDragFillStart,
}: {
  ariaLabel: string;
  value: string;
  active: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
  onDragFillStart?: (event: React.PointerEvent) => void;
}) {
  return (
    <TD className="relative px-1 py-1 group">
      <Input
        aria-label={ariaLabel}
        value={value}
        onFocus={onFocus}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={cn("h-8 rounded-md border-transparent px-2 text-xs", active && "border-sky-500 bg-sky-50")}
      />
      {active && onDragFillStart ? (
        <DragHandle onPointerDown={(e) => onDragFillStart(e)} />
      ) : null}
    </TD>
  );
}

/* ------------------------------------------------------------------ */
/*  NumericCell                                                        */
/* ------------------------------------------------------------------ */

function NumericCell({
  ariaLabel,
  value,
  active,
  onFocus,
  onChange,
  onDragFillStart,
}: {
  ariaLabel: string;
  value: number | undefined;
  active: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
  onDragFillStart?: (event: React.PointerEvent) => void;
}) {
  return (
    <TD className="relative px-1 py-1 group">
      <Input
        aria-label={ariaLabel}
        type="number"
        value={value ?? ""}
        step="0.001"
        inputMode="decimal"
        onFocus={onFocus}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={cn(
          "h-8 rounded-md border-transparent px-2 text-right text-xs tabular-nums",
          active && "border-sky-500 bg-sky-50",
        )}
      />
      {active && onDragFillStart ? (
        <DragHandle onPointerDown={(e) => onDragFillStart(e)} />
      ) : null}
    </TD>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isActive(activeCell: MetradoActiveCell | null, rowId: string, field: ActiveCellField) {
  return activeCell?.rowId === rowId && activeCell.field === field;
}

/* ------------------------------------------------------------------ */
/*  GroupRow                                                           */
/* ------------------------------------------------------------------ */

function GroupRow({
  row,
  subtotal,
  inputColumns,
  onDeleteRow,
  onChangeLabel,
}: {
  row: MetradoRowRecord;
  subtotal: number;
  inputColumns: readonly MetradoFormulaInputKey[];
  onDeleteRow: (rowId: string) => void;
  onChangeLabel?: (label: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(row.groupLabel ?? "");

  function handleSave() {
    const trimmed = editValue.trim();
    onChangeLabel?.(trimmed || "Nuevo grupo");
    setIsEditing(false);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSave();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditValue(row.groupLabel ?? "");
      setIsEditing(false);
    }
  }

  return (
    <TR data-row-id={row.id} className="bg-slate-50/80">
      <TD className="px-2 py-2" />
      <TD className="px-2 py-2 text-center text-xs text-slate-400" colSpan={2}>
        <FolderOpen className="inline h-3.5 w-3.5 text-amber-500" />
      </TD>
      <TD className="px-2 py-2" colSpan={4}>
        {isEditing ? (
          <Input
            value={editValue}
            onChange={(event) => setEditValue(event.currentTarget.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            className="h-7 rounded-md border-sky-300 bg-white px-2 text-xs font-semibold text-slate-700"
            autoFocus
            aria-label="Nombre del grupo"
          />
        ) : (
          <button
            type="button"
            className="group flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={() => {
              setEditValue(row.groupLabel ?? "");
              setIsEditing(true);
            }}
            aria-label="Editar nombre del grupo"
          >
            <span className="truncate">{row.groupLabel}</span>
            <PencilLine className="h-3 w-3 shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100" />
          </button>
        )}
      </TD>
      <TD className="px-2 py-2" />
      {inputColumns.map((key) => (
        <TD key={key} className="px-2 py-2" />
      ))}
      <TD className="px-2 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
        {formatNumber(subtotal, 3)}
      </TD>
      <TD className="px-2 py-2">
        <div className="flex justify-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 px-0 text-rose-600 hover:bg-rose-50"
            aria-label="Eliminar grupo"
            onClick={() => onDeleteRow(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TD>
    </TR>
  );
}

/* ------------------------------------------------------------------ */
/*  NormalRow                                                          */
/* ------------------------------------------------------------------ */

function NormalRow({
  row,
  formulas,
  inputColumns,
  units,
  activeCell,
  selected,
  dragHighlighted,
  onSelect,
  onActiveCellChange,
  onPatchRow,
  onInputChange,
  onDuplicateRow,
  onDeleteRow,
  onDragFillStart,
}: {
  row: MetradoRowRecord;
  formulas: readonly MetradoFormulaRecord[];
  inputColumns: readonly MetradoFormulaInputKey[];
  units: readonly MetradoUnit[];
  activeCell: MetradoActiveCell | null;
  selected: boolean;
  dragHighlighted: boolean;
  onSelect: (event: React.MouseEvent) => void;
  onActiveCellChange: (cell: MetradoActiveCell) => void;
  onPatchRow: (rowId: string, patch: Partial<Pick<MetradoRowRecord, "sector" | "eje" | "nivel" | "description" | "unit" | "formulaKey">>) => void;
  onInputChange: (rowId: string, key: MetradoFormulaInputKey, value: string) => void;
  onDuplicateRow: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onDragFillStart: (field: string, rawValue: string | number | undefined, isInput: boolean, event: React.PointerEvent) => void;
}) {
  return (
    <TR
      data-row-id={row.id}
      className={cn(
        selected && "bg-blue-50/60",
        dragHighlighted && !selected && "bg-blue-50/30",
      )}
    >
      <TD className="w-10 px-2 py-1 text-center">
        <button
          type="button"
          onClick={onSelect}
          className="inline-flex items-center justify-center text-slate-400 transition hover:text-blue-600"
          aria-label={selected ? `Deseleccionar fila ${row.sortOrder}` : `Seleccionar fila ${row.sortOrder}`}
        >
          {selected ? (
            <CheckSquare className="h-4 w-4 text-blue-600" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      </TD>
      <TD className="px-2 py-1 text-center text-xs text-slate-400">{row.sortOrder}</TD>
      <TextCell
        ariaLabel={`Sector fila ${row.sortOrder}`}
        value={row.sector}
        active={isActive(activeCell, row.id, "sector")}
        onFocus={() => onActiveCellChange({ rowId: row.id, field: "sector" })}
        onChange={(value) => onPatchRow(row.id, { sector: value })}
        onDragFillStart={(e) => onDragFillStart("sector", row.sector, false, e)}
      />
      <TextCell
        ariaLabel={`Eje fila ${row.sortOrder}`}
        value={row.eje}
        active={isActive(activeCell, row.id, "eje")}
        onFocus={() => onActiveCellChange({ rowId: row.id, field: "eje" })}
        onChange={(value) => onPatchRow(row.id, { eje: value })}
        onDragFillStart={(e) => onDragFillStart("eje", row.eje, false, e)}
      />
      <TextCell
        ariaLabel={`Nivel fila ${row.sortOrder}`}
        value={row.nivel}
        active={isActive(activeCell, row.id, "nivel")}
        onFocus={() => onActiveCellChange({ rowId: row.id, field: "nivel" })}
        onChange={(value) => onPatchRow(row.id, { nivel: value })}
        onDragFillStart={(e) => onDragFillStart("nivel", row.nivel, false, e)}
      />
      <TextCell
        ariaLabel={`Descripcion fila ${row.sortOrder}`}
        value={row.description}
        active={isActive(activeCell, row.id, "description")}
        onFocus={() => onActiveCellChange({ rowId: row.id, field: "description" })}
        onChange={(value) => onPatchRow(row.id, { description: value })}
        onDragFillStart={(e) => onDragFillStart("description", row.description, false, e)}
      />
      <TD className="px-1 py-1">
        <Select
          aria-label={`Formula fila ${row.sortOrder}`}
          value={row.formulaKey}
          portal={false}
          className="h-8 rounded-md text-xs"
          onChange={(event) =>
            onPatchRow(row.id, { formulaKey: event.currentTarget.value })
          }
        >
          {formulas.map((formula) => (
            <option key={formula.key} value={formula.key}>
              {formula.label}
            </option>
          ))}
        </Select>
      </TD>
      <TD className="px-1 py-1">
        <Select
          aria-label={`Unidad fila ${row.sortOrder}`}
          value={row.unit}
          portal={false}
          className="h-8 rounded-md text-xs"
          onChange={(event) => onPatchRow(row.id, { unit: event.currentTarget.value as MetradoUnit })}
        >
          {units.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </Select>
      </TD>
      {inputColumns.map((key) => (
        <NumericCell
          key={key}
          ariaLabel={`${key} fila ${row.sortOrder}`}
          value={row.inputs[key]}
          active={isActive(activeCell, row.id, key)}
          onFocus={() => onActiveCellChange({ rowId: row.id, field: key })}
          onChange={(value) => onInputChange(row.id, key, value)}
          onDragFillStart={(e) => onDragFillStart(key, row.inputs[key], true, e)}
        />
      ))}
      <TD className="px-2 py-1 text-right font-semibold tabular-nums text-slate-900">
        {formatNumber(row.partial, 3)}
      </TD>
      <TD className="px-2 py-1">
        <div className="flex justify-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 px-0"
            aria-label="Duplicar fila"
            onClick={() => onDuplicateRow(row.id)}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 px-0 text-rose-600 hover:bg-rose-50"
            aria-label="Eliminar fila"
            onClick={() => onDeleteRow(row.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TD>
    </TR>
  );
}
