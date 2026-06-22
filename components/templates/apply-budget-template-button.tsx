"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BookOpenCheck, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ApplyBudgetTemplateButton({
  templateId,
  defaultBudgetName,
  projects,
}: {
  templateId: string;
  defaultBudgetName: string;
  projects: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [name, setName] = useState(defaultBudgetName);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/templates/budget/${templateId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          name: name.trim(),
        }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        throw new Error(readApiError(payload));
      }

      const budgetId = readBudgetId(payload);
      if (!budgetId) {
        throw new Error("La plantilla se aplico, pero no se recibio el presupuesto creado");
      }

      router.push(`/budgets/${budgetId}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo aplicar la plantilla");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="gap-2">
          <BookOpenCheck className="h-4 w-4" />
          Aplicar plantilla
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.42)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-[var(--app-text-strong)]">Aplicar plantilla</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-5 text-[var(--app-text-muted)]">
                Crea un presupuesto nuevo con la estructura, partidas y APU capturados.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] px-3 py-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Plantilla origen</p>
              <p className="mt-1 font-medium text-[var(--app-text-strong)]">{defaultBudgetName}</p>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Proyecto destino</span>
              <select
                aria-label="Proyecto destino"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                disabled={!projects.length}
                className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-sm text-[var(--app-text)] shadow-sm transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:bg-[var(--app-surface-muted)] disabled:text-[var(--app-text-subtle)]"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            {projects.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-5 text-amber-900">
                <p>Crea un proyecto antes de aplicar esta plantilla.</p>
                <Link
                  href="/projects/new"
                  className="mt-2 inline-flex text-sm font-semibold text-amber-950 underline decoration-amber-400 underline-offset-4 transition hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                >
                  Crear proyecto
                </Link>
              </div>
            ) : null}
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">Nombre</span>
              <Input
                aria-label="Nombre del nuevo presupuesto"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

            {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Dialog.Close asChild>
                <Button type="button" variant="outline">
                  Cerrar
                </Button>
              </Dialog.Close>
              <Button type="submit" disabled={loading || !projectId || !name.trim()}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpenCheck className="mr-2 h-4 w-4" />}
                Crear presupuesto
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

  return "No se pudo aplicar la plantilla";
}

function readBudgetId(payload: unknown) {
  if (payload && typeof payload === "object" && "id" in payload) {
    const id = (payload as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }

  return null;
}
