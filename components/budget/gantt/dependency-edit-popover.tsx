"use client";

import { memo, useState } from "react";
import type { WorkSchedulePredecessorRelation } from "@/lib/work-schedule/predecessors";

export type DependencyEditPopoverProps = {
  sourceCode: string;
  targetCode: string;
  currentRelation: WorkSchedulePredecessorRelation;
  currentLagDays: number;
  /** Position relative to the timeline container */
  x: number;
  y: number;
  onSave: (relation: WorkSchedulePredecessorRelation, lagDays: number) => void;
  onDelete: () => void;
  onClose: () => void;
};

const RELATIONS: WorkSchedulePredecessorRelation[] = ["FS", "SS", "FF", "SF"];

export const DependencyEditPopover = memo(function DependencyEditPopover({
  sourceCode,
  targetCode,
  currentRelation,
  currentLagDays,
  x,
  y,
  onSave,
  onDelete,
  onClose,
}: DependencyEditPopoverProps) {
  const [relation, setRelation] = useState<WorkSchedulePredecessorRelation>(currentRelation);
  const [lagDays, setLagDays] = useState(String(currentLagDays));
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className="absolute z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
      style={{ left: x + 12, top: y - 20 }}
      data-testid="dependency-edit-popover"
    >
      <div className="mb-2 text-[11px] font-semibold text-slate-700">
        {sourceCode} → {targetCode}
      </div>

      {/* Relation buttons */}
      <div className="mb-2 flex gap-1">
        {RELATIONS.map((relationOption) => (
          <button
            key={relationOption}
            type="button"
            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
              relation === relationOption
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
            onClick={() => setRelation(relationOption)}
            data-testid={`edit-relation-${relationOption}`}
          >
            {relationOption}
          </button>
        ))}
      </div>

      {/* Lag days */}
      <div className="mb-3 flex items-center gap-1.5">
        <label className="text-[10px] font-medium text-slate-500">Lag</label>
        <input
          type="number"
          className="w-14 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-800"
          value={lagDays}
          onChange={(event_) => setLagDays(event_.target.value)}
          data-testid="edit-relation-lag-input"
        />
        <span className="text-[10px] text-slate-400">días</span>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5">
        <button
          type="button"
          className="flex-1 rounded-md bg-sky-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-sky-700"
          onClick={() => onSave(relation, Number(lagDays) || 0)}
          data-testid="save-dependency-btn"
        >
          Guardar
        </button>
        {confirmDelete ? (
          <>
            <button
              type="button"
              className="rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-700"
              onClick={onDelete}
              data-testid="confirm-delete-dependency-btn"
            >
              Eliminar
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
              onClick={() => setConfirmDelete(false)}
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-100"
              onClick={() => setConfirmDelete(true)}
              data-testid="delete-dependency-btn"
            >
              Eliminar
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
              onClick={onClose}
              data-testid="close-dependency-edit-btn"
            >
              Cerrar
            </button>
          </>
        )}
      </div>
    </div>
  );
});
