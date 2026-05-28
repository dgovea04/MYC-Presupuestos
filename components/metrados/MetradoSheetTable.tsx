"use client";

import { Copy, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { cn, formatNumber } from "@/lib/utils";
import type {
  MetradoFormulaInputKey,
  MetradoFormulaKey,
  MetradoRowRecord,
  MetradoUnit,
} from "@/types/metrado";

const inputColumns = [
  "largo",
  "ancho",
  "alto",
  "cantidad",
  "longitud",
  "pesoUnitario",
  "perimetro",
  "altura",
  "area",
  "factor",
  "manual",
] as const satisfies MetradoFormulaInputKey[];

const units = ["m", "m2", "m3", "kg", "und", "glb"] as const satisfies MetradoUnit[];

type ActiveCellField = "sector" | "eje" | "nivel" | "description" | MetradoFormulaInputKey;

export type MetradoActiveCell = {
  rowId: string;
  field: ActiveCellField;
};

type MetradoSheetTableProps = {
  rows: MetradoRowRecord[];
  formulaKeys: MetradoFormulaKey[];
  activeCell: MetradoActiveCell | null;
  onActiveCellChange: (cell: MetradoActiveCell) => void;
  onAddRow: () => void;
  onDuplicateRow: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
  onPatchRow: (rowId: string, patch: Partial<Pick<MetradoRowRecord, "sector" | "eje" | "nivel" | "description" | "unit" | "formulaKey">>) => void;
  onInputChange: (rowId: string, key: MetradoFormulaInputKey, value: string) => void;
};

export function MetradoSheetTable({
  rows,
  formulaKeys,
  activeCell,
  onActiveCellChange,
  onAddRow,
  onDuplicateRow,
  onDeleteRow,
  onPatchRow,
  onInputChange,
}: MetradoSheetTableProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Hoja de metrado</h3>
          <p className="text-xs text-slate-500">{rows.length} filas</p>
        </div>
        <Button size="sm" variant="outline" onClick={onAddRow}>
          <Plus className="mr-2 h-4 w-4" />
          Fila
        </Button>
      </div>
      <div className="max-h-[62vh] overflow-auto" data-view-mode="excel">
        <Table className="min-w-[1680px] table-fixed text-xs">
          <THead className="sticky top-0 z-20 bg-slate-900 text-white">
            <TR className="border-slate-800 hover:bg-slate-900">
              <TH className="w-12 bg-slate-900 text-center text-slate-200">#</TH>
              <TH className="w-28 bg-slate-900 text-slate-200">Sector</TH>
              <TH className="w-24 bg-slate-900 text-slate-200">Eje</TH>
              <TH className="w-24 bg-slate-900 text-slate-200">Nivel</TH>
              <TH className="w-64 bg-slate-900 text-slate-200">Descripcion</TH>
              <TH className="w-36 bg-slate-900 text-slate-200">Formula</TH>
              <TH className="w-24 bg-slate-900 text-slate-200">Und</TH>
              {inputColumns.map((key) => (
                <TH key={key} className="w-24 bg-slate-900 text-right text-slate-200">
                  {key}
                </TH>
              ))}
              <TH className="w-28 bg-slate-900 text-right text-slate-200">Parcial</TH>
              <TH className="w-28 bg-slate-900 text-center text-slate-200">Acciones</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.id} className="h-11">
                <TD className="px-2 py-1 text-center text-xs text-slate-400">{row.sortOrder}</TD>
                <TextCell
                  ariaLabel={`Sector fila ${row.sortOrder}`}
                  value={row.sector}
                  active={isActive(activeCell, row.id, "sector")}
                  onFocus={() => onActiveCellChange({ rowId: row.id, field: "sector" })}
                  onChange={(value) => onPatchRow(row.id, { sector: value })}
                />
                <TextCell
                  ariaLabel={`Eje fila ${row.sortOrder}`}
                  value={row.eje}
                  active={isActive(activeCell, row.id, "eje")}
                  onFocus={() => onActiveCellChange({ rowId: row.id, field: "eje" })}
                  onChange={(value) => onPatchRow(row.id, { eje: value })}
                />
                <TextCell
                  ariaLabel={`Nivel fila ${row.sortOrder}`}
                  value={row.nivel}
                  active={isActive(activeCell, row.id, "nivel")}
                  onFocus={() => onActiveCellChange({ rowId: row.id, field: "nivel" })}
                  onChange={(value) => onPatchRow(row.id, { nivel: value })}
                />
                <TextCell
                  ariaLabel={`Descripcion fila ${row.sortOrder}`}
                  value={row.description}
                  active={isActive(activeCell, row.id, "description")}
                  onFocus={() => onActiveCellChange({ rowId: row.id, field: "description" })}
                  onChange={(value) => onPatchRow(row.id, { description: value })}
                />
                <TD className="px-1 py-1">
                  <Select
                    aria-label={`Formula fila ${row.sortOrder}`}
                    value={row.formulaKey}
                    portal={false}
                    className="h-8 rounded-md text-xs"
                    onChange={(event) =>
                      onPatchRow(row.id, { formulaKey: event.currentTarget.value as MetradoFormulaKey })
                    }
                  >
                    {formulaKeys.map((formulaKey) => (
                      <option key={formulaKey} value={formulaKey}>
                        {formulaKey}
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
            ))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

function TextCell({
  ariaLabel,
  value,
  active,
  onFocus,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  active: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <TD className="px-1 py-1">
      <Input
        aria-label={ariaLabel}
        value={value}
        onFocus={onFocus}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={cn("h-8 rounded-md border-transparent px-2 text-xs", active && "border-sky-500 bg-sky-50")}
      />
    </TD>
  );
}

function NumericCell({
  ariaLabel,
  value,
  active,
  onFocus,
  onChange,
}: {
  ariaLabel: string;
  value: number | undefined;
  active: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <TD className="px-1 py-1">
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
    </TD>
  );
}

function isActive(activeCell: MetradoActiveCell | null, rowId: string, field: ActiveCellField) {
  return activeCell?.rowId === rowId && activeCell.field === field;
}
