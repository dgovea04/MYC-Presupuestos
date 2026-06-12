"use client";

import { FileDown, FileUp, Save, SendHorizontal } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { SaveStateBadge, type SaveStateBadgeStatus } from "@/components/ui/save-state-badge";

type ActionState = "idle" | "saving" | "saved" | "error";

type MetradoExportActionsProps = {
  exportHref: string | null;
  actionState: ActionState;
  canSave: boolean;
  canSend: boolean;
  canImport: boolean;
  onSaveDraft: () => void;
  onImportFile: (file: File) => void;
  onSendToPartida: () => void;
  saveState?: SaveStateBadgeStatus;
  lastSavedLabel?: string | null;
  saveLabel?: string;
};

export function MetradoExportActions({
  exportHref,
  actionState,
  canSave,
  canSend,
  canImport,
  onSaveDraft,
  onImportFile,
  onSendToPartida,
  saveState,
  lastSavedLabel = null,
  saveLabel = "Guardar",
}: MetradoExportActionsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const busy = actionState === "saving";

  return (
    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
      {saveState ? (
        <SaveStateBadge
          state={saveState}
          lastSavedLabel={lastSavedLabel}
          savedLabel="Guardado"
          compact
          bordered
        />
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        onClick={onSaveDraft}
        disabled={!canSave || busy}
        className="h-8 rounded-full px-4 text-[11px] font-semibold tracking-[0.08em] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.35)]"
      >
        <Save className="mr-2 h-4 w-4" />
        {busy ? "Guardando" : saveLabel}
      </Button>

      <div className="flex items-center gap-1 rounded-full border border-slate-200/90 bg-white/90 px-1 py-1 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.22)] transition hover:border-slate-300 hover:bg-white">
        <button
          type="button"
          disabled={!canImport || busy}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-[0.08em] text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50"
        >
          <FileUp className="h-4 w-4" />
          Importar
        </button>
        {exportHref ? (
          <a
            href={exportHref}
            aria-disabled={busy}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-[0.08em] text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Exportar
          </a>
        ) : (
          <button
            type="button"
            disabled
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-[0.08em] text-slate-600 opacity-50"
          >
            <FileDown className="h-4 w-4" />
            Exportar
          </button>
        )}
        <button
          type="button"
          onClick={onSendToPartida}
          disabled={!canSend || busy}
          className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-semibold tracking-[0.08em] text-sky-700 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:pointer-events-none disabled:opacity-50"
        >
          <SendHorizontal className="h-4 w-4" />
          Enviar
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json,.json,.csv,text/csv,text/plain"
        className="hidden"
        aria-label="Importar metrado"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0] ?? null;
          event.currentTarget.value = "";
          if (file) {
            onImportFile(file);
          }
        }}
      />
    </div>
  );
}
