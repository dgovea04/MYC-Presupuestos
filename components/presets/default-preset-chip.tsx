import { Pen, Sparkles } from "lucide-react";

import type { DatePreset } from "@/lib/resumen-date-presets";

export type DefaultPresetChipProps = {
  preset: DatePreset;
  index: number;
  isActive: boolean;
  onClick: (preset: DatePreset) => void;
};

export function DefaultPresetChip({ preset, index, isActive, onClick }: DefaultPresetChipProps) {
  const isCustom = preset.id === "default-custom";

  return (
    <button
      type="button"
      onClick={() => onClick(preset)}
      className={[
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium shadow-sm transition",
        isActive
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : isCustom
            ? "border-dashed border-slate-300/70 bg-white text-slate-500 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-700"
            : "border-slate-200/80 bg-slate-50/80 text-slate-500 hover:border-slate-300 hover:bg-white hover:text-slate-700",
      ].join(" ")}
      title={`${preset.name} — Alt+${index + 1}`}
    >
      {isCustom ? (
        <Pen className="h-3 w-3 shrink-0" />
      ) : (
        <Sparkles className="h-3 w-3 shrink-0" />
      )}
      {preset.name}
      <kbd className="ml-0.5 rounded border border-slate-300/50 bg-white/70 px-1 text-[9px] font-normal text-slate-400">
        Alt+{index + 1}
      </kbd>
    </button>
  );
}
