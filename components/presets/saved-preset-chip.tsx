"use client";

import { motion } from "framer-motion";
import { Bookmark, GripVertical, Trash2 } from "lucide-react";
import type React from "react";

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

  return (
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
        onClick={() => onDelete(preset.id)}
        className="ml-0.5 rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-slate-200 hover:text-slate-500 group-hover:opacity-100 focus:opacity-100 focus:outline-none"
        aria-label={`Eliminar preset "${preset.name}"`}
        title="Eliminar preset"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </motion.div>
  );
}
