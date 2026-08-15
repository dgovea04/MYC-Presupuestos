"use client";

import Link from "next/link";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { trackClientEvent } from "@/lib/analytics/client";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const DEFAULT_PRO_BENEFITS = [
  "IA local y generacion asistida",
  "Cronograma, riesgo y reajustes avanzados",
  "Exportaciones y flujos tecnicos ampliados",
] as const;

export function UpgradeCTA({
  benefits = DEFAULT_PRO_BENEFITS,
  className,
  description = "Tu flujo actual se conserva. Pro desbloquea herramientas tecnicas para acelerar revision, programacion y control del presupuesto.",
  title = "Modulo disponible en Pro",
}: {
  benefits?: readonly string[];
  className?: string;
  description?: string;
  title?: string;
}) {
  return (
    <div className={cn("theme-status-warning theme-status-warning-strong rounded-2xl border p-4", className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="theme-surface-card flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-amber-700 shadow-sm dark:text-amber-300">
            <Lock className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="theme-strong-text text-sm font-semibold">{title}</p>
            <p className="theme-muted-text mt-1 text-sm leading-6">{description}</p>
            {benefits.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {benefits.map((benefit) => (
                  <span
                    key={benefit}
                    className="theme-surface-card inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-200"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                    {benefit}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <Link
          className="theme-filter-button-active inline-flex h-10 min-w-[10.75rem] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-bg)]"
          href="/account"
          onClick={() => trackClientEvent("upgrade_clicked", { source_location: "upgrade_cta", target_plan: "pro" })}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-amber-300" />
          <span className="whitespace-nowrap">Actualizar a Pro</span>
        </Link>
      </div>
    </div>
  );
}

export function ProLockedPreview({
  benefits,
  children,
  description,
  title,
}: {
  benefits?: readonly string[];
  children?: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <div className="space-y-4">
      <UpgradeCTA benefits={benefits} description={description} title={title} />
      {children ? <div className="pointer-events-none select-none opacity-45 blur-[1px]">{children}</div> : null}
    </div>
  );
}
