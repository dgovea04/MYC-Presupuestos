"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SubBudgetDeleteButton({
  subBudgetId,
  subBudgetName,
}: {
  subBudgetId: string;
  subBudgetName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(`/api/budgets/${subBudgetId}`, { method: "DELETE" });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setError(data.error ?? "No se pudo eliminar el Sub Presupuesto");
        return;
      }

      setOpen(false);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" className="gap-2 text-[var(--app-text-muted)] hover:bg-rose-50 hover:text-rose-700" disabled={isDeleting}>
          <Trash2 className="h-4 w-4" />
          Eliminar
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)] outline-none">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-[var(--app-text-strong)]">Eliminar Sub Presupuesto</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">
                Esta accion elimina <span className="font-medium text-[var(--app-text)]">{subBudgetName}</span>, incluyendo sus partidas,
                APU y datos asociados. El presupuesto general se recalculara automaticamente.
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

          {error ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </Dialog.Close>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Eliminar Sub Presupuesto
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
