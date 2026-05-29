import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function UpgradeCTA({
  className,
  description = "Disponible en Pro. Conservas tu flujo actual y desbloqueas automatizacion, IA y reportes avanzados cuando actualices.",
  title = "Funcionalidad Pro",
}: {
  className?: string;
  description?: string;
  title?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-amber-200 bg-amber-50/80 p-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-950">{title}</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>
        <Link
          className="inline-flex h-10 min-w-[10.75rem] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          href="/account"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
          <span className="whitespace-nowrap">Actualizar a Pro</span>
        </Link>
      </div>
    </div>
  );
}

export function ProLockedPreview({
  children,
  description,
  title,
}: {
  children?: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <div className="space-y-4">
      <UpgradeCTA description={description} title={title} />
      {children ? <div className="pointer-events-none select-none opacity-45 blur-[1px]">{children}</div> : null}
    </div>
  );
}
