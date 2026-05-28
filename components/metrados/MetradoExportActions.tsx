"use client";

import { FileDown, FileUp, Save, SendHorizontal } from "lucide-react";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

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
}: MetradoExportActionsProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const busy = actionState === "saving";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onSaveDraft} disabled={!canSave || busy}>
        <Save className="mr-2 h-4 w-4" />
        {busy ? "Guardando" : "Guardar"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={!canImport || busy}
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUp className="mr-2 h-4 w-4" />
        Importar
      </Button>
      {exportHref ? (
        <a
          href={exportHref}
          aria-disabled={busy}
          className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <FileDown className="mr-2 h-4 w-4" />
          Exportar
        </a>
      ) : (
        <Button size="sm" variant="outline" disabled>
          <FileDown className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={onSendToPartida} disabled={!canSend || busy}>
        <SendHorizontal className="mr-2 h-4 w-4" />
        Enviar
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
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
