"use client";

import { Input } from "@/components/ui/input";
import type { AiContext } from "@/lib/ai/types";

export type ContextShortcut = {
  label: string;
  description: string;
  onSelect: () => void;
};

export function ContextSidebar({
  context,
  onChange,
  shortcuts = [],
}: {
  context: AiContext;
  onChange: (context: AiContext) => void;
  shortcuts?: ContextShortcut[];
}) {
  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-900">Contexto de trabajo</p>
        <p className="text-sm leading-6 text-slate-500">Estos datos guian la respuesta de Khipu para el modulo actual.</p>
      </div>
      <div className="mt-5 grid gap-3">
        <ContextInput label="Proyecto" value={context.project ?? ""} onChange={(project) => onChange({ ...context, project })} />
        <ContextInput label="Modulo" value={context.module ?? ""} onChange={(module) => onChange({ ...context, module })} />
        <ContextInput
          label="Partida seleccionada"
          value={context.selectedItem ?? ""}
          onChange={(selectedItem) => onChange({ ...context, selectedItem })}
        />
        <ContextInput label="Unidad" value={context.unit ?? ""} onChange={(unit) => onChange({ ...context, unit })} />
        <ContextInput
          label="Costo actual"
          type="number"
          value={typeof context.currentCost === "number" ? String(context.currentCost) : ""}
          onChange={(value) => onChange({ ...context, currentCost: value ? Number(value) : undefined })}
        />
        <ContextInput label="Tabla activa" value={context.activeTable ?? ""} onChange={(activeTable) => onChange({ ...context, activeTable })} />
      </div>
      {shortcuts.length ? (
        <div className="mt-6 border-t border-slate-200 pt-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Siguientes acciones</p>
            <p className="text-sm leading-6 text-slate-500">Cambia de comando sin perder el contexto actual.</p>
          </div>
          <div className="mt-3 grid gap-2">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut.label}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                type="button"
                aria-label={shortcut.label}
                onClick={shortcut.onSelect}
              >
                <span className="block text-sm font-semibold text-slate-900">{shortcut.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{shortcut.description}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function ContextInput({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
  value: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      {label}
      <Input className="h-9" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
