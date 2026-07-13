"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "framer-motion";
import { AlertTriangle, Bookmark, GripVertical, Trash2, X } from "lucide-react";
import { useState } from "react";
import type React from "react";

import { Button } from "@/components/ui/button";

import type { DatePreset } from "@/lib/resumen-date-presets";

const chipClasses = {
  base: "group inline-flex items-center gap-0 rounded-md border px-1 py-1 text-[11px] font-medium shadow-sm transition",
  dragging: "border-blue-300 bg-blue-50/60 text-blue-600 opacity-50",
  dropTarget: "border-blue-400 bg-blue-50 text-blue-700 ring-1 ring-blue-300",
  active: "border-blue-200 bg-blue-50 text-blue-700",
  idle: "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
};

export function chipClassName({
  isDragging,
  isDropTarget,
  isActive,
}: {
  isDragging: boolean;
  isDropTarget: boolean;
  isActive: boolean;
}): string {
  if (isDragging) return `${chipClasses.base} ${chipClasses.dragging}`;
  if (isDropTarget) return `${chipClasses.base} ${chipClasses.dropTarget}`;
  if (isActive) return `${chipClasses.base} ${chipClasses.active}`;
  return `${chipClasses.base} ${chipClasses.idle}`;
}

export type SavedPresetChipProps = {
  preset: DatePreset;
  index: number;
  presets: DatePreset[];
  showDefaults: boolean;
  isActive: boolean;
  dragIndex: number | null;
  dropTargetIndex: number | null;
  onApply: (preset: DatePreset) => void;
  onDelete: (presetId: string) => void;
  onDragIndexChange: (index: number | null) => void;
  onDropTargetChange: (index: number | null) => void;
  onReorder: (presets: DatePreset[]) => void;
};

export function SavedPresetChip({
  preset,
  index,
  presets,
  showDefaults,
  isActive,
  dragIndex,
  dropTargetIndex,
  onApply,
  onDelete,
  onDragIndexChange,
  onDropTargetChange,
  onReorder,
}: SavedPresetChipProps) {
  const shortcutIndex = showDefaults ? index + 5 : index + 1;
  const isDragging = dragIndex === index;
  const isDropTarget = dropTargetIndex === index;
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.5 }}
      draggable="true"
      onDragStart={(event) => {
        const dragEvent = event as unknown as React.DragEvent<HTMLDivElement>;
        dragEvent.dataTransfer.effectAllowed = "move";
        dragEvent.dataTransfer.setData("text/plain", preset.id);
        onDragIndexChange(index);
      }}
      onDragOver={(event) => {
        const dragEvent = event as unknown as React.DragEvent<HTMLDivElement>;
        event.preventDefault();
        dragEvent.dataTransfer.dropEffect = "move";
        if (dragIndex !== index) {
          onDropTargetChange(index);
        }
      }}
      onDragLeave={(event) => {
        if (
          event.relatedTarget &&
          event.currentTarget.contains(event.relatedTarget as Node)
        ) {
          return;
        }
        if (dropTargetIndex === index) {
          onDropTargetChange(null);
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (dragIndex === null || dragIndex === index) {
          onDragIndexChange(null);
          onDropTargetChange(null);
          return;
        }

        const next = [...presets];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(index, 0, moved);
        onReorder(next);
        onDragIndexChange(null);
        onDropTargetChange(null);
      }}
      onDragEnd={() => {
        onDragIndexChange(null);
        onDropTargetChange(null);
      }}
      className={chipClassName({ isDragging, isDropTarget, isActive })}
      title={`${preset.name} (${preset.dateFrom || "-"} → ${preset.dateTo || "-"}) — Alt+${shortcutIndex}`}
    >
      {/* Drag handle */}
      <span
        className="inline-flex cursor-grab items-center justify-center rounded p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
        aria-label={`Arrastrar "${preset.name}"`}
      >
        <GripVertical className="h-3 w-3" />
      </span>

      <button
        type="button"
        onClick={() => onApply(preset)}
        className="flex items-center gap-1 px-1"
      >
        <Bookmark className="h-3 w-3 shrink-0" />
        <span className="max-w-24 truncate">{preset.name}</span>
        <kbd className="rounded border border-slate-300/50 bg-white/70 px-1 text-[9px] font-normal text-slate-400">
          Alt+{shortcutIndex}
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => setDeleteOpen(true)}
        className="ml-0.5 rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-slate-200 hover:text-slate-500 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
        aria-label={`Eliminar preset "${preset.name}"`}
        title="Eliminar preset"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </motion.div>

      <Dialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,380px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)] outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-semibold text-[var(--app-text-strong)]">
                  Eliminar preset
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">
                  Se eliminara el preset <span className="font-medium text-[var(--app-text)]">{preset.name}</span>.
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
                El preset se eliminara de forma permanente.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onDelete(preset.id);
                  setDeleteOpen(false);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar preset
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
