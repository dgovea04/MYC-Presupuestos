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
}: {
  context: AiContext;
  onChange: (context: AiContext) => void;
}) {
  return (
    <aside className="rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--app-text-strong)]">Contexto de trabajo</p>
        <p className="text-sm leading-6 text-[var(--app-text-muted)]">Estos datos guian la respuesta de Khipu para el modulo actual.</p>
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
    <label className="grid gap-1.5 text-sm font-medium text-[var(--app-text)]">
      {label}
      <Input className="h-9" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
