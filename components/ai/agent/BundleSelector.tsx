"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { KhipuSymbol } from "@/components/khipu/KhipuSymbol";
import { BUNDLE_CONFIG } from "./BundleConfig";
import type { BundleSlug } from "./BundleConfig";

export function BundleSelector({
  selected,
  onSelect,
}: {
  selected: BundleSlug | null;
  onSelect: (slug: BundleSlug) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-6 py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-lg shadow-blue-500/20">
          <KhipuSymbol className="h-14 w-14" />
        </div>
        <h2 className="text-lg font-display font-bold text-[var(--app-text-strong)]">
          Khipu Agente
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--app-text-muted)]">
          Elige una especialidad para enfocar al asistente en tu tipo de tarea
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {BUNDLE_CONFIG.map((bundle) => {
          const Icon = bundle.icon;
          const isActive = selected === bundle.slug;

          return (
            <button
              key={bundle.slug}
              type="button"
              onClick={() => onSelect(bundle.slug)}
              className={cn(
                "group relative flex items-center gap-4 rounded-2xl border p-4 text-left transition-all duration-150",
                isActive
                  ? cn(bundle.borderColor, bundle.bgLight, "shadow-sm ring-2 ring-offset-1 ring-blue-200/50")
                  : "border-[var(--app-border-soft)] bg-[var(--app-surface)] hover:border-[var(--app-border)] hover:shadow-sm",
              )}
            >
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-150 group-hover:scale-105",
                  isActive ? bundle.color : "bg-[var(--app-bg-strong)] text-[var(--app-text-muted)] group-hover:bg-[var(--app-surface-muted)]",
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isActive ? bundle.textColor : "text-[var(--app-text-strong)]",
                  )}
                >
                  {bundle.name}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--app-text-muted)]">
                  {bundle.description}
                </p>
              </div>
              {isActive && (
                <div className="absolute right-3 top-3">
                  <CheckCircle2 className={cn("h-5 w-5", bundle.textColor)} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
