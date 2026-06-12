"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, Eye, EyeOff, X } from "lucide-react";

import { DefaultPresetChip } from "@/components/presets/default-preset-chip";
import { SavedPresetChip } from "@/components/presets/saved-preset-chip";
import type { DatePreset } from "@/lib/resumen-date-presets";
import {
  getDefaultPresets,
  loadShowDefaults,
  saveShowDefaults,
} from "@/lib/resumen-date-presets";

const PRESETS_STORAGE_KEY_PREFIX = "myc-metrado-date-presets-";

function loadPresets(projectId: string): DatePreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY_PREFIX + projectId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((p) => typeof p === "object" && p && "id" in p && "name" in p)) {
      return parsed as DatePreset[];
    }
    return [];
  } catch {
    return [];
  }
}

function savePresets(projectId: string, presets: DatePreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY_PREFIX + projectId, JSON.stringify(presets));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function ResumenDateFilter({
  projectId,
  activeDateFrom,
  activeDateTo,
  filteredCount,
}: {
  projectId: string;
  activeDateFrom: string;
  activeDateTo: string;
  filteredCount: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dateFrom, setDateFrom] = useState(activeDateFrom);
  const [dateTo, setDateTo] = useState(activeDateTo);
  const [presets, setPresets] = useState<DatePreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [showDefaults, setShowDefaults] = useState(() => loadShowDefaults(projectId));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const desdeRef = useRef<HTMLInputElement>(null);

  // Default presets computed from today's date (stable across renders)
  const defaultPresets = useMemo(() => getDefaultPresets(), []);

  // Combined list of all keyboard-accessible presets: defaults first, then saved
  const allPresets = useMemo(
    () => (showDefaults ? [...defaultPresets, ...presets] : [...presets]),
    [defaultPresets, presets, showDefaults],
  );

  // Keep refs so the effect can run once without stale closures
  const handleApplyPresetRef = useRef(handleApplyPreset);
  const savingPresetRef = useRef(savingPreset);
  const setSavingPresetRef = useRef(setSavingPreset);
  const allPresetsRef = useRef(allPresets);

  const applyFilter = useCallback(
    (from: string, to: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("projectId", projectId);
      if (from) params.set("dateFrom", from);
      else params.delete("dateFrom");
      if (to) params.set("dateTo", to);
      else params.delete("dateTo");
      router.push(`/metrados-avanzados/resumen?${params.toString()}`);
    },
    [projectId, router, searchParams],
  );

  // Keep refs for the clear-filter action so the effect can use them
  const setDateFromRef = useRef(setDateFrom);
  const setDateToRef = useRef(setDateTo);
  const applyFilterRef = useRef(applyFilter);

  // Sync refs after every render so the keyboard effect always has fresh values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    handleApplyPresetRef.current = handleApplyPreset;
    savingPresetRef.current = savingPreset;
    setSavingPresetRef.current = setSavingPreset;
    allPresetsRef.current = allPresets;
    setDateFromRef.current = setDateFrom;
    setDateToRef.current = setDateTo;
    applyFilterRef.current = applyFilter;
  });

  // Keyboard shortcuts: Alt+N for each preset, Alt+0 to clear filter
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!event.altKey) return;

      // Alt+0 — clear filter
      if (event.key === "0") {
        event.preventDefault();
        if (savingPresetRef.current) setSavingPresetRef.current(false);
        setDateFromRef.current("");
        setDateToRef.current("");
        applyFilterRef.current("", "");
        return;
      }

      // Alt+1..N — apply preset
      const index = parseInt(event.key, 10);
      if (index >= 1 && allPresetsRef.current[index - 1]) {
        event.preventDefault();
        if (savingPresetRef.current) setSavingPresetRef.current(false);
        handleApplyPresetRef.current(allPresetsRef.current[index - 1]);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset drag state on blur (covers case where onDragEnd doesn't fire)
  useEffect(() => {
    const reset = () => {
      setDragIndex(null);
      setDropTargetIndex(null);
    };
    window.addEventListener("blur", reset);
    return () => window.removeEventListener("blur", reset);
  }, []);

  // Load user presets from localStorage on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPresets(loadPresets(projectId));
  }, [projectId]);

  const hasActiveFilters = !!activeDateFrom || !!activeDateTo;
  const isActiveDifference = activeDateFrom !== dateFrom || activeDateTo !== dateTo;

  function handleSavePreset() {
    const name = presetName.trim();
    if (!name || (!activeDateFrom && !activeDateTo)) return;

    const newPreset: DatePreset = {
      id: `preset-${Date.now()}`,
      name,
      dateFrom: activeDateFrom,
      dateTo: activeDateTo,
    };

    const next = [...presets, newPreset];
    setPresets(next);
    savePresets(projectId, next);
    setSavingPreset(false);
    setPresetName("");
  }

  function handleDeletePreset(presetId: string) {
    const next = presets.filter((p) => p.id !== presetId);
    setPresets(next);
    savePresets(projectId, next);
  }

  function handleApplyPreset(preset: DatePreset) {
    // 'default-custom' is a special preset that clears local inputs and focuses them
    // for free-range selection. No navigation needed — user clicks "Aplicar" afterwards.
    if (preset.id === "default-custom") {
      setDateFrom("");
      setDateTo("");
      setTimeout(() => desdeRef.current?.focus(), 0);
      return;
    }

    setDateFrom(preset.dateFrom);
    setDateTo(preset.dateTo);
    applyFilter(preset.dateFrom, preset.dateTo);
  }

  function startSavePreset() {
    setSavingPreset(true);
    setPresetName("");
    // Focus the input on next tick
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-slate-500">Desde</label>
          <input
            ref={desdeRef}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.currentTarget.value)}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Filtrar desde fecha"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[11px] font-medium text-slate-500">Hasta</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.currentTarget.value)}
            className="h-7 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            aria-label="Filtrar hasta fecha"
          />
        </div>

        {/* Apply button */}
        {isActiveDifference ? (
          <button
            type="button"
            onClick={() => applyFilter(dateFrom, dateTo)}
            className="h-7 rounded-md bg-blue-600 px-3 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            Aplicar
          </button>
        ) : null}

        {/* Filter count */}
        {hasActiveFilters ? (
          <span className="text-[11px] text-slate-400">
            {filteredCount} hoja{filteredCount !== 1 ? "s" : ""}
          </span>
        ) : null}

        {/* Clear */}
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              applyFilter("", "");
            }}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 transition hover:text-blue-800"
            title="Limpiar filtro — Alt+0"
          >
            Limpiar
            <kbd className="rounded border border-blue-200/60 bg-blue-50 px-1 text-[9px] font-normal text-blue-400">
              Alt+0
            </kbd>
          </button>
        ) : null}

        {/* Save preset — only when a filter is active */}
        {hasActiveFilters && !savingPreset ? (
          <button
            type="button"
            onClick={startSavePreset}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"
            title="Guardar filtro como preset"
          >
            <Bookmark className="h-3 w-3" />
            Guardar preset
          </button>
        ) : null}

        {/* Inline save-preset form */}
        {savingPreset ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={nameInputRef}
              type="text"
              value={presetName}
              onChange={(e) => setPresetName(e.currentTarget.value)}
              placeholder="Nombre del preset (ej: Ene-Mar 2026)"
              className="h-7 w-48 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSavePreset();
                if (e.key === "Escape") setSavingPreset(false);
              }}
            />
            <button
              type="button"
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
              className="h-7 rounded-md bg-blue-600 px-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-40"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setSavingPreset(false)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      {/* Presets row: defaults + saved */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Default presets (shown only when toggled on) */}
        {showDefaults
          ? defaultPresets.map((preset, idx) => {
              const isCustom = preset.id === "default-custom";
              const isActive =
                !isCustom && activeDateFrom === preset.dateFrom && activeDateTo === preset.dateTo;

              return (
                <DefaultPresetChip
                  key={preset.id}
                  preset={preset}
                  index={idx}
                  isActive={isActive}
                  onClick={handleApplyPreset}
                />
              );
            })
          : null}

        {/* Toggle button for default presets */}
        <button
          type="button"
          onClick={() => {
            const next = !showDefaults;
            setShowDefaults(next);
            saveShowDefaults(projectId, next);
          }}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200/60 bg-slate-50/50 px-2 py-1 text-[11px] font-medium text-slate-400 shadow-sm transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-600"
          title={showDefaults ? "Ocultar presets por defecto" : "Mostrar presets por defecto"}
        >
          {showDefaults ? (
            <EyeOff className="h-3 w-3 shrink-0" />
          ) : (
            <Eye className="h-3 w-3 shrink-0" />
          )}
          {showDefaults ? "Ocultar" : "Mostrar"}
        </button>

        {/* Divider between defaults and saved presets */}
        {presets.length > 0 ? (
          <span className="mx-0.5 h-5 w-px bg-slate-200" aria-hidden />
        ) : null}

        {/* Saved presets (draggable, with layout animation) */}
        {presets.map((preset, idx) => {
          const isActive =
            activeDateFrom === preset.dateFrom && activeDateTo === preset.dateTo;

          return (
            <SavedPresetChip
              key={preset.id}
              preset={preset}
              index={idx}
              presets={presets}
              showDefaults={showDefaults}
              isActive={isActive}
              dragIndex={dragIndex}
              dropTargetIndex={dropTargetIndex}
              onApply={handleApplyPreset}
              onDelete={handleDeletePreset}
              onDragIndexChange={setDragIndex}
              onDropTargetChange={setDropTargetIndex}
              onReorder={(next) => {
                setPresets(next);
                savePresets(projectId, next);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
