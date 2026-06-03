"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Copy, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function DuplicateBudgetTemplateButton({
  templateId,
  templateName,
  templateDescription,
}: {
  templateId: string;
  templateName: string;
  templateDescription: string;
}) {
  const router = useRouter();
  const defaultCopyName = `${templateName} copia`;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultCopyName);
  const [description, setDescription] = useState(templateDescription);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/templates/budget/${templateId}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readApiError(payload));
      }

      const duplicatedId = readTemplateId(payload);
      if (!duplicatedId) {
        throw new Error("La plantilla se duplico, pero no se recibio el identificador de la copia");
      }

      router.push(`/templates/budget/${duplicatedId}`);
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo duplicar la plantilla");
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setName(defaultCopyName);
      setDescription(templateDescription);
      setError("");
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
        <Button type="button" variant="outline" className="gap-2" disabled={loading}>
          <Copy className="h-4 w-4" />
          Duplicar
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-slate-950">Duplicar plantilla</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-slate-500">
                Crea una copia editable para reutilizar la estructura sin modificar la plantilla original.
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Original</p>
              <p className="mt-1 font-medium text-slate-900">{templateName}</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Nombre</span>
              <Input aria-label="Nombre de la copia" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Descripcion</span>
              <Textarea
                aria-label="Descripcion de la copia"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Uso, especialidad o criterio tecnico de esta copia"
              />
            </label>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={loading || !name.trim()}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                Crear copia
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

  return "No se pudo duplicar la plantilla";
}

function readTemplateId(payload: unknown) {
  if (payload && typeof payload === "object" && "id" in payload) {
    const id = (payload as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }

  return null;
}
