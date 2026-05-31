"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import type { AriaRole, FormEvent } from "react";
import { useState } from "react";
import { BookOpenCheck, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SaveBudgetTemplateButton({
  budgetId,
  budgetName,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  triggerClassName,
  triggerRole,
  onTriggerClick,
}: {
  budgetId: string;
  budgetName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  triggerClassName?: string;
  triggerRole?: AriaRole;
  onTriggerClick?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState(`${budgetName} base`);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const open = controlledOpen ?? internalOpen;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const response = await fetch("/api/templates/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetId,
          name: name.trim(),
          description: description.trim(),
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readApiError(payload));
      }

      setSaved(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo guardar la plantilla");
    } finally {
      setSaving(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (nextOpen) return;

    setError("");
    setSaved(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      {hideTrigger ? null : (
        <Dialog.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            role={triggerRole}
            onClick={onTriggerClick}
            className={cn(
              "h-8 rounded-full px-4 text-[11px] font-semibold tracking-[0.08em] shadow-[0_12px_24px_-20px_rgba(15,23,42,0.24)]",
              triggerClassName,
            )}
          >
            <BookOpenCheck className="mr-2 h-4 w-4" />
            Guardar como plantilla
          </Button>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-950">Guardar plantilla</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-slate-500">
                Captura la estructura, partidas y APU de este presupuesto para reutilizarlo.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Nombre</span>
              <Input
                aria-label="Nombre de plantilla"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Descripcion</span>
              <textarea
                aria-label="Descripcion"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                placeholder="Uso, especialidad o criterio tecnico de esta plantilla"
              />
            </label>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
            {saved ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Plantilla guardada.{" "}
                <Link href="/templates" className="font-semibold underline decoration-emerald-300 underline-offset-4">
                  Ver biblioteca
                </Link>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cerrar
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpenCheck className="mr-2 h-4 w-4" />}
                Guardar plantilla
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function readApiError(payload: unknown) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string" && error.trim()) {
      return error;
    }
  }

  return "No se pudo guardar la plantilla";
}
