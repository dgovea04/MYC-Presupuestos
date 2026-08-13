"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { ArrowRight, Building2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

const WELCOME_STORAGE_PREFIX = "mc-demo-project-welcome:";
type WelcomeStatus = "started" | "dismissed";

export function DemoProjectWelcomeDialog({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const storageKey = `${WELCOME_STORAGE_PREFIX}${projectId}`;
  const closeReason = useRef<WelcomeStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const status = window.localStorage.getItem(storageKey);
      setOpen(status !== "started" && status !== "dismissed");
    } catch {
      setOpen(true);
    }

    setIsHydrated(true);
  }, [storageKey]);

  function persistStatus(status: WelcomeStatus) {
    try {
      window.localStorage.setItem(storageKey, status);
    } catch {
      // The dialog remains available for the current session when storage is unavailable.
    }
  }

  function closeWithStatus(status: WelcomeStatus) {
    closeReason.current = status;
    persistStatus(status);
    setOpen(false);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      const status = closeReason.current ?? "dismissed";
      persistStatus(status);
      closeReason.current = null;
    }
  }

  if (!isHydrated) {
    return null;
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-slate-950/40 backdrop-blur-[2px]" />
        <Dialog.Content
          data-testid="demo-project-welcome-dialog"
          className="theme-surface-card fixed left-1/2 top-1/2 z-[111] w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-[var(--app-border-soft)] p-6 shadow-[0_28px_80px_-34px_rgba(15,23,42,0.5)] outline-none sm:p-7"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Cerrar introducción al proyecto demo"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--app-text-muted)] transition hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-text-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Title className="mt-5 text-xl font-semibold tracking-tight text-[var(--app-text-strong)]">
            Conoce MC Presupuestos en 5 minutos
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-6 text-[var(--app-text-muted)]">
            Hemos preparado un proyecto demo para que recorras el flujo principal de una obra: presupuesto, subpresupuestos,
            APU, fórmula polinómica y exportación.
          </Dialog.Description>

          <div className="mt-5 rounded-2xl border border-sky-200 bg-sky-50/70 px-4 py-3 text-sm text-sky-900 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-200">
            <span className="font-semibold">Proyecto recomendado:</span> {projectName}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => closeWithStatus("dismissed")}>
              Ahora no
            </Button>
            <Link
              href={`/projects/${projectId}?demoTour=1`}
              onClick={() => closeWithStatus("started")}
              className="ui-button ui-button-default inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
            >
              Comenzar tutorial
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
